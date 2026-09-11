// Run after build with Electron. Does not launch mstsc or touch another window.
const {app,BrowserWindow}=require("electron");
const {buildSync,build}=require("esbuild");
const {mkdtempSync}=require("node:fs");
const {join,resolve}=require("node:path");
const {tmpdir}=require("node:os");
const Module=require("node:module");
const assert=require("node:assert/strict");
const root=resolve(__dirname,"..");
app.setPath("userData",mkdtempSync(join(tmpdir(),"cybergrid-native-test-")));
app.on("window-all-closed",()=>{});
function source(file, directory){
  const output=buildSync({entryPoints:[join(root,file)],bundle:true,platform:"node",format:"cjs",external:["electron"],write:false});
  const filename=join(directory,"fixture.cjs");const loaded=new Module(filename,module);loaded.paths=module.paths;loaded._compile(output.outputFiles[0].text,filename);return loaded.exports;
}
app.whenReady().then(async()=>{
  // Validate real Unicode titles and HWND property round trips on our own hidden window.
  const fixtureWindow=new BrowserWindow({show:false,title:"CyberGrid native fixture",webPreferences:{nodeIntegration:false,contextIsolation:true}});
  try {
    const koffi=await import("koffi");const user=koffi.load("user32.dll");
    const set=user.func("bool __stdcall SetPropW(void * hwnd, str16 name, void * value)");
    const get=user.func("void * __stdcall GetPropW(void * hwnd, str16 name)");
    const remove=user.func("void * __stdcall RemovePropW(void * hwnd, str16 name)");
    const title=user.func("int __stdcall GetWindowTextW(void * hwnd, void * buffer, int count)");
    const handle=fixtureWindow.getNativeWindowHandle().readBigUInt64LE(),marker=123456789n;
    assert(set(handle,"CyberGrid.Test.WindowOwner",marker));assert.equal(get(handle,"CyberGrid.Test.WindowOwner"),marker);
    const buffer=Buffer.alloc(1024);const size=title(handle,buffer,512);assert.match(buffer.toString("utf16le",0,size*2),/CyberGrid native fixture/);
    remove(handle,"CyberGrid.Test.WindowOwner");
  } finally {fixtureWindow.destroy();}
  const nativeDirectory=process.argv.includes("--packaged")?join(root,"dist/win-unpacked/resources/app.asar/build/main"):join(root,"build/main");
  const {RdpNativeHost}=source("src/main/rdp/native-host.ts",nativeDirectory);
  async function disposeAndWait(host){
    const exited=new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error("Native helper did not exit")),3000);
      host.child.once("exit",()=>{clearTimeout(timeout);resolve();});
    });
    host.dispose();await exited;
  }
  let failure;const host=new RdpNativeHost(error=>{failure=error;});
  try {
    await host.request({op:"prepare",host:"cybergrid-regression.invalid",marker:"1234567"});
    const reply=await host.request({op:"find",excluded:[]});
    assert.equal(reply.found,false);assert.equal(failure,undefined);
    assert.equal((await host.request({op:"watch"})).alive,false);
  }
  finally {await disposeAndWait(host);}
  const directory=mkdtempSync(join(tmpdir(),"cybergrid-rdp-stall-"));
  await build({entryPoints:[join(root,"src/main/rdp/native-worker.ts")],bundle:true,platform:"node",format:"cjs",outfile:join(directory,"rdp-native-worker.js"),plugins:[{name:"native-stall",setup(b){
    b.onResolve({filter:/^\.\/win32$/},()=>({path:"stall",namespace:"fixture"}));
    b.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:"exports.loadBindings=async()=>({prepare(){},find(){process.parentPort.postMessage({testingStall:true});Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10000);return {found:false}}});",loader:"js"}));
  }}]});
  const {RdpNativeHost:StalledHost}=source("src/main/rdp/native-host.ts",directory);
  const {pollForRdpWindow}=source("src/main/rdp/native-protocol.ts",directory);
  const stalled=new StalledHost(()=>{});let ticks=0,sawStall=false;
  stalled.child.on("message",message=>{if(message.testingStall)sawStall=true;});
  await stalled.request({op:"prepare",host:"fixture.invalid",marker:"1"});
  const heartbeat=setInterval(()=>ticks++,10);const start=Date.now();
  try {await assert.rejects(pollForRdpWindow(async()=>Boolean((await stalled.request({op:"find",excluded:[]})).found),new AbortController().signal,10,500),/10 seconds/);}
  finally {clearInterval(heartbeat);await disposeAndWait(stalled);}
  assert(sawStall,"Worker reached its deliberately blocked native fixture");
  assert(ticks>10,"Electron event loop remains responsive while native helper is blocked");assert(Date.now()-start<2500,"Deadline is not blocked by FFI");
  console.log("PASS: real Win32 Unicode titles/HWND properties, isolated EnumWindows, stalled helper responsiveness/deadline/termination");
  app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
