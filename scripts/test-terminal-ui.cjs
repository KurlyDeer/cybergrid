// Run after npm run build: npx electron scripts/test-terminal-ui.cjs
// Uses isolated temporary userData and mock IPC; no vault credentials or remote hosts.
const { app, BrowserWindow, ipcMain } = require("electron");
const { buildSync } = require("esbuild");
const { readFileSync, writeFileSync, mkdtempSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { tmpdir } = require("node:os");
const assert = require("node:assert/strict");
const Module = require("node:module");
const root = resolve(__dirname, "..");
app.setPath("userData", mkdtempSync(join(tmpdir(), "cybergrid-ui-test-")));
app.commandLine.appendSwitch("no-proxy-server");
function loadSource(file) {
  const filename = join(root, file);
  const output = buildSync({ entryPoints: [filename], bundle: true, platform: "node", format: "cjs", write: false });
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded._compile(output.outputFiles[0].text, filename);
  return loaded.exports;
}
const { IPC_CHANNELS: channels } = loadSource("src/shared/ipc.ts");
const { DEFAULT_APP_PREFERENCES: defaults } = loadSource("src/main/preferences.ts");
let connects = 0;
const writes = [];
let window;
for (const channel of Object.values(channels)) {
  ipcMain.handle(channel, (event, ...args) => {
    if (channel === channels.preferencesGet) return defaults;
    if (channel === channels.vaultStatus) return { exists: true, unlocked: true, masterPasswordEnabled: false };
    if (channel.includes(":list-") || channel === channels.serialList) return [];
    if (channel === channels.workspaceLoad) return { version: 1, tabs: [], layout: "single" };
    if (channel === channels.sshConnect) {
      connects += 1;
      const id = `test-session-${connects}`;
      setTimeout(() => event.sender.send(channels.sshStatus, { sessionId: id, status: "connected" }), 30);
      return id;
    }
    if (channel === channels.sshSetLogging) return { sessionId: args[0], active: args[1], path: "mock-session.log" };
    return null;
  });
}
ipcMain.on(channels.sshWrite, (_event, value) => writes.push(value));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function evaluate(code) { return window.webContents.executeJavaScript(code, true); }
async function until(code) {
  for (let i = 0; i < 100; i++) { if (await evaluate(code)) return; await sleep(50); }
  throw new Error(`Timed out: ${code}`);
}
app.whenReady().then(async () => {
  const renderer = readFileSync(join(root, "src/renderer/renderer.ts"), "utf8");
  buildSync({ stdin: { contents: renderer + "\nwindow.__terminalTest = { tabs, connectQuickSsh, closeTab, currentSettings };", loader: "ts", resolveDir: join(root, "src/renderer") }, bundle: true, platform: "browser", format: "iife", outfile: join(root, "build/renderer/renderer-test.js") });
  const html = readFileSync(join(root, "build/renderer/index.html"), "utf8").replace('src="./startup.js"', 'src="./renderer-test.js"');
  writeFileSync(join(root, "build/renderer/renderer-test.html"), html);
  window = new BrowserWindow({ show: false, width: 1280, height: 850, webPreferences: { preload: join(root, "build/main/preload.js"), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: true } });
  await window.loadFile(join(root, "build/renderer/renderer-test.html"));
  window.webContents.debugger.attach("1.3");
  await window.webContents.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true });
  await until('Boolean(window.__terminalTest && document.querySelector(".welcome-page") && document.getElementById("startup-skeleton").hidden)');
  assert.equal(await evaluate('document.querySelectorAll(".welcome-page .xterm").length'), 0);
  assert.equal(await evaluate('document.querySelectorAll(".welcome-actions button").length'), 3);
  assert.equal(await evaluate('document.getElementById("backup-directory").closest("[data-settings-panel]").dataset.settingsPanel'), "general");
  await sleep(300);
  window.webContents.invalidate();
  await sleep(100);
  writeFileSync(join(root, "build/welcome-test.png"), (await window.webContents.capturePage()).toPNG());
  await evaluate('window.__terminalTest.connectQuickSsh({host:"test.invalid",port:22,username:"test",password:""})');
  await until('[...window.__terminalTest.tabs.values()].some(t=>t.kind==="ssh" && t.status==="connected")');
  await evaluate('window.testTab=[...window.__terminalTest.tabs.values()].find(t=>t.kind==="ssh"); window.testTerminal=window.testTab.terminal; window.testTab.terminal.write("hello-output\\r\\n"); window.testTab.setSwitchToolsOpen(true); window.testTab.switchToolsSelect.value="cisco"; window.testTab.switchToolsSelect.dispatchEvent(new Event("change"))');
  assert.equal(await evaluate('document.querySelectorAll(".switch-model-badge,.model-banner").length'), 0);
  for (const command of ["show ip route", "show ip interface brief", "show cdp neighbors", "show tech-support"]) assert.equal(await evaluate(`document.querySelector(".switch-tools-dynamic").textContent.includes(${JSON.stringify(command)})`), true);
  await sleep(200);
  assert.equal(await evaluate('window.testTab.terminalSurfaceElement.getBoundingClientRect().right <= document.querySelector(".switch-tools-drawer").getBoundingClientRect().left + 1'), true);
  window.webContents.invalidate();
  await sleep(100);
  writeFileSync(join(root, "build/session-tools-test.png"), (await window.webContents.capturePage()).toPNG());
  await evaluate('window.testTab.sessionLogButton.click()');
  await until('window.testTab.sessionLogActive === true');
  await evaluate('window.testTab.sessionLogButton.click()');
  await until('window.testTab.sessionLogActive === false');
  // Keep the test independent of desktop clipboard policies and user contents.
  await evaluate('navigator.clipboard.writeText = async text => { window.copiedOutput = text; }; [...document.querySelectorAll(".switch-tools-drawer button")].find(b=>b.textContent==="Copy All Output").click()');
  await sleep(200);
  assert.match(await evaluate('window.copiedOutput'), /hello-output/);
  window.webContents.send(channels.sshStatus, { sessionId: "test-session-1", status: "disconnected" });
  await until('Boolean(window.testTab.reconnectKey)');
  await evaluate('window.testTab.terminal.focus()');
  window.webContents.sendInputEvent({ type: "keyDown", keyCode: "Space" });
  window.webContents.sendInputEvent({ type: "char", keyCode: " " });
  window.webContents.sendInputEvent({ type: "keyUp", keyCode: "Space" });
  await until('window.testTab.sessionId === "test-session-2" && window.testTab.status === "connected"');
  assert.equal(connects, 2);
  assert.equal(await evaluate('window.testTab.terminal === window.testTerminal && [...window.__terminalTest.tabs.values()].filter(t=>t.kind==="ssh").length===1'), true);
  assert.equal(writes.some(({ data }) => data === " "), false);
  window.webContents.send(channels.sshStatus, { sessionId: "test-session-2", status: "disconnected" });
  await until('Boolean(window.testTab.reconnectKey)');
  await evaluate('window.__terminalTest.closeTab(window.testTab.id)');
  assert.equal(await evaluate('window.__terminalTest.tabs.has(window.testTab.id)'), false);
  assert.equal(connects, 2);
  console.log("PASS: Welcome, General backup path, Cisco groups, model overlay removal, log toggle, copy buffer, same-terminal Space reconnect, close cancellation");
  window.destroy();
  app.exit(0);
}).catch((error) => { console.error(error); app.exit(1); });
