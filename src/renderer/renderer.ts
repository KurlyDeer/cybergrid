type ITerminalOptions = import("xterm").ITerminalOptions;
type XtermTerminal = import("xterm").Terminal;
type XtermFitAddon = import("xterm-addon-fit").FitAddon;
type CyberGridApi = import("../shared/ipc").CyberGridApi;
type ServerAuthType = import("../shared/ipc").ServerAuthType;
type ServerProfileInput = import("../shared/ipc").ServerProfileInput;
type ServerProfileSummary = import("../shared/ipc").ServerProfileSummary;
type SshConnectionConfig = import("../shared/ipc").SshConnectionConfig;
type SshConnectionStatus = import("../shared/ipc").SshConnectionStatus;
type SshDataEvent = import("../shared/ipc").SshDataEvent;
type SshStatusEvent = import("../shared/ipc").SshStatusEvent;

declare const Terminal: new (options?: ITerminalOptions) => XtermTerminal;
declare const FitAddon: { FitAddon: new () => XtermFitAddon };

interface Window {
  cybergrid: CyberGridApi;
}

interface TerminalTab {
  id: string;
  sessionId?: string;
  terminal: XtermTerminal;
  fitAddon: XtermFitAddon;
  tabElement: HTMLButtonElement;
  statusElement: HTMLSpanElement;
  paneElement: HTMLDivElement;
  status: SshConnectionStatus | "idle";
}

const tabs = new Map<string, TerminalTab>();
const sessions = new Map<string, TerminalTab>();
const queuedData = new Map<string, string[]>();
const queuedStatus = new Map<string, SshStatusEvent>();
const collapsedGroups = new Set<string>();
let savedProfiles: ServerProfileSummary[] = [];
let activeTabId: string | null = null;
let tabSequence = 0;
let vaultMode: "create" | "unlock" = "unlock";

