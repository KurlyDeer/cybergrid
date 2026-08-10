import { Menu, Tray, nativeImage, type MenuItemConstructorOptions } from "electron";
import type { TrayStateSnapshot } from "../shared/ipc";

export interface SystemTrayState extends TrayStateSnapshot {
  vaultUnlocked: boolean;
}

export interface SystemTrayActions {
  showWindow(): void;
  lockVault(): void;
  unlockVault(): void;
  disconnectAllSessions(): void;
  quickConnect(): void;
  toggleBroadcast(): void;
  runSubnetScan(): void;
  exportVaultBackup(): void;
  checkForUpdates(): void;
  quit(): void;
}

export class SystemTrayController {
  private tray: Tray | null = null;

  constructor(
    private readonly version: string,
    private readonly actions: SystemTrayActions,
  ) {}

  create(initialState: SystemTrayState): void {
    if (this.tray) return;
    this.tray = new Tray(this.createImage());
    this.tray.setToolTip(`CyberGrid v${this.version} remote connection manager`);
    this.tray.on("click", this.actions.showWindow);
    this.update(initialState);
  }

  update(state: SystemTrayState): void {
    if (!this.tray) return;
    const sessionItems: MenuItemConstructorOptions[] = state.sessions.length > 0
      ? state.sessions.slice(0, 30).map((session) => ({
          label: `${session.label} (${session.protocol.toUpperCase()} \u00B7 ${session.status})`,
          enabled: false,
        }))
      : [{ label: "No active sessions", enabled: false }];
    sessionItems.push(
      { type: "separator" },
      {
        label: "Disconnect All Sessions",
        enabled: state.sessions.length > 0,
        click: this.actions.disconnectAllSessions,
      },
    );

    this.tray.setContextMenu(Menu.buildFromTemplate([
      { label: `CyberGrid v${this.version}`, enabled: false },
      { type: "separator" },
      {
        label: state.vaultUnlocked ? "\u{1F513} Lock Credential Vault" : "\u{1F512} Unlock Vault",
        click: state.vaultUnlocked ? this.actions.lockVault : this.actions.unlockVault,
      },
      {
        label: `Active Sessions (${state.sessions.length})`,
        submenu: sessionItems,
      },
      { label: "Quick Connect...", click: this.actions.quickConnect },
      {
        label: `Broadcast Mode: ${state.broadcastMode ? "ON" : "OFF"}`,
        type: "checkbox",
        checked: state.broadcastMode,
        click: this.actions.toggleBroadcast,
      },
      {
        label: "System Utilities",
        submenu: [
          { label: "Run Subnet Discovery Scan", click: this.actions.runSubnetScan },
          { label: "Export Vault Backup (.cgvault)", click: this.actions.exportVaultBackup },
        ],
      },
      { type: "separator" },
      { label: "Check for Updates...", click: this.actions.checkForUpdates },
      { label: "Show CyberGrid Window", click: this.actions.showWindow },
      { label: "Quit CyberGrid", click: this.actions.quit },
    ]));
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }

  private createImage(): Electron.NativeImage {
    const size = 16;
    const bitmap = Buffer.alloc(size * size * 4);
    const setPixel = (x: number, y: number, alpha = 255): void => {
      const offset = (y * size + x) * 4;
      bitmap[offset] = 171;
      bitmap[offset + 1] = 213;
      bitmap[offset + 2] = 35;
      bitmap[offset + 3] = alpha;
    };
    for (let index = 2; index < 14; index += 1) {
      setPixel(index, 2);
      setPixel(index, 13);
      setPixel(2, index);
      setPixel(13, index);
    }
    for (let index = 4; index < 12; index += 1) {
      setPixel(7, index);
      setPixel(index, 7);
    }
    return nativeImage.createFromBitmap(bitmap, { width: size, height: size, scaleFactor: 1 });
  }
}
