import type { Terminal, IDisposable } from "xterm";
import { WebglAddon } from "xterm-addon-webgl";
import { CanvasAddon } from "xterm-addon-canvas";

/** One renderer per terminal; no layout or application state changes on input. */
export function installTerminalRenderer(terminal: Terminal): IDisposable {
  let disposed = false;
  let webgl: WebglAddon | undefined;
  let contextLoss: IDisposable | undefined;
  let canvas: CanvasAddon | undefined;
  const fallback = (): void => {
    contextLoss?.dispose();
    webgl?.dispose();
    webgl = undefined;
    if (disposed || canvas) return;
    try {
      canvas = new CanvasAddon();
      terminal.loadAddon(canvas);
    } catch {
      // Keep the terminal usable on machines where even 2D canvas is unavailable.
      canvas?.dispose();
      canvas = undefined;
    }
  };
  try {
    webgl = new WebglAddon();
    contextLoss = webgl.onContextLoss(fallback);
    terminal.loadAddon(webgl);
  } catch {
    fallback();
  }
  return { dispose: () => {
    disposed = true;
    contextLoss?.dispose();
    webgl?.dispose();
    canvas?.dispose();
  } };
}
