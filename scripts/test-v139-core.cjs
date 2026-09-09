const assert = require("node:assert/strict");
const vm = require("node:vm");
const net = require("node:net");
const {EventEmitter}=require("node:events");
const { build } = require("esbuild");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function load(file, mocks = {}, overrides = {}) {
  const result = await build({entryPoints:[file],bundle:true,platform:"node",format:"cjs",write:false,
    plugins:[{name:"fixtures",setup(b){
      b.onResolve({filter:/.*/},({path}) => Object.hasOwn(mocks,path) ? {path,namespace:"fixture"} : undefined);
      b.onLoad({filter:/.*/,namespace:"fixture"},({path})=>({contents:`module.exports=globalThis.mocks[${JSON.stringify(path)}];`,loader:"js"}));
    }}]});
  const context={module:{exports:{}},require,mocks,process,Buffer,console,setTimeout,clearTimeout,setInterval,clearInterval,URL,AbortController,...overrides};
  context.exports=context.module.exports;
  vm.runInNewContext(result.outputFiles[0].text,context);
  return context.module.exports;
}
(async()=>{
  const {pollForRdpWindow,rdpAddress,RDP_POLL_INTERVAL_MS,RDP_ATTACH_TIMEOUT_MS}=await load("src/main/rdp/native-protocol.ts");
  assert.equal(RDP_POLL_INTERVAL_MS,250);assert.equal(RDP_ATTACH_TIMEOUT_MS,10000);
  for(const port of [undefined,"",3389,"3389"]) {
    assert.equal(rdpAddress("198.51.100.42",port),"198.51.100.42");
    assert.equal(rdpAddress("2001:db8::1",port),"[2001:db8::1]");
  }
  assert.equal(rdpAddress("[2001:db8::1]",3390),"[2001:db8::1]:3390");
  assert.equal(rdpAddress("rdp.example.invalid",3390),"rdp.example.invalid:3390");
  assert.throws(()=>rdpAddress("example.invalid",65536));
  let calls=0,inFlight=0,max=0;
  await pollForRdpWindow(async()=>{max=Math.max(max,++inFlight);await sleep(20);inFlight--;return ++calls===3;},new AbortController().signal,5,200);
  assert.equal(max,1);assert.equal(calls,3);await sleep(20);assert.equal(calls,3);
  await assert.rejects(pollForRdpWindow(()=>new Promise(()=>{}),new AbortController().signal,5,30),/10 seconds/);
  const abort=new AbortController();const pending=pollForRdpWindow(async()=>false,abort.signal,5,200);abort.abort();await assert.rejects(pending,/cancel/i);

  const records=[];let matchedPid=42;
  const candidates=new Map([[1n,{pid:999,name:"UIMainClass"}],[2n,{pid:42,name:"TscShellContainerClass"}],[3n,{pid:42,name:"OPWindowClass"}],[4n,{pid:42,name:"UIMainClass"}]]);
  const funcs={
    EnumWindows: cb=>{for(const candidate of candidates.keys())cb(candidate);return true;},
    GetWindowThreadProcessId:(h,b)=>{b.writeUInt32LE(h===4n?matchedPid:candidates.get(h)?.pid||0);return 1;},
    GetClassNameA:(h,b)=>b.write(candidates.get(h).name),GetWindowLongPtrA:()=>0x80c40000,
    SetWindowLongPtrA:(...args)=>{records.push(["style",...args]);return 0x80c40000;},
    SetParent:(...args)=>{records.push(["parent",...args]);return 0n;},
    SetWindowPos:(...args)=>{records.push(["position",...args]);return true;},
    UpdateWindow:h=>{records.push(["update",h]);return true;},RedrawWindow:()=>true,
    ShowWindowAsync:()=>true,IsWindow:()=>true,IsWindowVisible:()=>true,SetLastError:()=>{},GetLastError:()=>0,
  };
  const koffi={load:()=>({func:(_cc,name)=>funcs[name]}),pointer:()=>"pointer",opaque:()=>"opaque",proto:()=>"callback"};
  const {loadBindings,FRAME_FLAGS}=await load("src/main/rdp/win32.ts",{koffi});
  const native=await loadBindings();assert.equal(native.find(42).windowClass,"UIMainClass");
  native.dock(99n,{x:7,y:11,width:300,height:200},true);
  const style=records.find(r=>r[0]==="style");assert.equal(style[1],4n);assert.equal(style[3]&0x80000000,0);assert.equal(style[3]&0x00c00000,0);assert.ok(style[3]&0x40000000);
  assert.deepEqual(records.find(r=>r[0]==="parent"),["parent",4n,99n]);
  const positions=records.filter(r=>r[0]==="position");assert.deepEqual(positions.map(r=>r[5]),[301,300]);
  for(const position of positions)assert.equal(position[7]&FRAME_FLAGS,FRAME_FLAGS);
  assert(records.some(r=>r[0]==="update"&&r[1]===4n));assert(records.some(r=>r[0]==="update"&&r[1]===99n));
  matchedPid=43;assert.throws(()=>native.geometry({x:0,y:0,width:1,height:1},true),/no longer/);

  const {ipv4Subnet,runContextCommand}=await load("src/main/diagnostics/context-tools.ts");
  assert.equal(ipv4Subnet("198.51.100.42"),"198.51.100.0/24");assert.throws(()=>ipv4Subnet("::1"));assert.throws(()=>ipv4Subnet("1.2.3.4;whoami"));
  const clean=await runContextCommand(process.execPath,["-e","process.stdout.write('\\x1b[31mfixture\\x1b[0m\\x00')"],new AbortController().signal);
  assert.equal(clean.success,true);assert.equal(clean.output,"fixture");
  const long=await runContextCommand(process.execPath,["-e","process.stdout.write('a'.repeat(150000))"],new AbortController().signal);
  assert.match(long.output,/truncated/);assert(long.output.length<132000);
  const stopped=await runContextCommand(process.execPath,["-e","setInterval(()=>{},1000)"],new AbortController().signal,80);
  assert.equal(stopped.success,false);assert.match(stopped.output,/Stopped/);
  const cancelled=new AbortController();cancelled.abort();assert.equal((await runContextCommand("must-not-spawn",[],cancelled.signal)).output,"Cancelled.");
  const launched=[];
  const fixtureSpawn=(command,args,options)=>{
    launched.push({command,args,options});
    const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.exitCode=null;
    child.kill=()=>{child.exitCode=1;return true;};
    setTimeout(()=>{child.stdout.emit("data",Buffer.from("Fixture command result"));child.exitCode=0;child.emit("close",0);},5);
    return child;
  };
  const fixtureProcess={...process,env:{PATH:"C:\\fixture-bin",SystemRoot:"C:\\Windows"},platform:"win32"};
  const toolMocks={"node:child_process":{spawn:fixtureSpawn},"node:fs/promises":{access:async()=>{}}};
  const {runContextTool}=await load("src/main/diagnostics/context-tools.ts",toolMocks,{process:fixtureProcess});
  await runContextTool("nmap-subnet","198.51.100.42",new AbortController().signal);
  assert.equal(launched[0].command,"C:\\fixture-bin\\nmap.exe");assert.deepEqual(Array.from(launched[0].args),["-sn","-n","--max-retries","1","--host-timeout","3s","198.51.100.0/24"]);assert.equal(launched[0].options.shell,false);
  await runContextTool("flush-dns","",new AbortController().signal);assert.equal(launched[1].command,"C:\\Windows\\System32\\ipconfig.exe");assert.deepEqual(Array.from(launched[1].args),["/flushdns"]);
  await assert.rejects(runContextTool("nmap-subnet","example.invalid;whoami",new AbortController().signal),/Invalid/);assert.equal(launched.length,2);
  fixtureProcess.env.PATH="";await assert.rejects(runContextTool("nmap-subnet","198.51.100.42",new AbortController().signal),/not found in PATH/);

  const commands=[],rdpSpawns=[],files=[];
  const execFile=(command,args,options,callback)=>{commands.push({command,args,options});setTimeout(()=>callback(null,"",""),25);return {};};
  const sender=new EventEmitter();sender.isDestroyed=()=>false;sender.send=()=>{};
  const parent={isDestroyed:()=>false,getNativeWindowHandle:()=>Buffer.from([99,0,0,0]),webContents:{isDestroyed:()=>false,invalidate:()=>{}}};
  const rdpMocks={
    electron:{BrowserWindow:{fromWebContents:()=>parent}},
    "node:fs/promises":{access:async()=>{},mkdir:async()=>{},writeFile:async(path,contents)=>files.push(contents),rm:async()=>{}},
    "node:child_process":{execFile,spawn:(...args)=>{rdpSpawns.push(args);const child=new EventEmitter();child.pid=4242;child.exitCode=null;child.kill=()=>true;return child;}},
    "./rdp/native-host":{RdpNativeHost:class {async request(){return {ok:true,found:false};} dispose(){}}},
  };
  const {RdpController}=await load("src/main/rdp.ts",rdpMocks);
  const controller=new RdpController("fixture-userData");
  const config={host:"198.51.100.42",port:3389,username:"TEST%5Cfixture",password:"synthetic-test-value"};
  const id=await controller.connect(config,sender);assert.match(files[0],/full address:s:198\.51\.100\.42\r\n/);assert.equal(rdpSpawns[0][1][1],"/v:198.51.100.42");
  assert(commands[0].args.includes("/user:TEST\\fixture"));controller.disconnect(id);await controller.flush();
  assert(commands.some(c=>c.command.endsWith("taskkill.exe")&&c.args.includes("4242")));assert(commands.some(c=>c.args[0]==="/delete:TERMSRV/198.51.100.42"));
  const racing=controller.connect(config,sender);const rejection=assert.rejects(racing,/cancel/i);
  while(controller.sessions.size===0)await sleep(1);controller.disconnectAll();await rejection;await controller.flush();
  assert.equal(rdpSpawns.length,1,"Cancellation while cmdkey is pending cannot spawn mstsc afterward");
  assert.equal(commands.filter(c=>c.args[0]==="/delete:TERMSRV/198.51.100.42").length,2,"Late credential injection is still cleaned up");

  const {portCheck}=await load("src/main/diagnostics.ts");
  const server=net.createServer(socket=>socket.end());await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const port=server.address().port;
  try {assert.match((await portCheck("127.0.0.1",port)).output,/^Up/);}
  finally {await new Promise(resolve=>server.close(resolve));}
  assert.match((await portCheck("127.0.0.1",port)).output,/^Down/);
  console.log("PASS: RDP addresses/poll deadlines/PID/style/repaint/async credential cleanup, shell-free command arguments, cancellation, bounded output, loopback TCP Up/Down");
})().catch(error=>{console.error(error);process.exitCode=1;});
