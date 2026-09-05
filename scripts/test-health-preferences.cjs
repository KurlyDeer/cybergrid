const assert = require("node:assert/strict");
const { buildSync, build } = require("esbuild");
const Module = require("node:module");
const { EventEmitter } = require("node:events");
const { mkdtemp, readFile, writeFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { createServer } = require("node:net");
const vm = require("node:vm");
function load(file) {
  const path = resolve(file);
  const output = buildSync({ entryPoints: [path], bundle: true, platform: "node", format: "cjs", write: false });
  const mod = new Module(path, module); mod.paths = module.paths;
  mod._compile(output.outputFiles[0].text, path); return mod.exports;
}
(async () => {
  const { checkTcpPort, healthPort, HEALTH_TIMEOUT_MS, HEALTH_INTERVAL_SECONDS } = load("src/main/health.ts");
  assert.equal(HEALTH_TIMEOUT_MS, 1500); assert.equal(HEALTH_INTERVAL_SECONDS, 45);
  for (const [protocol, port] of [["ssh",22],["rdp",3389],["https",443],["http",80]]) assert.equal(healthPort({host:"localhost",protocol}),port);
  assert.equal(healthPort({host:"localhost",protocol:"https",port:8006}),8006);
  assert.equal(healthPort({host:"COM1",protocol:"serial"}),undefined);
  assert.equal(healthPort({host:"powershell",protocol:"local"}),undefined);
  const server = createServer(socket => socket.end());
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  const port = server.address().port;
  assert.equal(typeof await checkTcpPort("127.0.0.1",port),"number");
  await new Promise(resolve => server.close(resolve));
  assert.equal(await checkTcpPort("127.0.0.1",port),undefined);

  const directory=await mkdtemp(join(tmpdir(),"cybergrid-preferences-test-"));
  try {
    const {PreferencesController,DEFAULT_APP_PREFERENCES:defaults}=load("src/main/preferences.ts");
    const path=join(directory,"preferences.json");
    const preferences=new PreferencesController(path);
    for(const height of [0.5,1.18,3]) {
      await preferences.save({...defaults,terminalLineHeight:height,theme:"dracula"});
      const loaded=await new PreferencesController(path).load();
      assert.equal(loaded.terminalLineHeight,height); assert.equal(loaded.theme,"dracula");
    }
    const old=JSON.parse(await readFile(path,"utf8")); old.version=3; old.preferences.healthCheckIntervalSeconds=30;
    await writeFile(path,JSON.stringify(old));
    assert.equal((await new PreferencesController(path).load()).healthCheckIntervalSeconds,45);
    const blockedParent=join(directory,"parent-is-a-file");
    await writeFile(blockedParent,"test fixture");
    const blocked=new PreferencesController(join(blockedParent,"preferences.json"));
    await assert.rejects(blocked.save({...defaults,theme:"light"}));
    assert.equal(blocked.get().theme,defaults.theme);
  } finally { await rm(directory,{recursive:true,force:true}); }

  // Simulate sockets which never connect to test the absolute deadline and queue cap.
  let active=0,maximum=0;
  class FakeSocket extends EventEmitter {
    connect() {active++;maximum=Math.max(maximum,active);this.open=true;return this;}
    setTimeout() {return this;}
    destroy() {if(this.open){this.open=false;active--;}return this;}
  }
  const output=await build({entryPoints:["src/main/health.ts"],bundle:true,platform:"node",format:"cjs",write:false,
    plugins:[{name:"test-net",setup(b){b.onResolve({filter:/^node:net$/},()=>({path:"net",namespace:"test"}));b.onLoad({filter:/.*/,namespace:"test"},()=>({contents:"export const Socket=globalThis.FakeSocket;",loader:"js"}));}}]});
  const context={module:{exports:{}},require,FakeSocket,setTimeout,clearTimeout,setInterval,clearInterval,AbortController};context.exports=context.module.exports;
  vm.runInNewContext(output.outputFiles[0].text,context);
  const api=context.module.exports;
  const started=Date.now();
  // Keep one test timer referenced: production health timers intentionally unref.
  const keepAlive=setTimeout(()=>{},2500);
  assert.equal(await api.checkTcpPort("test.invalid",22),undefined);
  clearTimeout(keepAlive);assert(Date.now()-started>=1400);assert.equal(active,0);
  const sender=new EventEmitter(); const events=[];sender.isDestroyed=()=>false;sender.send=(_channel,event)=>events.push(event);
  const controller=new api.HealthController();
  controller.setTargets(Array.from({length:40},(_,i)=>({profileId:String(i),host:"test.invalid",protocol:"ssh"})),sender);
  assert.equal(maximum,8);assert.equal(active,8);
  controller.stop(); await new Promise(resolve=>setImmediate(resolve));
  assert.equal(active,0);assert(events.every(event=>event.status==="checking"));
  console.log("PASS: live loopback TCP, closed port, protocol/custom ports, 1500ms deadline, 8-socket cap, stop cancellation, settings save/reload and migration");
})().catch(error=>{console.error(error);process.exitCode=1;});
