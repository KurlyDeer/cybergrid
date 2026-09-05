// Loopback and in-memory fixtures only. No real vault, remote hosts, or browser launch.
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const { resolve } = require('node:path');
const { EventEmitter } = require('node:events');
const net = require('node:net');
const dns = require('node:dns/promises');
function load(file, mocks = {}) {
  const filename = resolve(file);
  const source = buildSync({ entryPoints: [filename], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
  const mod = new Module(filename, module); mod.paths = module.paths;
  const nativeRequire = mod.require.bind(mod);
  mod.require = name => mocks[name] ?? nativeRequire(name);
  mod._compile(source, filename); return mod.exports;
}
(async () => {
  const suite = load('src/main/diagnostics/suite.ts');
  for (const target of ['https://example.com', 'user@example.com', '-bad', 'host;command', '127.0.0.1/path']) assert.throws(() => suite.normalizeDiagnosticRequest({ kind:'tcp', target, port:22 }));
  for (const port of [0, 65536, 1.2, '22']) assert.throws(() => suite.normalizeDiagnosticRequest({ kind:'tcp', target:'localhost', port }));
  assert.equal(suite.normalizeDiagnosticRequest({kind:'tls',target:'[::1]',port:443}).target,'::1');
  assert.throws(() => suite.normalizeDiagnosticRequest({kind:'dns',target:'example.com',dnsServer:'attacker.example'}));
  const server = net.createServer(socket => socket.end());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  assert.equal((await suite.runGlobalDiagnostic({ kind:'tcp', target:'127.0.0.1', port })).success, true);
  await new Promise(resolve => server.close(resolve));
  const refused = await suite.runGlobalDiagnostic({ kind:'tcp', target:'127.0.0.1', port });
  assert.equal(refused.success, false); assert.equal(refused.code, 'ECONNREFUSED');
  class HungSocket extends EventEmitter {
    static sockets = [];
    constructor() { super(); HungSocket.sockets.push(this); }
    connect() { return this; }
    setTimeout(ms) { this.timeout = ms; }
    destroy() { this.destroyed = true; }
  }
  const hung = load('src/main/diagnostics/suite.ts', {'node:net': {...net, Socket: HungSocket}});
  const timeout = await hung.runGlobalDiagnostic({kind:'tcp',target:'example.invalid',port:8006});
  assert.equal(timeout.code, 'ETIMEDOUT'); assert.equal(HungSocket.sockets[0].destroyed, true);
  const abort = new AbortController();
  const pending = hung.runGlobalDiagnostic({kind:'tcp',target:'example.invalid',port:22}, abort.signal);
  abort.abort(); assert.equal((await pending).code, 'ECANCELED'); assert.equal(HungSocket.sockets[1].destroyed,true);
  for (const mac of ['00:00:0c:12:34:56','0000.0c12.3456','00000C123456','00-00-0c-12-34-56']) assert.match(suite.lookupMac(mac).summary, /Cisco/);
  assert.match(suite.lookupMac('00:14:22:12:34:56').summary,/Dell/);
  assert.match(suite.lookupMac('00:11:0A:12:34:56').summary,/Hewlett/);
  assert.match(suite.lookupMac('00:17:F2:12:34:56').summary,/Apple/);
  assert.match(suite.lookupMac('02:00:0C:12:34:56').summary,/Locally administered/);
  assert.match(suite.lookupMac('01:00:0C:12:34:56').summary,/Multicast/);
  assert.throws(() => suite.lookupMac('00:00:0C:xx:00:00'));
  const cert = { raw:Buffer.from('fixture'), subject:{CN:'example.invalid'},issuer:{CN:'Fixture CA'},valid_from:'Jan 1 00:00:00 2026 GMT',valid_to:'Sep 20 00:00:00 2026 GMT',subjectaltname:'DNS:example.invalid',fingerprint256:'fixture' };
  const rows = suite.certificateRows(cert,false,'SELF_SIGNED',Date.parse('2026-09-05'));
  assert.equal(rows.find(r=>r.label==='Valid until').warning,true);
  assert.equal(rows.find(r=>r.label==='Trust / hostname').warning,true);
  assert.equal(suite.certificateRows(cert,false,'SELF_SIGNED',Date.parse('2027-01-01')).find(r=>r.label==='Expiry').value,'EXPIRED');
  let tlsOptions;
  let tlsSocket;
  const tlsSuite = load('src/main/diagnostics/suite.ts', {'node:tls': {
    connect: options => { tlsOptions=options; tlsSocket=new HungSocket(); tlsSocket.getPeerCertificate=()=>cert; tlsSocket.authorized=false; tlsSocket.authorizationError='SELF_SIGNED'; setImmediate(()=>tlsSocket.emit('secureConnect')); return tlsSocket; },
    checkServerIdentity: () => undefined,
  }});
  assert.equal((await tlsSuite.runGlobalDiagnostic({kind:'tls',target:'example.invalid',port:443})).success,true);
  assert.equal(tlsOptions.rejectUnauthorized,false); assert.equal(tlsOptions.servername,'example.invalid'); assert.equal(tlsSocket.destroyed,true);
  let resolver;
  const originalServers=dns.getServers();
  class TestResolver {
    constructor(options) { this.options=options; this.servers=['127.0.0.1']; resolver=this; }
    setServers(value) { this.servers=value; }
    getServers() { return this.servers; }
    async resolveAny(target) { this.target=target; return [{type:'A',address:'192.0.2.1',ttl:60},{type:'TXT',entries:['fixture']}]; }
    cancel() { this.cancelled=true; }
  }
  const dnsSuite=load('src/main/diagnostics/suite.ts', {'node:dns/promises':{Resolver:TestResolver}});
  const dnsResult=await dnsSuite.runGlobalDiagnostic({kind:'dns',target:'example.invalid',dnsServer:'192.0.2.53'});
  assert.equal(dnsResult.success,true); assert.deepEqual(resolver.servers,['192.0.2.53']); assert.equal(resolver.target,'example.invalid'); assert.equal(resolver.cancelled,true); assert.deepEqual(dns.getServers(),originalServers);
  class CancelResolver extends TestResolver {
    resolveAny() { return new Promise((_resolve,reject)=>{this.reject=reject;}); }
    cancel() { this.reject?.(Object.assign(new Error('cancelled'),{code:'ECANCELLED'})); }
  }
  const cancelledDns=load('src/main/diagnostics/suite.ts',{'node:dns/promises':{Resolver:CancelResolver}});
  const cancel=new AbortController(); const query=cancelledDns.runGlobalDiagnostic({kind:'dns',target:'example.invalid'},cancel.signal); cancel.abort(); assert.equal((await query).code,'ECANCELLED');

  const { RollingErrorBuffer, redactReportText, buildReport, BugReporter } = load('src/main/bug-report.ts');
  const buffer=new RollingErrorBuffer();
  for(let i=0;i<60;i++) buffer.capture(`line-${i}`);
  assert.equal(buffer.snapshot().length,50); assert.match(buffer.snapshot()[0],/line-10/);
  const circular={}; circular.self=circular; buffer.capture(circular);
  const fixture='sensitive-fixture';
  for (const text of [`password="${fixture}"`,`{ "token": "${fixture}" }`,`Bearer ${fixture}`,`https://user:${fixture}@example.invalid`,`/pass:"${fixture}"`,`-----BEGIN PRIVATE KEY-----\n${fixture}\n-----END PRIVATE KEY-----`]) assert.equal(redactReportText(text).includes(fixture),false,text);
  assert.equal(redactReportText('C:\\Users\\fixture-user\\logs 192.0.2.1').includes('fixture-user'),false);
  assert.equal(redactReportText('```log').includes('`'),false);
  const environment={version:'1.3.7',systemVersion:'Windows fixture',osRelease:'fixture',platform:'win32',arch:'x64',memory:{rss:10485760,heapUsed:1048576,heapTotal:2097152}};
  const report=buildReport('emoji description '.repeat(100),environment,buffer.snapshot());
  assert.ok(report.url.length<=2000); assert.equal(report.truncated,true);
  assert.equal(new URL(report.url).searchParams.get('body'),report.markdown);
  assert.match(report.fullMarkdown,/line-59/); assert.match(report.markdown,/RSS/);
  const reporter=new BugReporter(buffer,()=>environment); let opened;
  const preview=reporter.preview(1,'Local fixture');
  await assert.rejects(()=>reporter.send(2,preview.id,async()=>{}));
  await assert.rejects(()=>reporter.send(1,'wrong',async()=>{}));
  await reporter.send(1,preview.id,async url=>{opened=url;});
  assert.equal(new URL(opened).origin,'https://github.com'); assert.equal(new URL(opened).searchParams.get('body'),preview.markdown);
  await assert.rejects(()=>reporter.send(1,preview.id,async()=>{}));
  assert.throws(()=>reporter.preview(1,'x'.repeat(2001)));
  const old=reporter.preview(1,'old'); reporter.preview(1,'new'); await assert.rejects(()=>reporter.send(1,old.id,async()=>{}));
  const before=console.error; const restore=buffer.install(); assert.notEqual(console.error,before); restore(); assert.equal(console.error,before);
  console.log('PASS: TCP loopback/refusal/deadline/cancel, isolated DNS arrays/cancel, TLS inspection/trust/expiry, offline OUI, 50-line redacted buffer, bounded preview URL and sender-bound reporting');
})().catch(error=>{console.error(error);process.exitCode=1;});