function elementById<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}.`);
  }
  return element as T;
}

const appShell = elementById<HTMLElement>("app-shell");
const connectionForm = elementById<HTMLFormElement>("connection-form");
const hostInput = elementById<HTMLInputElement>("host");
const portInput = elementById<HTMLInputElement>("port");
const usernameInput = elementById<HTMLInputElement>("username");
const passwordInput = elementById<HTMLInputElement>("password");
const tabsElement = elementById<HTMLDivElement>("tabs");
const terminalStack = elementById<HTMLDivElement>("terminal-stack");
const connectionState = elementById<HTMLDivElement>("connection-state");
const profileTree = elementById<HTMLDivElement>("profile-tree");
const addServerButton = elementById<HTMLButtonElement>("add-server-button");
const lockButton = elementById<HTMLButtonElement>("lock-button");

const vaultOverlay = elementById<HTMLDivElement>("vault-overlay");
const vaultForm = elementById<HTMLFormElement>("vault-form");
const vaultTitle = elementById<HTMLHeadingElement>("vault-title");
const vaultSubtitle = elementById<HTMLParagraphElement>("vault-subtitle");
const masterPasswordInput = elementById<HTMLInputElement>("master-password");
const confirmPasswordField = elementById<HTMLDivElement>("confirm-password-field");
const confirmPasswordInput = elementById<HTMLInputElement>("master-password-confirm");
const vaultError = elementById<HTMLDivElement>("vault-error");
const vaultSubmit = elementById<HTMLButtonElement>("vault-submit");

const serverModal = elementById<HTMLDialogElement>("server-modal");
const serverForm = elementById<HTMLFormElement>("server-form");
const serverNameInput = elementById<HTMLInputElement>("server-name");
const serverHostInput = elementById<HTMLInputElement>("server-host");
const serverPortInput = elementById<HTMLInputElement>("server-port");
const serverUsernameInput = elementById<HTMLInputElement>("server-username");
const serverGroupInput = elementById<HTMLInputElement>("server-group");
const groupOptions = elementById<HTMLDataListElement>("group-options");
const authTypeInput = elementById<HTMLSelectElement>("auth-type");
const serverPasswordSection = elementById<HTMLDivElement>("server-password-section");
const serverPasswordInput = elementById<HTMLInputElement>("server-password");
const serverKeySection = elementById<HTMLDivElement>("server-key-section");
const serverKeyPathInput = elementById<HTMLInputElement>("server-key-path");
const serverPassphraseInput = elementById<HTMLInputElement>("server-passphrase");
const browseKeyButton = elementById<HTMLButtonElement>("browse-key-button");
const cancelServerButton = elementById<HTMLButtonElement>("cancel-server-button");
const serverFormError = elementById<HTMLDivElement>("server-form-error");

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^Error:\s*/i, "");
}

function createTerminalTab(label: string): TerminalTab {
  const id = `tab-${++tabSequence}`;
  const tabElement = document.createElement("button");
  tabElement.className = "tab";
  tabElement.type = "button";
  tabElement.role = "tab";
  tabElement.setAttribute("aria-selected", "false");

  const statusElement = document.createElement("span");
  statusElement.className = "tab-status";
  statusElement.setAttribute("aria-hidden", "true");

  const labelElement = document.createElement("span");
  labelElement.className = "tab-label";
  labelElement.textContent = label;

  const closeElement = document.createElement("span");
  closeElement.className = "tab-close";
  closeElement.title = "Close tab";
  closeElement.setAttribute("aria-label", `Close ${label}`);
  closeElement.textContent = "\u00d7";

  tabElement.append(statusElement, labelElement, closeElement);
  tabsElement.append(tabElement);

  const paneElement = document.createElement("div");
  paneElement.className = "terminal-pane";
  paneElement.id = `pane-${id}`;
  paneElement.role = "tabpanel";
  terminalStack.append(paneElement);

  const terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: "bar",
    fontFamily: "Cascadia Mono, JetBrains Mono, Consolas, monospace",
    fontSize: 14,
    lineHeight: 1.18,
    scrollback: 10_000,
    allowTransparency: true,
    theme: {
      background: "#080d14",
      foreground: "#d7e2ef",
      cursor: "#23d5ab",
      cursorAccent: "#080d14",
      selectionBackground: "#244b55",
      black: "#0a1018",
      red: "#ff6b7a",
      green: "#23d5ab",
      yellow: "#e6c86e",
      blue: "#65a9ff",
      magenta: "#bf8cff",
      cyan: "#5eddeb",
      white: "#d7e2ef",
      brightBlack: "#53657a",
      brightRed: "#ff8995",
      brightGreen: "#56e6c2",
      brightYellow: "#f2d98f",
      brightBlue: "#8abfff",
      brightMagenta: "#d1a9ff",
      brightCyan: "#86e8f2",
      brightWhite: "#f5f9ff",
    },
  });
  const fitAddon = new FitAddon.FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(paneElement);

  const tab: TerminalTab = {
    id,
    terminal,
    fitAddon,
    tabElement,
    statusElement,
    paneElement,
    status: "idle",
  };
  tabs.set(id, tab);

  terminal.onData((data) => {
    if (tab.sessionId) {
      window.cybergrid.ssh.write(tab.sessionId, data);
    }
  });
  terminal.onResize(({ cols, rows }) => {
    if (tab.sessionId) {
      window.cybergrid.ssh.resize(tab.sessionId, cols, rows);
    }
  });

  tabElement.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest(".tab-close")) {
      void closeTab(id);
      return;
    }
    activateTab(id);
  });

  activateTab(id);
  return tab;
}

function activateTab(id: string): void {
  const tab = tabs.get(id);
  if (!tab) {
    return;
  }

  activeTabId = id;
  for (const candidate of tabs.values()) {
    const isActive = candidate.id === id;
    candidate.tabElement.classList.toggle("active", isActive);
    candidate.tabElement.setAttribute("aria-selected", String(isActive));
    candidate.paneElement.classList.toggle("active", isActive);
  }

  updateConnectionState(tab);
  requestAnimationFrame(() => {
    tab.fitAddon.fit();
    tab.terminal.focus();
  });
}

async function closeTab(id: string): Promise<void> {
  const tab = tabs.get(id);
  if (!tab) {
    return;
  }

  const tabOrder = [...tabs.keys()];
  const closedIndex = tabOrder.indexOf(id);
  tabs.delete(id);
  if (tab.sessionId) {
    sessions.delete(tab.sessionId);
    await window.cybergrid.ssh.disconnect(tab.sessionId).catch(() => undefined);
  }

  tab.terminal.dispose();
  tab.tabElement.remove();
  tab.paneElement.remove();

  if (activeTabId === id) {
    const remainingIds = [...tabs.keys()];
    const nextId = remainingIds[Math.min(closedIndex, remainingIds.length - 1)];
    if (nextId) {
      activateTab(nextId);
    } else {
      activeTabId = null;
      connectionState.textContent = "Ready";
    }
  }
}

function updateTabStatus(tab: TerminalTab, event: SshStatusEvent): void {
  tab.status = event.status;
  tab.statusElement.classList.toggle("connected", event.status === "connected");
  tab.statusElement.classList.toggle("error", event.status === "error");
  if (event.status === "error") {
    tab.terminal.writeln(
      `\r\n\x1b[31mConnection error: ${event.message ?? "Unknown error"}\x1b[0m`,
    );
  } else if (event.status === "disconnected") {
    tab.terminal.writeln(`\r\n\x1b[90m${event.message ?? "Disconnected."}\x1b[0m`);
  }

  if (activeTabId === tab.id) {
    updateConnectionState(tab, event.message);
  }
}

function updateConnectionState(tab: TerminalTab, message?: string): void {
  const labels: Record<TerminalTab["status"], string> = {
    idle: "Ready",
    connecting: "Connecting...",
    connected: "Connected",
    disconnected: "Disconnected",
    error: "Connection error",
  };
  connectionState.textContent = message ?? labels[tab.status];
}

function setTabConnecting(tab: TerminalTab, description: string): void {
  tab.status = "connecting";
  updateConnectionState(tab);
  tab.terminal.writeln(`\x1b[36mCyberGrid\x1b[0m ${description}`);
}

function attachSession(tab: TerminalTab, sessionId: string): void {
  tab.sessionId = sessionId;
  sessions.set(sessionId, tab);

  const buffered = queuedData.get(sessionId);
  if (buffered) {
    for (const data of buffered) {
      tab.terminal.write(data);
    }
    queuedData.delete(sessionId);
  }

  const status = queuedStatus.get(sessionId);
  if (status) {
    updateTabStatus(tab, status);
    queuedStatus.delete(sessionId);
  }

  tab.fitAddon.fit();
  window.cybergrid.ssh.resize(sessionId, tab.terminal.cols, tab.terminal.rows);
}

function handleConnectionFailure(tab: TerminalTab, error: unknown): void {
  updateTabStatus(tab, {
    sessionId: tab.sessionId ?? "pending",
    status: "error",
    message: errorMessage(error),
  });
}

function handleSshData(event: SshDataEvent): void {
  const tab = sessions.get(event.sessionId);
  if (tab) {
    tab.terminal.write(event.data);
    return;
  }

  const buffered = queuedData.get(event.sessionId) ?? [];
  if (buffered.reduce((size, chunk) => size + chunk.length, 0) < 1_000_000) {
    buffered.push(event.data);
    queuedData.set(event.sessionId, buffered);
  }
}

function handleSshStatus(event: SshStatusEvent): void {
  const tab = sessions.get(event.sessionId);
  if (tab) {
    updateTabStatus(tab, event);
  } else {
    queuedStatus.set(event.sessionId, event);
  }
}

async function connectSavedProfile(profile: ServerProfileSummary): Promise<void> {
  const tab = createTerminalTab(profile.name);
  setTabConnecting(
    tab,
    `connecting to ${profile.username}@${profile.host}:${profile.port} from the encrypted vault...`,
  );

  try {
    attachSession(tab, await window.cybergrid.ssh.connectProfile(profile.id));
  } catch (error) {
    handleConnectionFailure(tab, error);
  }
}

function createTextElement(tag: "span" | "div", className: string, text: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function populateQuickConnect(profile: ServerProfileSummary): void {
  hostInput.value = profile.host;
  portInput.value = String(profile.port);
  usernameInput.value = profile.username;
  passwordInput.value = "";
}

function renderProfiles(): void {
  profileTree.replaceChildren();
  groupOptions.replaceChildren();

  if (savedProfiles.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "sidebar-empty";
    emptyState.textContent = "No saved servers yet. Add one to create your first folder.";
    profileTree.append(emptyState);
    return;
  }

  const profilesByGroup = new Map<string, ServerProfileSummary[]>();
  for (const profile of savedProfiles) {
    const group = profile.group || "Ungrouped";
    const groupProfiles = profilesByGroup.get(group) ?? [];
    groupProfiles.push(profile);
    profilesByGroup.set(group, groupProfiles);
  }

  const groups = [...profilesByGroup.keys()].sort((left, right) => left.localeCompare(right));
  for (const group of groups) {
    const option = document.createElement("option");
    option.value = group;
    groupOptions.append(option);

    const section = document.createElement("section");
    section.className = "server-group";
    section.classList.toggle("collapsed", collapsedGroups.has(group));

    const folderButton = document.createElement("button");
    folderButton.className = "folder-header";
    folderButton.type = "button";
    folderButton.setAttribute("aria-expanded", String(!collapsedGroups.has(group)));
    folderButton.append(
      createTextElement("span", "folder-chevron", collapsedGroups.has(group) ? ">" : "v"),
      createTextElement("span", "folder-name", group),
      createTextElement(
        "span",
        "folder-count",
        String(profilesByGroup.get(group)?.length ?? 0),
      ),
    );
    folderButton.addEventListener("click", () => {
      if (collapsedGroups.has(group)) {
        collapsedGroups.delete(group);
      } else {
        collapsedGroups.add(group);
      }
      renderProfiles();
    });

    const list = document.createElement("div");
    list.className = "server-list";
    for (const profile of profilesByGroup.get(group) ?? []) {
      const row = document.createElement("div");
      row.className = "server-row";

      const serverButton = document.createElement("button");
      serverButton.className = "server-item";
      serverButton.type = "button";
      serverButton.title = "Double-click to connect";
      serverButton.append(
        createTextElement("span", "server-dot", ""),
        (() => {
          const meta = createTextElement("span", "server-meta", "");
          meta.append(
            createTextElement("span", "server-name", profile.name),
            createTextElement(
              "span",
              "server-host",
              `${profile.username}@${profile.host}:${profile.port}`,
            ),
          );
          return meta;
        })(),
      );
      serverButton.addEventListener("click", () => populateQuickConnect(profile));
      serverButton.addEventListener("dblclick", () => void connectSavedProfile(profile));

      const deleteButton = document.createElement("button");
      deleteButton.className = "server-delete";
      deleteButton.type = "button";
      deleteButton.title = `Delete ${profile.name}`;
      deleteButton.setAttribute("aria-label", `Delete ${profile.name}`);
      deleteButton.textContent = "\u00d7";
      deleteButton.addEventListener("click", async () => {
        if (!window.confirm(`Delete the saved server "${profile.name}"?`)) {
          return;
        }
        try {
          await window.cybergrid.vault.deleteProfile(profile.id);
          await refreshProfiles();
        } catch (error) {
          window.alert(errorMessage(error));
        }
      });

      row.append(serverButton, deleteButton);
      list.append(row);
    }

    section.append(folderButton, list);
    profileTree.append(section);
  }
}

async function refreshProfiles(): Promise<void> {
  savedProfiles = await window.cybergrid.vault.listProfiles();
  renderProfiles();
}

function setVaultPrompt(shouldExist: boolean): void {
  vaultMode = shouldExist ? "unlock" : "create";
  vaultTitle.textContent = shouldExist ? "Unlock CyberGrid" : "Create your credential vault";
  vaultSubtitle.textContent = shouldExist
    ? "Enter your master password to decrypt saved servers and credentials."
    : "Choose a master password. It cannot be recovered if you lose it.";
  confirmPasswordField.hidden = shouldExist;
  confirmPasswordInput.required = !shouldExist;
  vaultSubmit.textContent = shouldExist ? "Unlock vault" : "Create vault";
  vaultError.textContent = "";
  vaultOverlay.hidden = false;
  appShell.inert = true;
  requestAnimationFrame(() => masterPasswordInput.focus());
}

function hideVaultPrompt(): void {
  masterPasswordInput.value = "";
  confirmPasswordInput.value = "";
  vaultError.textContent = "";
  vaultOverlay.hidden = true;
  appShell.inert = false;
}

async function initializeVault(): Promise<void> {
  try {
    const status = await window.cybergrid.vault.status();
    if (status.unlocked) {
      await refreshProfiles();
      hideVaultPrompt();
    } else {
      setVaultPrompt(status.exists);
    }
  } catch (error) {
    setVaultPrompt(true);
    vaultError.textContent = errorMessage(error);
  }
}

function updateAuthenticationFields(): void {
  const usesPassword = authTypeInput.value === "password";
  serverPasswordSection.hidden = !usesPassword;
  serverKeySection.hidden = usesPassword;
  serverPasswordInput.required = usesPassword;
  serverKeyPathInput.required = !usesPassword;
}

function openServerModal(): void {
  serverForm.reset();
  serverPortInput.value = "22";
  authTypeInput.value = "password";
  serverFormError.textContent = "";
  updateAuthenticationFields();
  if (!serverModal.open) {
    serverModal.showModal();
  }
  requestAnimationFrame(() => serverNameInput.focus());
}

connectionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const config: SshConnectionConfig = {
    host: hostInput.value.trim(),
    port: Number(portInput.value),
    username: usernameInput.value.trim(),
    password: passwordInput.value || undefined,
  };
  const tab = createTerminalTab(config.host);
  setTabConnecting(
    tab,
    `connecting to ${config.username}@${config.host}:${config.port}...`,
  );

  try {
    attachSession(tab, await window.cybergrid.ssh.connect(config));
  } catch (error) {
    handleConnectionFailure(tab, error);
  } finally {
    passwordInput.value = "";
  }
});

vaultForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = masterPasswordInput.value;
  vaultError.textContent = "";

  if (vaultMode === "create") {
    if (password.length < 10) {
      vaultError.textContent = "Use at least 10 characters for the master password.";
      return;
    }
    if (password !== confirmPasswordInput.value) {
      vaultError.textContent = "Master passwords do not match.";
      return;
    }
  }

  vaultSubmit.disabled = true;
  vaultSubmit.textContent = vaultMode === "create" ? "Creating..." : "Unlocking...";
  try {
    if (vaultMode === "create") {
      await window.cybergrid.vault.create(password);
    } else {
      await window.cybergrid.vault.unlock(password);
    }
    await refreshProfiles();
    hideVaultPrompt();
  } catch (error) {
    vaultError.textContent = errorMessage(error);
    masterPasswordInput.select();
  } finally {
    vaultSubmit.disabled = false;
    vaultSubmit.textContent = vaultMode === "create" ? "Create vault" : "Unlock vault";
  }
});

addServerButton.addEventListener("click", openServerModal);
lockButton.addEventListener("click", async () => {
  try {
    if (serverModal.open) {
      serverModal.close();
    }
    await window.cybergrid.vault.lock();
    savedProfiles = [];
    renderProfiles();
    setVaultPrompt(true);
  } catch (error) {
    window.alert(errorMessage(error));
  }
});

authTypeInput.addEventListener("change", updateAuthenticationFields);
cancelServerButton.addEventListener("click", () => serverModal.close());
browseKeyButton.addEventListener("click", async () => {
  const selectedPath = await window.cybergrid.system.selectPrivateKey();
  if (selectedPath) {
    serverKeyPathInput.value = selectedPath;
  }
});

serverModal.addEventListener("click", (event) => {
  if (event.target === serverModal) {
    serverModal.close();
  }
});

serverForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  serverFormError.textContent = "";
  const authType = authTypeInput.value as ServerAuthType;
  const profile: ServerProfileInput = {
    name: serverNameInput.value.trim(),
    host: serverHostInput.value.trim(),
    port: Number(serverPortInput.value),
    username: serverUsernameInput.value.trim(),
    group: serverGroupInput.value.trim() || "Ungrouped",
    authType,
    password: authType === "password" ? serverPasswordInput.value : undefined,
    privateKeyPath:
      authType === "privateKey" ? serverKeyPathInput.value.trim() : undefined,
    passphrase: authType === "privateKey" ? serverPassphraseInput.value : undefined,
  };

  try {
    await window.cybergrid.vault.saveProfile(profile);
    serverPasswordInput.value = "";
    serverPassphraseInput.value = "";
    serverModal.close();
    await refreshProfiles();
  } catch (error) {
    serverFormError.textContent = errorMessage(error);
  }
});

window.cybergrid.ssh.onData(handleSshData);
window.cybergrid.ssh.onStatus(handleSshStatus);

const resizeObserver = new ResizeObserver(() => {
  if (activeTabId) {
    tabs.get(activeTabId)?.fitAddon.fit();
  }
});
resizeObserver.observe(terminalStack);

const welcomeTab = createTerminalTab("Welcome");
welcomeTab.terminal.writeln("\x1b[36mCyberGrid\x1b[0m");
welcomeTab.terminal.writeln("Encrypted server profiles in a secure, tabbed workspace.\r\n");
welcomeTab.terminal.writeln("Unlock the vault, then double-click a saved server to connect.");

void initializeVault();
