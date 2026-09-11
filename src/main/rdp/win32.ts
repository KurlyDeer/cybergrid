// Koffi is loaded lazily inside the utility process, never by the app entrypoint.
import type { RdpBounds } from "../../shared/ipc";
import { matchesRdpTitle } from "./native-protocol";

export const FRAME_FLAGS = 0x0020 | 0x0010 | 0x4000 | 0x0004; // FRAMECHANGED | NOACTIVATE | ASYNCWINDOWPOS | NOZORDER
export const RDP_WINDOW_CLASS = "TscShellContainerClass";
const OWNER_PROPERTY = "CyberGrid.Rdp.WindowOwner";

export async function loadBindings() {
  const koffi = await import("koffi");
  if (process.platform !== "win32") throw new Error("Native RDP docking requires Windows.");
  const user32 = koffi.load("user32.dll");
  const kernel32 = koffi.load("kernel32.dll");
  const hwnd = koffi.pointer("HWND", koffi.opaque());
  const callback = koffi.proto("__stdcall", "EnumWindowsProc", "bool", [hwnd, "intptr_t"]);
  const enumWindows = user32.func("__stdcall", "EnumWindows", "bool", [koffi.pointer(callback), "intptr_t"]);
  const getTitle = user32.func("__stdcall", "GetWindowTextW", "int", [hwnd, "void *", "int"]);
  const getProperty = user32.func("__stdcall", "GetPropW", hwnd, [hwnd, "str16"]);
  const setProperty = user32.func("__stdcall", "SetPropW", "bool", [hwnd, "str16", hwnd]);
  const post = user32.func("__stdcall", "PostMessageW", "bool", [hwnd, "uint32_t", "uintptr_t", "intptr_t"]);
  const getClass = user32.func("__stdcall", "GetClassNameA", "int", [hwnd, "char *", "int"]);
  const getStyle = user32.func("__stdcall", "GetWindowLongPtrA", "intptr_t", [hwnd, "int"]);
  const setStyle = user32.func("__stdcall", "SetWindowLongPtrA", "intptr_t", [hwnd, "int", "intptr_t"]);
  const setParent = user32.func("__stdcall", "SetParent", hwnd, [hwnd, hwnd]);
  const setPos = user32.func("__stdcall", "SetWindowPos", "bool", [hwnd, hwnd, "int", "int", "int", "int", "uint32_t"]);
  const update = user32.func("__stdcall", "UpdateWindow", "bool", [hwnd]);
  const redraw = user32.func("__stdcall", "RedrawWindow", "bool", [hwnd, "void *", "void *", "uint32_t"]);
  const show = user32.func("__stdcall", "ShowWindowAsync", "bool", [hwnd, "int"]);
  const isWindow = user32.func("__stdcall", "IsWindow", "bool", [hwnd]);
  const isVisible = user32.func("__stdcall", "IsWindowVisible", "bool", [hwnd]);
  const setError = kernel32.func("__stdcall", "SetLastError", "void", ["uint32_t"]);
  const getError = kernel32.func("__stdcall", "GetLastError", "uint32_t", []);
  let target: unknown;
  let expectedHost = "";
  let expectedPort = 3389;
  let marker = 0n;
  let prepared = false;
  let claimed = false;
  const baseline = new Set<string>();
  const handleKey = (handle: unknown): string => String(handle);
  const classFor = (handle: unknown): string => {
    const buffer = Buffer.alloc(256);
    const length = Number(getClass(handle, buffer, buffer.length));
    return buffer.toString("utf8", 0, Math.max(0, Math.min(length, buffer.length)));
  };
  const titleFor = (handle: unknown): string => {
    const buffer = Buffer.alloc(8192);
    const length = Number(getTitle(handle, buffer, buffer.length / 2));
    return buffer.toString("utf16le", 0, Math.max(0, Math.min(length * 2, buffer.length)));
  };
  const owned = (): boolean => Boolean(target && claimed && isWindow(target) &&
    classFor(target) === RDP_WINDOW_CLASS && getProperty(target, OWNER_PROPERTY) === marker);
  const available = (handle: unknown): boolean => Boolean(isWindow(handle) && isVisible(handle) &&
    !baseline.has(handleKey(handle)) && classFor(handle) === RDP_WINDOW_CLASS &&
    !getProperty(handle, OWNER_PROPERTY) && matchesRdpTitle(titleFor(handle), expectedHost, expectedPort));
  const ensureTarget = (): void => {
    if (!owned()) throw new Error("The RDP window is no longer available.");
  };
  const position = (bounds: RdpBounds, visible: boolean, nudge: boolean): void => {
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const flags = FRAME_FLAGS | (visible ? 0x0040 : 0x0080);
    const move = (size: number): void => {
      if (!setPos(target, null, Math.round(bounds.x), Math.round(bounds.y), size, height, flags)) {
        throw new Error(`Windows rejected RDP bounds (${getError()}).`);
      }
    };
    if (nudge) move(width + 1);
    move(width);
    if (visible) { redraw(target, null, null, 0x0001 | 0x0080 | 0x0400); update(target); }
  };
  return {
    prepare(host: string, port: number | undefined, token: bigint): void {
      if (prepared) throw new Error("RDP window search is already prepared.");
      expectedHost = host; expectedPort = port ?? 3389; marker = token;
      if (!host || marker <= 0n) throw new Error("Invalid RDP window search.");
      // Never steal a window that was already open before this launch.
      enumWindows((candidate: unknown) => {
        if (classFor(candidate) === RDP_WINDOW_CLASS) baseline.add(handleKey(candidate));
        return true;
      }, 0);
      prepared = true;
    },
    find(excluded: string[]): { found: boolean; windowHandle?: string; windowClass?: string } {
      if (!prepared) throw new Error("RDP search was not prepared.");
      const skipped = new Set(excluded);
      let selected: unknown;
      enumWindows((candidate: unknown) => {
        if (!skipped.has(handleKey(candidate)) && available(candidate)) { selected = candidate; return false; }
        return true;
      }, 0);
      target = selected;
      return { found: Boolean(selected), windowHandle: selected ? handleKey(selected) : undefined,
        windowClass: selected ? RDP_WINDOW_CLASS : undefined };
    },
    claim(handle: string): boolean {
      if (!target || handleKey(target) !== handle || !available(target)) return false;
      if (!setProperty(target, OWNER_PROPERTY, marker)) throw new Error("Windows rejected RDP window ownership.");
      claimed = true;
      return owned();
    },
    alive(): boolean { return owned(); },
    close(): void {
      // Post to the verified HWND, never to a stale launcher PID or every mstsc process.
      if (owned() && !post(target, 0x0010, 0, 0)) throw new Error("Windows rejected the RDP close request.");
    },
    dock(parent: bigint, bounds: RdpBounds, visible: boolean): void {
      ensureTarget();
      if (!isWindow(parent)) throw new Error("The CyberGrid parent window has closed.");
      const style = Number(getStyle(target, -16)) >>> 0;
      // Remove POPUP, CAPTION and sizing borders before making a child window.
      const childStyle = ((style & ~0x80000000 & ~0x00c00000 & ~0x00040000) | 0x40000000 | 0x02000000) >>> 0;
      setError(0);
      const previous = setStyle(target, -16, childStyle);
      if (!previous && getError()) throw new Error("Windows rejected the RDP child style.");
      setError(0);
      const previousParent = setParent(target, parent);
      if (!previousParent && getError()) throw new Error("Windows rejected RDP window parenting.");
      position(bounds, visible, true);
      redraw(parent, null, null, 0x0001 | 0x0080); update(parent);
    },
    geometry(bounds: RdpBounds, visible: boolean): void {
      ensureTarget();
      if (!visible) { show(target, 0); return; }
      position(bounds, visible, false);
      show(target, 5);
    },
  };
}
