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

  const {matchesRdpTitle,RDP_WATCH_INTERVAL_MS}=await load("src/main/rdp/native-protocol.ts");
  assert.equal(RDP_WATCH_INTERVAL_MS,2000);
  for(const [title,host,port,expected] of [
    ["198.51.100.42 - Remote Desktop Connection","198.51.100.42",3389,true],
    ["198.51.100.420 - Remote Desktop Connection","198.51.100.42",3389,false],
    ["notserver.example.invalid - Remote Desktop","server.example.invalid",3389,false],
    ["SERVER.EXAMPLE.INVALID - Remote Desktop","server.example.invalid",3389,true],
    ["[2001:db8::1]:3390 - Remote Desktop","2001:db8::1",3390,true],
    ["[2001:db8::10]:3390 - Remote Desktop","2001:db8::1",3390,false],
    ["server.example.invalid:3391 - Remote Desktop","server.example.invalid",3390,false],
    ["server.example.invalid - Remote Desktop","server.example.invalid",3390,false],
  ])assert.equal(matchesRdpTitle(title,host,port),expected,title);
  const records=[],properties=new Map(),candidates=new Map();
  const funcs={
    EnumWindows: cb=>{for(const candidate of candidates.keys())if(!cb(candidate))break;return true;},
    GetClassNameA:(h,b)=>b.write(candidates.get(h)?.name||""),
    GetWindowTextW:(h,b)=>{const title=candidates.get(h)?.title||"";b.write(title,"utf16le");return title.length;},
    GetPropW:h=>properties.get(h)||null,SetPropW:(h,_key,value)=>{properties.set(h,value);return true;},
    PostMessageW:(...args)=>{records.push(["close",...args]);return true;},
    GetWindowLongPtrA:()=>0x80c40000,
    SetWindowLongPtrA:(...args)=>{records.push(["style",...args]);return 0x80c40000;},
    SetParent:(...args)=>{records.push(["parent",...args]);return 0n;},
    SetWindowPos:(...args)=>{records.push(["position",...args]);return true;},
    UpdateWindow:h=>{records.push(["update",h]);return true;},RedrawWindow:()=>true,
    ShowWindowAsync:()=>true,IsWindow:h=>h===99n||candidates.has(h),IsWindowVisible:()=>true,SetLastError:()=>{},GetLastError:()=>0,
  };
  const koffi={load:()=>({func:(_cc,name)=>funcs[name]}),pointer:()=>"pointer",opaque:()=>"opaque",proto:()=>"callback"};
  const {loadBindings,FRAME_FLAGS}=await load("src/main/rdp/win32.ts",{koffi});
  const native=await loadBindings();
  const rdp={name:"TscShellContainerClass",title:"198.51.100.42 - Remote Desktop Connection"};
  candidates.set(1n,rdp);native.prepare("198.51.100.42",3389,42n);
  assert.equal(native.find([]).found,false,"Pre-existing RDP window is excluded");
  candidates.set(2n,{...rdp,name:"UIMainClass"});candidates.set(3n,{...rdp,title:"198.51.100.420 - Remote Desktop"});
  assert.equal(native.find([]).found,false,"Wrong class and near-matching host rejected");
  candidates.set(4n,rdp);assert.equal(native.find(["4"]).found,false);
  assert.equal(native.find([]).windowHandle,"4");assert.equal(native.claim("4"),true);
  native.dock(99n,{x:7,y:11,width:300,height:200},true);
  const style=records.find(r=>r[0]==="style");assert.equal(style[1],4n);assert.equal(style[3]&0x80000000,0);assert.equal(style[3]&0x00c00000,0);assert.ok(style[3]&0x40000000);
  assert.deepEqual(records.find(r=>r[0]==="parent"),["parent",4n,99n]);
  const positions=records.filter(r=>r[0]==="position");assert.deepEqual(positions.map(r=>r[5]),[301,300]);
  for(const position of positions)assert.equal(position[7]&FRAME_FLAGS,FRAME_FLAGS);
  assert(records.some(r=>r[0]==="update"&&r[1]===4n));assert(records.some(r=>r[0]==="update"&&r[1]===99n));
  candidates.set(4n,{...rdp,title:""});assert.equal(native.alive(),true,"No caption required after docking");
  native.close();assert.deepEqual(records.find(r=>r[0]==="close"),["close",4n,0x10,0,0]);
  properties.delete(4n);assert.equal(native.alive(),false,"Recycled HWND without ownership property rejected");
  native.close();assert.equal(records.filter(r=>r[0]==="close").length,1);
  assert.throws(()=>native.geometry({x:0,y:0,width:1,height:1},true),/no longer/);

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

  const commands=[],rdpSpawns=[],files=[],children=[],hosts=[],statuses=[];
  const execFile=(command,args,options,callback)=>{commands.push({command,args,options});setTimeout(()=>callback(null,"",""),25);return {};};
  const sender=new EventEmitter();sender.isDestroyed=()=>false;sender.send=(_channel,event)=>statuses.push(event);
  const parent={isDestroyed:()=>false,getNativeWindowHandle:()=>Buffer.from([99,0,0,0]),webContents:{isDestroyed:()=>false,invalidate:()=>{}}};
  class NativeFixture {
    alive=true;operations=[];findDelay=0;
    constructor(){hosts.push(this);}
    async request(operation){
      this.operations.push(operation);
      if(operation.op==="find"){if(this.findDelay)await sleep(this.findDelay);const handle=["900","901","902"].find(h=>!operation.excluded.includes(h));return {ok:true,found:Boolean(handle),windowHandle:handle};}
      if(operation.op==="claim")return {ok:true,claimed:true};
      if(operation.op==="watch")return {ok:true,alive:this.alive};
      return {ok:true};
    }
    dispose(){this.disposed=true;}
  }
  const rdpMocks={
    electron:{BrowserWindow:{fromWebContents:()=>parent}},
    "node:fs/promises":{access:async()=>{},mkdir:async()=>{},writeFile:async(path,contents)=>files.push(contents),rm:async()=>{}},
    "node:child_process":{execFile,spawn:(...args)=>{rdpSpawns.push(args);const child=new EventEmitter();child.unref=()=>{};children.push(child);return child;}},
    "./rdp/native-host":{RdpNativeHost:NativeFixture},
  };
  const {RdpController}=await load("src/main/rdp.ts",rdpMocks);
  const controller=new RdpController("fixture-userData");
  const config={host:"198.51.100.42",port:3389,username:"TEST%5Cfixture",password:"synthetic-test-value"};
  const id=await controller.connect(config,sender);
  assert(files[0].includes("full address:s:198.51.100.42\r\n"));assert.equal(rdpSpawns[0][1][1],"/v:198.51.100.42");
  assert(commands[0].args.includes("/user:TEST\\fixture"));
  assert.equal(children[0].listenerCount("exit"),0);assert.equal(children[0].listenerCount("close"),0);
  children[0].emit("exit",0);children[0].emit("close",0);await sleep(350);
  assert(controller.sessions.get(id).hostReady,"Launcher exit must not terminate attachment");
  assert(statuses.some(s=>s.sessionId===id&&s.status==="running"));
  assert(!statuses.some(s=>s.sessionId===id&&s.status==="closed"));
  hosts[0].alive=false;await sleep(2100);await controller.flush();
  assert.equal(controller.sessions.has(id),false);assert.equal(statuses.filter(s=>s.sessionId===id&&s.status==="closed").length,1);
  assert.equal(controller.claimedWindows.size,0);assert(hosts[0].disposed);
  const pair=await Promise.all([controller.connect(config,sender),controller.connect(config,sender)]);
  await sleep(700);assert.equal(controller.claimedWindows.size,2,"Concurrent tabs cannot own the same HWND");
  controller.disconnectAll();await controller.flush();assert.equal(controller.claimedWindows.size,0);
  assert(hosts.slice(1).every(h=>h.operations.some(o=>o.op==="close")&&h.disposed));
  const racing=controller.connect(config,sender);const rejection=assert.rejects(racing,/cancel|closed/i);
  while(commands.filter(c=>c.args[0].startsWith("/generic:")).length<4)await sleep(1);
  controller.disconnectAll();await rejection;await controller.flush();
  assert.equal(rdpSpawns.length,3,"Cancellation while cmdkey is pending cannot spawn mstsc afterward");
  assert.equal(commands.filter(c=>c.args[0]==="/delete:TERMSRV/198.51.100.42").length,4);
  assert(!commands.some(c=>c.command.endsWith("taskkill.exe")),"No stale PID termination");
  const late=await controller.connect(config,sender);const lateHost=hosts.at(-1);lateHost.findDelay=700;
  while(!lateHost.operations.some(o=>o.op==="find"))await sleep(5);
  controller.disconnect(late);await controller.flush();
  assert.equal(lateHost.operations.filter(o=>o.op==="find").length,1,"Cancellation reuses the in-flight HWND search");
  assert.equal(lateHost.operations.filter(o=>o.op==="claim").length,1);
  assert.equal(lateHost.operations.filter(o=>o.op==="close").length,1);
  assert.equal(controller.claimedWindows.size,0);assert(lateHost.disposed);
  assert(!statuses.some(s=>s.sessionId===late&&s.status==="running"));
  const {portCheck}=await load("src/main/diagnostics.ts");
  const server=net.createServer(socket=>socket.end());await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const port=server.address().port;
  try {assert.match((await portCheck("127.0.0.1",port)).output,/^Up/);}
  finally {await new Promise(resolve=>server.close(resolve));}
  assert.match((await portCheck("127.0.0.1",port)).output,/^Down/);
  console.log("PASS: RDP title/class/ownership and recycled-handle guards, ghost launcher exits, 2s window lifecycle, concurrent claims, async cleanup, shell-free diagnostics, bounded output, loopback TCP");
})().catch(error=>{console.error(error);process.exit(1);});
