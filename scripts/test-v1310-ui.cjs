const assert=require('node:assert/strict');
const {join}=require('node:path');
module.exports=async({window,evaluate,sleep,root,writes,captureFrame})=>{
  await evaluate('document.getElementById("server-context-menu").hidden=true;window.deepProfiles=Array.from({length:120},(_,i)=>({...window.fixtureProfile,id:crypto.randomUUID(),name:`Server ${i} with a very long hostname`,group:Array.from({length:25},(_,d)=>`Long nested folder ${d}`).join("/")}));window.__terminalTest.setProfiles(window.deepProfiles)');
  for(const compact of [true,false])for(const width of [200,320,600]){
    await evaluate(`document.documentElement.dataset.compactTree="${compact}";document.documentElement.style.setProperty("--sidebar-width","${width}px");document.getElementById("sidebar-container").scrollTop=0`);
    await sleep(50);
    const layout=await evaluate('(()=>{const s=document.getElementById("sidebar-container"),rows=[...document.querySelectorAll(".folder-header")];return {overflow:s.scrollWidth>s.clientWidth,rows:rows.map(r=>{const b=r.querySelector(".folder-count-badge"),c=r.querySelector(".folder-content"),name=r.querySelector(".folder-name");return {display:getComputedStyle(r).display,position:getComputedStyle(b).position,right:b.getBoundingClientRect().right,contained:b.getBoundingClientRect().right<=r.getBoundingClientRect().right,contentRight:c.getBoundingClientRect().right,badgeLeft:b.getBoundingClientRect().left,title:name.textContent,count:b.textContent}})}})()');
    assert.equal(layout.overflow,false);assert.equal(layout.rows.length,25);
    assert(layout.rows.every(r=>r.display==='flex'&&r.position==='static'&&r.contained&&r.contentRight<=r.badgeLeft&&r.count==='120'));
    assert(Math.max(...layout.rows.map(r=>r.right))-Math.min(...layout.rows.map(r=>r.right))<2);
    await evaluate('document.getElementById("sidebar-container").scrollTop=400;window.scrollBefore=document.getElementById("sidebar-container").scrollTop;document.querySelector(".server-item").click()');
    assert.equal(await evaluate('document.getElementById("sidebar-container").scrollTop===window.scrollBefore'),true);
  }
  await evaluate('document.documentElement.dataset.compactTree="true";document.documentElement.style.setProperty("--sidebar-width","260px");document.getElementById("sidebar-container").scrollTop=0');
  await captureFrame(join(root,'build/flexbox-badges-test.png'));
  await evaluate('window.macroTab=window.__terminalTest.createTerminalTab("Macro fixture","local");window.macroTab.localSessionId="macro-local";window.macroTab.status="connected";window.macroTab.setSwitchToolsOpen(true)');
  for(const [vendor,commands] of [['windows',['ipconfig /all','netstat -ano','Get-Process']],['fortinet',['get system status','diagnose sys top']],['paloalto',['show routing table']]]){
    await evaluate(`window.macroTab.switchToolsSelect.value=${JSON.stringify(vendor)};window.macroTab.switchToolsSelect.dispatchEvent(new Event('change'))`);
    for(const command of commands){
      const found=await evaluate(`(()=>{const b=[...window.macroTab.paneElement.querySelectorAll('.switch-tools-dynamic button')].find(b=>b.textContent===${JSON.stringify(command)});if(!b)return false;const valid=Boolean(b.title)&&!b.disabled;b.click();return valid})()`);
      assert(found,command);await sleep(20);assert(writes.some(w=>w.sessionId==='macro-local'&&w.data.includes(command)),command);
    }
  }
  await evaluate('window.__terminalTest.closeTab(window.macroTab.id);window.rdpFixture=window.__terminalTest.createRdpTab("RDP fixture",{host:"rdp.example.invalid",port:3389,username:""});window.__terminalTest.attachRdpSession(window.rdpFixture,"rdp-fixture");window.__terminalTest.handleRdpStatus({sessionId:"rdp-fixture",status:"running"});window.__terminalTest.handleRdpStatus({sessionId:"rdp-fixture",status:"closed"});window.__terminalTest.handleRdpStatus({sessionId:"rdp-fixture",status:"closed"})');
  assert.equal(await evaluate('window.__terminalTest.tabs.has(window.rdpFixture.id)||window.__terminalTest.rdpSessions.has("rdp-fixture")||window.__terminalTest.queuedRdpStatus.has("rdp-fixture")'),false);
  await evaluate('window.rdpEarly=window.__terminalTest.createRdpTab("Early close",{host:"rdp.example.invalid",port:3389,username:""});window.__terminalTest.closeTab(window.rdpEarly.id);window.__terminalTest.attachRdpSession(window.rdpEarly,"rdp-late-fixture")');
  assert.equal(await evaluate('window.__terminalTest.rdpSessions.has("rdp-late-fixture")'),false);
  await evaluate('window.rdpQueued=window.__terminalTest.createRdpTab("Queued close",{host:"rdp.example.invalid",port:3389,username:""});window.__terminalTest.handleRdpStatus({sessionId:"rdp-queued-fixture",status:"closed"});window.__terminalTest.attachRdpSession(window.rdpQueued,"rdp-queued-fixture")');
  assert.equal(await evaluate('window.__terminalTest.tabs.has(window.rdpQueued.id)||window.__terminalTest.rdpSessions.has("rdp-queued-fixture")'),false);
  console.log('PASS: 25-level Flexbox badges/3-digit counts/scroll preservation, Windows/FortiOS/PAN-OS macros, clean RDP tab closure and late IPC races');
};
