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
const { PreferencesController } = loadSource("src/main/preferences.ts");
const preferences = new PreferencesController(join(app.getPath("userData"), "preferences.json"));
let preferenceSaves = 0;
let failNextPreferenceSave = false;
let connects = 0;
const writes = [];
const diagnosticRequests = [];
const reportOpens = [];
const { RollingErrorBuffer, BugReporter } = loadSource("src/main/bug-report.ts");
const testErrorBuffer = new RollingErrorBuffer();
testErrorBuffer.capture("Synthetic report fixture: no real user logs.");
const testReporter = new BugReporter(testErrorBuffer, () => ({version:"1.3.7",systemVersion:"Windows fixture",osRelease:"fixture",platform:"win32",arch:"x64",memory:{rss:1024,heapUsed:512,heapTotal:1024}}));
let window;
for (const channel of Object.values(channels)) {
  ipcMain.handle(channel, (event, ...args) => {
    if (channel === channels.bugReportPreview) return testReporter.preview(event.sender.id, args[0]);
    if (channel === channels.bugReportSend) return testReporter.send(event.sender.id, args[0], async url => { reportOpens.push(url); });
    if (channel === channels.diagnosticsGlobal) {
      diagnosticRequests.push(args[0]);
      return {kind:args[0].kind,success:true,summary:"Fixture complete",durationMs:12,rows:[{label:"Fixture",value:'<img src=x onerror="window.injected=true">'},{label:"Expiry",value:"12 days remaining",warning:true}]};
    }
    if (channel === channels.preferencesGet) return preferences.get();
    if (channel === channels.preferencesUpdate) {
      preferenceSaves++;
      if (failNextPreferenceSave) { failNextPreferenceSave = false; throw new Error("Simulated disk failure"); }
      return preferences.save(args[0]);
    }
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
for (const channel of [channels.sshWrite, channels.serialWrite, channels.streamWrite, channels.localWrite]) ipcMain.on(channel, (_event, value) => writes.push(value));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function evaluate(code) {
  try { return await window.webContents.executeJavaScript(code, true); }
  catch(error) { console.error("Failed UI test step:", code); throw error; }
}
async function until(code) {
  for (let i = 0; i < 100; i++) { if (await evaluate(code)) return; await sleep(50); }
  throw new Error(`Timed out: ${code}`);
}
app.whenReady().then(async () => {
  const renderer = readFileSync(join(root, "src/renderer/renderer.ts"), "utf8");
  buildSync({ stdin: { contents: renderer + "\nwindow.__terminalTest = { tabs, connectQuickSsh, createTerminalTab, closeTab, openSettingsModal, applyHealthStatus, updateBroadcastControls };", loader: "ts", resolveDir: join(root, "src/renderer") }, bundle: true, platform: "browser", format: "iife", outfile: join(root, "build/renderer/renderer-test.js") });
  const html = readFileSync(join(root, "build/renderer/index.html"), "utf8").replace('src="./startup.js"', 'src="./renderer-test.js"');
  writeFileSync(join(root, "build/renderer/renderer-test.html"), html);
  window = new BrowserWindow({ show: false, width: 1280, height: 850, webPreferences: { preload: join(root, "build/main/preload.js"), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: true } });
  await window.loadFile(join(root, "build/renderer/renderer-test.html"));
  window.webContents.startPainting();
  window.webContents.debugger.attach("1.3");
  await window.webContents.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true });
  await until('Boolean(window.__terminalTest && document.querySelector(".welcome-page") && document.getElementById("startup-skeleton").hidden)');
  assert.equal(await evaluate('document.querySelectorAll(".welcome-page .xterm").length'), 0);
  assert.equal(await evaluate('document.querySelectorAll(".welcome-actions button").length'), 3);
  assert.equal(await evaluate('document.getElementById("backup-directory").closest("[data-settings-panel]").dataset.settingsPanel'), "general");
  assert.equal(await evaluate('[...document.querySelectorAll(".brand-mark,.vault-logo,.startup-skeleton-logo,.welcome-heading img")].every(img=>img.src.endsWith("/assets/logo.svg") && img.complete && img.naturalWidth>0)'), true);
  for (const [state, color] of [["online", "rgb(78, 226, 138)"], ["offline", null], ["checking", null]]) {
    const result=await evaluate(`(() => {const dot=document.createElement("span");dot.className="server-dot";document.body.append(dot);window.__terminalTest.applyHealthStatus(dot,{profileId:"fixture",status:"${state}",latencyMs:12,port:8006});const result={color:getComputedStyle(dot).backgroundColor,title:dot.title,className:dot.className};dot.remove();return result;})()`);
    assert(result.className.includes(state));
    if(color) assert.equal(result.color,color);
    if(state==="online") assert.match(result.title,/8006.*12 ms/);
  }
  await evaluate('window.__terminalTest.openSettingsModal(); document.getElementById("theme-mode").value="dracula"; document.getElementById("apply-settings").click()');
  await until('!document.getElementById("settings-modal").open');
  assert.equal(preferenceSaves, 1);
  assert.equal(preferences.get().terminalLineHeight, 1.18);
  assert.equal(await evaluate('document.documentElement.dataset.theme'), "dracula");
  assert.equal((await new PreferencesController(join(app.getPath("userData"), "preferences.json")).load()).theme, "dracula");
  await evaluate('window.__terminalTest.openSettingsModal(); document.getElementById("terminal-line-height").value="1.185"; document.getElementById("apply-settings").click()');
  assert.equal(preferenceSaves, 1);
  assert.match(await evaluate('document.getElementById("settings-error").textContent'), /increments of 0.01/);
  for (const value of [0.5, 3, 1.18]) {
    await evaluate(`window.__terminalTest.openSettingsModal(); document.getElementById("terminal-line-height").value="${value}"; document.getElementById("apply-settings").click()`);
    await until('!document.getElementById("settings-modal").open');
    assert.equal(preferences.get().terminalLineHeight, value);
  }
  failNextPreferenceSave = true;
  await evaluate('window.__terminalTest.openSettingsModal(); document.getElementById("theme-mode").value="light"; document.getElementById("apply-settings").click()');
  await until('document.getElementById("settings-error").textContent.includes("Simulated disk failure")');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), "dracula");
  await evaluate('document.getElementById("settings-modal").close()');
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
  // Mixed terminal protocols, excluding inactive channels and local login prompts.
  await evaluate('window.__terminalTest.createTerminalTab("ssh-target", "ssh").sessionId="broadcast-ssh"; window.__terminalTest.createTerminalTab("serial-target", "serial").serialSessionId="broadcast-serial"; window.__terminalTest.createTerminalTab("raw-target", "raw").streamSessionId="broadcast-raw"; window.__terminalTest.createTerminalTab("local-target", "local").localSessionId="broadcast-local"; for(const t of window.__terminalTest.tabs.values()) if(t.kind!=="welcome") t.status="connected"; window.__terminalTest.updateBroadcastControls(); document.getElementById("broadcast-input-toggle").click(); [...window.__terminalTest.tabs.values()].find(t=>t.kind==="local").terminal.paste("broadcast-fixture")');
  await sleep(100);
  assert.equal(writes.filter(event=>event.data==="broadcast-fixture").length, 4);
  assert.equal(await evaluate('document.getElementById("broadcast-input-toggle").getAttribute("aria-pressed")'), "true");
  await evaluate('document.getElementById("broadcast-input-toggle").click(); [...window.__terminalTest.tabs.values()].find(t=>t.kind==="local").terminal.paste("single-fixture")');
  await sleep(100);
  assert.equal(writes.filter(event=>event.data==="single-fixture").length, 1);
  await evaluate('[...window.__terminalTest.tabs.values()].find(t=>t.kind==="ssh").status="disconnected"; [...window.__terminalTest.tabs.values()].find(t=>t.kind==="serial").localInputHandler=()=>{}; window.__terminalTest.updateBroadcastControls(); document.getElementById("broadcast-input-toggle").click(); [...window.__terminalTest.tabs.values()].find(t=>t.kind==="local").terminal.paste("filtered-fixture")');
  await sleep(100);
  assert.equal(writes.filter(event=>event.data==="filtered-fixture").length,2);
  await evaluate('[...window.__terminalTest.tabs.values()].find(t=>t.kind==="local").localInputHandler=()=>{}; [...window.__terminalTest.tabs.values()].find(t=>t.kind==="local").terminal.paste("login-fixture")');
  await sleep(100);
  assert.equal(writes.filter(event=>event.data==="login-fixture").length,0);
  window.webContents.send(channels.appMenuCommand, "global-diagnostics");
  await until('document.getElementById("global-diagnostics")?.open');
  assert.equal(await evaluate('document.querySelectorAll("[data-diag-tab]").length'),3);
  assert.equal(await evaluate('document.querySelectorAll(".tool-tooltip strong").length'),12);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".diagnostics-tabs")).flexDirection'),"column");
  assert.equal(await evaluate('document.querySelector(".diagnostics-tabs").getBoundingClientRect().right <= document.querySelector(".diagnostics-body").getBoundingClientRect().left'),true);
  await evaluate('document.getElementById("diag-tcp-target").value="example.invalid";document.getElementById("diag-tcp-port").value="8006";document.querySelector("[data-tool=tcp]").requestSubmit()');
  await until('document.querySelector("[data-status=tcp]").textContent.includes("Fixture complete")');
  assert.equal(diagnosticRequests[0].port,8006);
  assert.equal(await evaluate('document.querySelectorAll(".diagnostic-table img").length'),0);
  assert.equal(await evaluate('document.querySelector(".diagnostic-table").textContent.includes("<img")'),true);
  await evaluate('document.getElementById("diag-tab-network").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowDown",bubbles:true}))');
  assert.equal(await evaluate('document.getElementById("diag-tab-security").getAttribute("aria-selected")'),"true");
  await evaluate('document.querySelector("#diag-panel-security .tool-help button").focus()');
  assert.equal(await evaluate('getComputedStyle(document.getElementById("tls-help")).display'),"block");
  assert.equal(await evaluate('(()=>{const r=document.getElementById("tls-help").getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})()'),true);
  await evaluate('document.getElementById("diag-tls-target").value="example.invalid";document.querySelector("[data-tool=tls]").requestSubmit()');
  await until('document.querySelector("[data-status=tls]").textContent.includes("Fixture complete")');
  assert.equal(await evaluate('document.querySelectorAll("#diag-panel-security tr.diagnostic-warning").length'),1);
  // Screenshot after a real offscreen paint, not a stale startup frame.
  await evaluate('document.getElementById("diag-tab-network").click();document.documentElement.dataset.theme="dark"');
  let diagnosticsImage;
  const captureDiagnostics = (_event, _dirty, image) => { diagnosticsImage = image; };
  window.webContents.on("paint",captureDiagnostics); window.webContents.invalidate();
  await sleep(1000);
  window.webContents.removeListener("paint",captureDiagnostics);
  assert.ok(diagnosticsImage,"Diagnostics frame painted");
  writeFileSync(join(root,"build/diagnostics-test.png"),diagnosticsImage.toPNG());
  window.setSize(980,650);
  await sleep(150);
  assert.equal(await evaluate('document.getElementById("global-diagnostics").getBoundingClientRect().bottom <= innerHeight && document.querySelector(".diagnostics-body").clientHeight > 0'),true);
  await evaluate('document.getElementById("global-diagnostics").close()');
  window.webContents.send(channels.appMenuCommand,"report-bug");
  await until('document.getElementById("bug-report")?.open && !document.getElementById("bug-send").disabled');
  assert.equal(reportOpens.length,0);
  assert.equal(await evaluate('document.querySelectorAll("#bug-report textarea").length'),1);
  await evaluate('document.getElementById("bug-description").value="Test report description";document.getElementById("bug-description").dispatchEvent(new Event("input"))');
  assert.equal(await evaluate('document.getElementById("bug-send").disabled'),true);
  await until('!document.getElementById("bug-send").disabled');
  const outgoingPreview=await evaluate('document.getElementById("bug-preview").textContent');
  await evaluate('navigator.clipboard.writeText=async value=>{window.copiedReport=value};document.getElementById("bug-copy").click()');
  await until('Boolean(window.copiedReport)');
  assert.match(await evaluate('window.copiedReport'),/Synthetic report fixture/);
  await evaluate('document.getElementById("bug-send").click()');
  await until('document.getElementById("bug-report-status").textContent.includes("GitHub draft opened")');
  assert.equal(reportOpens.length,1); assert.equal(new URL(reportOpens[0]).searchParams.get('body'),outgoingPreview);
  assert.ok(reportOpens[0].length<=2000);
  window.webContents.sendInputEvent({type:"keyDown",keyCode:"Escape"});
  window.webContents.sendInputEvent({type:"keyUp",keyCode:"Escape"});
  await until('!document.getElementById("bug-report").open');
  window.webContents.send(channels.appMenuCommand,"global-diagnostics");
  await until('document.getElementById("global-diagnostics").open');
  window.webContents.sendInputEvent({type:"mouseDown",x:2,y:2,button:"left",clickCount:1});
  window.webContents.sendInputEvent({type:"mouseUp",x:2,y:2,button:"left",clickCount:1});
  await until('!document.getElementById("global-diagnostics").open');
  console.log("PASS: diagnostics tabs/tooltips/safe output/responsiveness, reviewed bug report flow (no network), plus settings, themes, logos, broadcast and terminal regressions");
  window.destroy();
  app.exit(0);
}).catch((error) => { console.error(error); app.exit(1); });
