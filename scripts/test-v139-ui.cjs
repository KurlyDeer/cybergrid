const assert=require("node:assert/strict");
const {join}=require("node:path");
module.exports=async({window,evaluate,until,sleep,root,contextRequests,contextCancels,pendingContexts,captureFrame})=>{
  await evaluate('for(const d of document.querySelectorAll("dialog[open]"))d.close();document.documentElement.dataset.theme="midnight";window.fixtureProfile={id:"11111111-1111-4111-8111-111111111111",name:"Extremely long server name for nested badge regression",host:"198.51.100.42",port:3389,username:"",protocol:"rdp",icon:"windows",category:"server",tags:[],group:"Infrastructure/Hyper-V/Cluster/Region/Site/Rack/Hosts/Children/Very long nested folder",favorite:false};window.__terminalTest.setProfiles([window.fixtureProfile,{...window.fixtureProfile,id:"22222222-2222-4222-8222-222222222222",name:"Another fixture",group:"Infrastructure/Hyper-V"}]);');
  window.setSize(1280,850);
  for(const compact of [true,false])for(const width of [200,320,600]){
    await evaluate(`document.documentElement.dataset.compactTree="${compact}";document.documentElement.style.setProperty("--sidebar-width","${width}px")`);
    await sleep(60);
    const layout=await evaluate('(()=>{const rows=[...document.querySelectorAll(".folder-header")];const sidebar=document.getElementById("sidebar-container");return {rows:rows.map(row=>{const r=row.getBoundingClientRect(),b=row.querySelector(".folder-count-badge").getBoundingClientRect();return {right:r.right,badgeRight:b.right,centerDelta:Math.abs((b.top+b.bottom-r.top-r.bottom)/2),visible:b.right<=sidebar.getBoundingClientRect().right}}),overflow:sidebar.scrollWidth>sidebar.clientWidth};})()');
    assert(layout.rows.length>=9);
    assert(Math.max(...layout.rows.map(r=>r.badgeRight))-Math.min(...layout.rows.map(r=>r.badgeRight))<2,`Badges aligned at ${width}px, compact=${compact}`);
    assert(layout.rows.every(r=>r.visible&&r.centerDelta<1.5));assert.equal(layout.overflow,false);
  }
  await evaluate('document.documentElement.dataset.compactTree="true";document.documentElement.style.setProperty("--sidebar-width","260px")');
  await captureFrame(join(root,"build/nested-badges-test.png"));
  await evaluate('window.__terminalTest.openServerContextMenu(new MouseEvent("contextmenu",{clientX:160,clientY:260}),window.fixtureProfile)');
  for(const label of ["Check TCP Port Status","Flush DNS (Local)","Nmap Subnet Scan"]){
    assert.equal(await evaluate(`[...document.querySelectorAll("#server-context-menu button")].some(b=>b.textContent===${JSON.stringify(label)}&&!b.disabled)`),true);
  }
  await evaluate('[...document.querySelectorAll("#server-context-menu button")].find(b=>b.textContent==="Nmap Subnet Scan").click()');
  await until('[...window.__terminalTest.tabs.values()].some(t=>t.kind==="diagnostic")');
  await sleep(60);const request=contextRequests.at(-1);assert.equal(request[0],"11111111-1111-4111-8111-111111111111");assert.equal(request[1],"nmap-subnet");
  assert.equal(await evaluate('(()=>{const t=[...window.__terminalTest.tabs.values()].find(t=>t.kind==="diagnostic");return t.terminal.options.disableStdin&&!t.sessionId&&!t.profileId})()'),true);
  pendingContexts.get(request[2])({success:true,summary:"Fixture Nmap complete",output:"Fixture host discovery\n198.51.100.0/24"});pendingContexts.delete(request[2]);
  await until('[...window.__terminalTest.tabs.values()].some(t=>t.kind==="diagnostic"&&t.status==="ready")');
  await evaluate('window.__terminalTest.closeTab([...window.__terminalTest.tabs.values()].find(t=>t.kind==="diagnostic").id);void window.__terminalTest.executeContextTool(window.fixtureProfile,"flush-dns")');
  await sleep(60);const flush=contextRequests.at(-1);assert.equal(flush[1],"flush-dns");
  await evaluate('window.__terminalTest.closeTab([...window.__terminalTest.tabs.values()].find(t=>t.kind==="diagnostic").id)');
  await sleep(60);assert(contextCancels.includes(flush[2]));
  await evaluate('window.__terminalTest.openServerContextMenu(new MouseEvent("contextmenu",{clientX:100,clientY:100}),{...window.fixtureProfile,protocol:"serial"})');
  assert.equal(await evaluate('[...document.querySelectorAll("#server-context-menu button")].filter(b=>["Nmap Subnet Scan","Check TCP Port Status"].includes(b.textContent)).every(b=>b.disabled)'),true);
  console.log("PASS: nested badge alignment at 200/320/600px, compact/full tree, context menu IPC, read-only diagnostic tab, cancellation on close");
};
