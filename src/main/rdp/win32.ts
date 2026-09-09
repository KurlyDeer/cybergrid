// Koffi is loaded lazily inside the utility process, never by the app entrypoint.
import type { RdpBounds } from "../../shared/ipc";

export const FRAME_FLAGS = 0x0020 | 0x0010 | 0x4000 | 0x0004; // FRAMECHANGED | NOACTIVATE | ASYNCWINDOWPOS | NOZORDER
export const RDP_WINDOW_CLASSES = ["UIMainClass", "OPWindowClass", "TscShellContainerClass"] as const;

export async function loadBindings() {
  const koffi = await import("koffi");
  if (process.platform !== "win32") throw new Error("Native RDP docking requires Windows.");
  const user32 = koffi.load("user32.dll");
  const kernel32 = koffi.load("kernel32.dll");
  const hwnd = koffi.pointer("HWND", koffi.opaque());
  const callback = koffi.proto("__stdcall", "EnumWindowsProc", "bool", [hwnd, "intptr_t"]);
  const enumWindows = user32.func("__stdcall", "EnumWindows", "bool", [koffi.pointer(callback), "intptr_t"]);
  const getPid = user32.func("__stdcall", "GetWindowThreadProcessId", "uint32_t", [hwnd, "uint32_t *"]);
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
  let targetPid = 0;
  const pidFor = (handle: unknown): number => { const value = Buffer.alloc(4); getPid(handle, value); return value.readUInt32LE(); };
  const ensureTarget = (): void => {
    if (!target || !isWindow(target) || pidFor(target) !== targetPid) throw new Error("The RDP window is no longer available.");
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
    find(processId: number): { found: boolean; windowClass?: string } {
      let rank: number = RDP_WINDOW_CLASSES.length;
      let selected: unknown;
      let windowClass: string | undefined;
      enumWindows((candidate: unknown) => {
        if (pidFor(candidate) !== processId || !isVisible(candidate)) return true;
        const buffer = Buffer.alloc(256);
        const length = Number(getClass(candidate, buffer, buffer.length));
        const name = buffer.toString("utf8", 0, Math.max(0, length));
        const index = (RDP_WINDOW_CLASSES as readonly string[]).indexOf(name);
        if (index >= 0 && index < rank) { rank = index; selected = candidate; windowClass = name; }
        return true;
      }, 0);
      if (selected) { target = selected; targetPid = processId; }
      return { found: Boolean(selected), windowClass };
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
