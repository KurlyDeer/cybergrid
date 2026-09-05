import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from "electron";

export interface TrustedRenderer { contents: WebContents; url: string }

/** Window identity alone is insufficient: frames and navigated pages can send IPC. */
export function isTrustedRenderer(event: IpcMainEvent | IpcMainInvokeEvent, renderers: readonly TrustedRenderer[]): boolean {
  const frame = event.senderFrame;
  if (!frame || event.sender.isDestroyed() || frame !== event.sender.mainFrame) return false;
  return renderers.some(({ contents, url }) => contents === event.sender && frame.url === url);
}
