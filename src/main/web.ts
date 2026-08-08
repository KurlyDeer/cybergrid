import { randomUUID } from "node:crypto";
import { BrowserWindow, WebContentsView, type WebContents } from "electron";
import {
  IPC_CHANNELS,
  type WebBounds,
  type WebConnectionConfig,
  type WebStatusEvent,
} from "../shared/ipc";

interface WebSession {
  view: WebContentsView;
  sender: WebContents;
  closed: boolean;
}

function requireWebUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Embedded browser URLs must use HTTP or HTTPS.");
  }
  return url;
}

export class WebController {
  private readonly sessions = new Map<string, WebSession>();

  constructor(private readonly windowProvider: () => BrowserWindow | null) {}

  async connect(config: WebConnectionConfig, sender: WebContents): Promise<string> {
    const window = this.windowProvider();
    if (!window) {
      throw new Error("CyberGrid window is not available.");
    }
    const url = requireWebUrl(config.url);
    const sessionId = randomUUID();
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        partition: "persist:cybergrid-web",
      },
    });
    const session: WebSession = { view, sender, closed: false };
    this.sessions.set(sessionId, session);
    window.contentView.addChildView(view);
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    view.setVisible(false);
    view.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => {
      callback(false);
    });
    view.webContents.setWindowOpenHandler(({ url: requestedUrl }) => {
      try {
        void view.webContents.loadURL(requireWebUrl(requestedUrl).toString());
      } catch {
        // Block non-web schemes and malformed pop-up targets.
      }
      return { action: "deny" };
    });
    view.webContents.on("will-navigate", (event, requestedUrl) => {
      try {
        requireWebUrl(requestedUrl);
      } catch {
        event.preventDefault();
      }
    });
    view.webContents.on("did-start-loading", () => this.sendStatus(sessionId, session, "loading"));
    view.webContents.on("did-finish-load", () => this.sendStatus(sessionId, session, "ready"));
    view.webContents.on("did-fail-load", (_event, code, description) => {
      if (code !== -3) {
        this.sendStatus(sessionId, session, "error", description);
      }
    });
    view.webContents.on("destroyed", () => this.finish(sessionId, session));
    await view.webContents.loadURL(url.toString());
    return sessionId;
  }

  setBounds(sessionId: string, bounds: WebBounds): void {
    const session = this.requireSession(sessionId);
    session.view.setBounds({
      x: Math.max(0, Math.round(bounds.x)),
      y: Math.max(0, Math.round(bounds.y)),
      width: Math.max(0, Math.round(bounds.width)),
      height: Math.max(0, Math.round(bounds.height)),
    });
  }

  setVisible(sessionId: string, visible: boolean): void {
    this.requireSession(sessionId).view.setVisible(visible);
  }

  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.closed) {
      return;
    }
    session.closed = true;
    this.sessions.delete(sessionId);
    const window = this.windowProvider();
    window?.contentView.removeChildView(session.view);
    if (!session.view.webContents.isDestroyed()) {
      session.view.webContents.close();
    }
    this.sendStatus(sessionId, session, "closed");
  }

  disconnectAll(): void {
    for (const sessionId of [...this.sessions.keys()]) {
      this.disconnect(sessionId);
    }
  }

  private requireSession(sessionId: string): WebSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Embedded browser session was not found.");
    }
    return session;
  }

  private finish(sessionId: string, session: WebSession): void {
    if (!session.closed) {
      session.closed = true;
      this.sessions.delete(sessionId);
      this.sendStatus(sessionId, session, "closed");
    }
  }

  private sendStatus(
    sessionId: string,
    session: WebSession,
    status: WebStatusEvent["status"],
    message?: string,
  ): void {
    if (!session.sender.isDestroyed()) {
      const event: WebStatusEvent = { sessionId, status, message };
      session.sender.send(IPC_CHANNELS.webStatus, event);
    }
  }
}
