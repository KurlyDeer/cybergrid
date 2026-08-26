import { Menu, type MenuItemConstructorOptions } from "electron";
import type { AppMenuCommand } from "../shared/ipc";

export interface CyberGridMenuActions {
  send(command: AppMenuCommand): void;
  quit(): void;
  toggleFullscreen(): void;
  exitFullscreen(): void;
  checkForUpdates(): void;
  showAbout(): void;
}

export function installCyberGridMenu(actions: CyberGridMenuActions): void {
  const command = (value: AppMenuCommand): (() => void) => () => actions.send(value);
  const template: MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        { label: "New Connection...", accelerator: "CommandOrControl+Shift+N", click: command("new-connection") },
        { label: "New Folder...", click: command("new-folder") },
        { label: "Duplicate Connection", accelerator: "CommandOrControl+D", click: command("duplicate-connection") },
        { label: "Delete", accelerator: "Delete", click: command("delete-selection") },
        { type: "separator" },
        { label: "Quick Connect", accelerator: "CommandOrControl+N", click: command("focus-quick-connect") },
        { label: "Lock Credential Vault", accelerator: "CommandOrControl+L", click: command("lock-vault") },
        { label: "Import / Export...", click: command("import-export") },
        { type: "separator" },
        { label: "Exit", accelerator: "Alt+F4", click: actions.quit },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "copy", label: "Copy", accelerator: "CommandOrControl+C" },
        { role: "paste", label: "Paste", accelerator: "CommandOrControl+V" },
        { type: "separator" },
        { label: "Command Palette...", accelerator: "CommandOrControl+K", click: command("command-palette") },
        { label: "Clear Terminal", accelerator: "CommandOrControl+Shift+K", click: command("clear-terminal") },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Toggle Sidebar", accelerator: "CommandOrControl+B", click: command("toggle-sidebar") },
        { label: "Toggle Tools Drawer", accelerator: "CommandOrControl+T", click: command("toggle-tools-drawer") },
        { label: "Split Grid View", accelerator: "CommandOrControl+Shift+G", click: command("toggle-grid") },
        { type: "separator" },
        { role: "resetZoom", label: "Reset Zoom" },
        { id: "fullscreen-toggle", label: "Enter Fullscreen (F11)", accelerator: "F11", click: actions.toggleFullscreen },
        { label: "Exit Fullscreen", accelerator: "CommandOrControl+Shift+F", click: actions.exitFullscreen },
      ],
    },
    {
      label: "Tools",
      submenu: [
        { label: "Options / Settings...", accelerator: "CommandOrControl+,", click: command("settings") },
        { type: "separator" },
        { label: "External Tools Launcher", click: command("external-tools") },
        { label: "Subnet IPAM Scanner...", click: command("subnet-scanner") },
        { label: "Port Scan", click: command("port-scan") },
        { label: "SFTP File Browser", click: command("toggle-sftp") },
        { type: "separator" },
        { label: "Broadcast Terminal (Multi-Exec)", click: command("toggle-broadcast") },
        { label: "Broadcast Targets...", click: command("broadcast-targets") },
        { label: "Node Workspace", click: command("node-workspace") },
        { label: "Credential Profiles...", click: command("credential-profiles") },
        { label: "Enterprise Integrations...", click: command("enterprise") },
      ],
    },
    {
      label: "Window",
      submenu: [
        { label: "Close Tab", accelerator: "CommandOrControl+W", click: command("close-tab") },
        { label: "Reopen Closed Tab", accelerator: "CommandOrControl+Shift+T", click: command("reopen-tab") },
        { label: "Next Tab", accelerator: "Control+Tab", click: command("next-tab") },
      ],
    },
    {
      label: "Help",
      submenu: [
        { label: "Documentation", accelerator: "F1", click: command("help") },
        { label: "Keyboard Shortcuts", accelerator: "CommandOrControl+/", click: command("shortcuts") },
        { type: "separator" },
        { label: "Check for Updates...", click: actions.checkForUpdates },
        { label: "About CyberGrid", click: actions.showAbout },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
