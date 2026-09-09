// Run after build with Electron. Does not launch mstsc or touch another window.
const {app}=require("electron");
const {buildSync,build}=require("esbuild");
const {mkdtempSync}=require("node:fs");
const {join,resolve}=require("node:path");
const {tmpdir}=require("node:os");
const Module=require("node:module");
const assert=require("node:assert/strict");
const root=resolve(__dirname,"..");
app.setPath("userData",mkdtempSync(join(tmpdir(),"cybergrid-native-test-")));
function source(file, directory){
  const output=buildSync({entryPoints:[join(root,file)],bundle:true,platform:"node",format:"cjs",external:["electron"],write:false});
  const filename=join(directory,"fixture.cjs");const loaded=new Module(filename,module);loaded.paths=module.paths;loaded._compile(output.outputFiles[0].text,filename);return loaded.exports;
}
app.whenReady().then(async()=>{
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
  try {const reply=await host.request({op:"find",processId:0});assert.equal(reply.found,false);assert.equal(failure,undefined);}
  finally {await disposeAndWait(host);}
  const directory=mkdtempSync(join(tmpdir(),"cybergrid-rdp-stall-"));
  await build({entryPoints:[join(root,"src/main/rdp/native-worker.ts")],bundle:true,platform:"node",format:"cjs",outfile:join(directory,"rdp-native-worker.js"),plugins:[{name:"native-stall",setup(b){
    b.onResolve({filter:/^\.\/win32$/},()=>({path:"stall",namespace:"fixture"}));
    b.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:"exports.loadBindings=async()=>({find(){process.parentPort.postMessage({testingStall:true});Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10000);return {found:false}}});",loader:"js"}));
  }}]});
  const {RdpNativeHost:StalledHost}=source("src/main/rdp/native-host.ts",directory);
  const {pollForRdpWindow}=source("src/main/rdp/native-protocol.ts",directory);
  const stalled=new StalledHost(()=>{});let ticks=0,sawStall=false;
  stalled.child.on("message",message=>{if(message.testingStall)sawStall=true;});
  const heartbeat=setInterval(()=>ticks++,10);const start=Date.now();
  try {await assert.rejects(pollForRdpWindow(async()=>Boolean((await stalled.request({op:"find",processId:0})).found),new AbortController().signal,10,500),/10 seconds/);}
  finally {clearInterval(heartbeat);await disposeAndWait(stalled);}
  assert(sawStall,"Worker reached its deliberately blocked native fixture");
  assert(ticks>10,"Electron event loop remains responsive while native helper is blocked");assert(Date.now()-start<2500,"Deadline is not blocked by FFI");
  console.log("PASS: real Windows Koffi EnumWindows in utility process; stalled native worker does not freeze Electron; deadline/cancellation kills helper");
  app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
