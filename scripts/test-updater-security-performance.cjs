const assert = require("node:assert/strict");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const { build } = require("esbuild");

async function load(file,mocks={}) {
  const output=await build({entryPoints:[file],bundle:true,platform:"node",format:"cjs",write:false,
    external:["koffi"],plugins:[{name:"fixtures",setup(b){
      b.onResolve({filter:/^(electron|electron-updater)$/},({path})=>({path,namespace:"fixture"}));
      b.onLoad({filter:/.*/,namespace:"fixture"},({path})=>({contents:`module.exports=globalThis.mocks[${JSON.stringify(path)}];`,loader:"js"}));
    }}]});
  const context={module:{exports:{}},require,mocks,process,Buffer,console,setTimeout,clearTimeout,setImmediate,URL};
  context.exports=context.module.exports;
  vm.runInNewContext(output.outputFiles[0].text,context);
  return context.module.exports;
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const app={isPackaged:true,getVersion:()=>"1.3.8"};
  const updater=new EventEmitter(); let checks=0,downloads=0,installs=0;
  updater.checkForUpdates=async()=>{checks++;updater.emit("checking-for-update");await sleep(10);updater.emit("update-not-available");};
  updater.downloadUpdate=async()=>{downloads++;updater.emit("download-progress",{percent:55});};
  updater.quitAndInstall=()=>{installs++;};
  const messages=[];
  const window={isDestroyed:()=>false,webContents:{isDestroyed:()=>false,send:(channel,payload)=>messages.push({channel,...payload})}};
  const {UpdaterController}=await load("src/main/updater.ts",{electron:{app},"electron-updater":{autoUpdater:updater}});
  const controller=new UpdaterController(()=>window);
  await Promise.all([controller.checkForUpdates(false),controller.checkForUpdates(true)]);
  assert.equal(checks,1); assert.equal(updater.autoDownload,false);
  assert(messages.some(m=>m.stage==="checking"&&m.message==="Checking for updates..."));
  assert(messages.some(m=>m.stage==="up-to-date"));
  messages.length=0;await controller.checkForUpdates(false);assert(!messages.some(m=>m.stage==="up-to-date"));
  updater.emit("update-available",{version:"1.3.9"});assert(messages.some(m=>m.version==="1.3.9"));
  await controller.downloadUpdate();await controller.downloadUpdate();assert.equal(downloads,1);
  updater.emit("update-downloaded",{version:"1.3.9"});controller.installUpdate();await sleep(0);assert.equal(installs,1);
  updater.checkForUpdates=async()=>{const error=new Error("Synthetic offline fixture");updater.emit("error",error);throw error;};
  messages.length=0;await controller.checkForUpdates(true);assert.equal(messages.filter(m=>m.stage==="error").length,1);assert.equal(messages[0].interactive,true);
  const {UpdaterController:Unavailable}=await load("src/main/updater.ts",{electron:{app},"electron-updater":{}});
  await new Unavailable(()=>window).checkForUpdates(true);assert.equal(messages.at(-1).stage,"error");
  app.isPackaged=false;await controller.checkForUpdates(true);assert.equal(messages.at(-1).stage,"development");

  const {isTrustedRenderer}=await load("src/main/ipc-security.ts");
  const frame={url:"file:///CyberGrid/build/renderer/index.html"};
  const contents={mainFrame:frame,isDestroyed:()=>false};
  const allowed=[{contents,url:frame.url}];
  assert(isTrustedRenderer({sender:contents,senderFrame:frame},allowed));
  assert(!isTrustedRenderer({sender:contents,senderFrame:{url:frame.url}},allowed));
  assert(!isTrustedRenderer({sender:{...contents},senderFrame:frame},allowed));
  frame.url="https://untrusted.invalid/";assert(!isTrustedRenderer({sender:contents,senderFrame:frame},allowed));
  assert(!isTrustedRenderer({sender:contents,senderFrame:null},allowed));

  const {normalizeThemeName}=await load("src/shared/themes.ts");
  for(const [old,name] of [["dark","midnight"],["light","snowblind"],["dracula","vampire"],["solarized-dark","deep-sea"],["monochrome","matrix"],["monokai","neon-synth"],["custom","custom"]]){
    assert.equal(normalizeThemeName(old),name);assert.equal(normalizeThemeName(name),name);
  }
  assert.equal(normalizeThemeName("toString"),undefined);

  let moves=0;const sender={isDestroyed:()=>true};
  const {RdpController}=await load("src/main/rdp.ts",{electron:{BrowserWindow:{fromWebContents:()=>null}}});
  const rdp=new RdpController("unused-fixture");
  const session={id:"fixture",sender,hostReady:true,closed:false,visible:true,windowHandle:1,
    bounds:{x:0,y:0,width:1,height:1},native:{move:()=>{moves++},setVisible(){}}};
  rdp.sessions.set(session.id,session);
  for(let width=100;width<200;width++)rdp.setBounds(session.id,{x:0,y:0,width,height:100});
  assert.equal(moves,0);await sleep(190);assert.equal(moves,1);assert.equal(session.bounds.width,199);
  rdp.setBounds(session.id,{x:0,y:0,width:199,height:100});await sleep(190);assert.equal(moves,1);
  rdp.setBounds(session.id,{x:0,y:0,width:250,height:100});rdp.setVisible(session.id,false);assert.equal(moves,2);
  await sleep(190);assert.equal(moves,2);
  rdp.setBounds(session.id,{x:0,y:0,width:260,height:100});session.closed=true;await sleep(190);assert.equal(moves,2);
  console.log("PASS: updater IPC states/error deduplication/concurrent checks/null module, trusted IPC frame + URL, theme migration, 150ms RDP resize coalescing and teardown guards");
})().catch(error=>{console.error(error);process.exitCode=1;});
