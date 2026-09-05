const assert = require("node:assert/strict");
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");

module.exports = async ({window, channels, evaluate, until, sleep, root}) => {
  const palettes = ["midnight", "snowblind", "vampire", "deep-sea", "matrix", "neon-synth"];
  assert.deepEqual(await evaluate('[...document.getElementById("theme-mode").options].map(o=>o.value)'), [...palettes,"custom"]);
  for (const theme of palettes) {
    await evaluate(`window.__terminalTest.applySettings({...window.__terminalTest.currentSettings,theme:${JSON.stringify(theme)}})`);
    window.webContents.send(channels.appUpdateStatus,{stage:"up-to-date",message:"CyberGrid is up to date."});
    await until('document.getElementById("global-modal").open');
    assert.equal(await evaluate('getComputedStyle(document.getElementById("global-modal")).backgroundColor===getComputedStyle(document.querySelector(".sidebar")).backgroundColor'),true);
    assert.equal(await evaluate('document.getElementById("global-modal").contains(document.activeElement)'),true);
    if (theme === "snowblind" || theme === "vampire") {
      let image;
      const capture = (_e,_d,frame) => { image=frame; };
      window.webContents.on("paint",capture); window.webContents.invalidate();
      await sleep(300); window.webContents.removeListener("paint",capture);
      assert(image); writeFileSync(join(root,`build/theme-${theme}-test.png`),image.toPNG());
    }
    await evaluate('document.querySelector("#global-modal button").click()');
    await until('!document.getElementById("global-modal").open');
  }
  window.webContents.send(channels.appUpdateAvailable,{version:'1.3.9 <img src=x onerror="alert(1)">'});
  await until('document.getElementById("global-modal").open');
  assert.equal(await evaluate('document.querySelectorAll("#global-modal img").length'),0);
  await sleep(3100);
  assert.equal(await evaluate('document.getElementById("global-modal").open'),true,"Actionable prompts stay open");
  window.webContents.sendInputEvent({type:"keyDown",keyCode:"Escape"});
  window.webContents.sendInputEvent({type:"keyUp",keyCode:"Escape"});
  await until('!document.getElementById("global-modal").open');
  window.webContents.send(channels.appUpdateDownloaded,{version:"1.3.9"});
  await until('document.getElementById("global-modal-title").textContent==="Restart required"');
  assert.equal(await evaluate('document.querySelector("#global-modal .primary-button").textContent'),"Restart now");
  window.webContents.sendInputEvent({type:"mouseDown",x:1,y:1,button:"left",clickCount:1});
  window.webContents.sendInputEvent({type:"mouseUp",x:1,y:1,button:"left",clickCount:1});
  await until('!document.getElementById("global-modal").open');
  window.webContents.send(channels.appUpdateStatus,{stage:"checking",message:"Legacy verbose message"});
  await until('document.querySelector("[data-update-status]")?.textContent==="Checking for updates..."');
  await sleep(3100);
  assert.equal(await evaluate('Boolean(document.querySelector("[data-update-status]"))'),false);
  window.webContents.send(channels.appUpdateStatus,{stage:"download-progress",message:"Downloading update...",percent:5});
  await until('Boolean(document.querySelector("[data-update-status] progress"))');
  await sleep(3100);
  window.webContents.send(channels.appUpdateStatus,{stage:"download-progress",message:"Downloading update...",percent:95});
  await sleep(100);
  assert.equal(await evaluate('Boolean(document.querySelector("[data-update-status]"))'),false,"Progress does not resurrect dismissed banners");
  window.webContents.send(channels.appUpdateStatus,{stage:"error",message:"Offline test",interactive:true});
  await until('document.getElementById("global-modal-title").textContent==="Update unavailable"');
  await evaluate('document.querySelector("#global-modal button").click()');
  await until('!document.getElementById("global-modal").open');
  await evaluate('window.treeOriginal=document.getElementById("profile-tree").innerHTML;const tree=document.getElementById("profile-tree");for(let i=0;i<300;i++){const row=document.createElement("div");row.textContent="Overflow fixture "+i;row.style.height="22px";tree.append(row)}');
  for (const [width,height] of [[980,650],[1280,850]]) {
    window.setSize(width,height); await sleep(200);
    for(const expanded of [false,true]) {
      await evaluate(`document.querySelector(".sidebar-footer details").open=${expanded}`);
      const geometry = await evaluate('(()=>{const tree=document.getElementById("sidebar-container");const footer=document.querySelector(".sidebar-footer");const lock=document.getElementById("lock-button");tree.scrollTop=400;return {scrollHeight:tree.scrollHeight,clientHeight:tree.clientHeight,scrollTop:tree.scrollTop,treeBottom:tree.getBoundingClientRect().bottom,footerTop:footer.getBoundingClientRect().top,lockBottom:lock.getBoundingClientRect().bottom,innerHeight,scrollWidth:tree.scrollWidth,clientWidth:tree.clientWidth}})()');
      assert(geometry.scrollHeight>geometry.clientHeight&&geometry.scrollTop>0&&geometry.treeBottom<=geometry.footerTop+1&&geometry.lockBottom<=geometry.innerHeight&&geometry.scrollWidth<=geometry.clientWidth,JSON.stringify({width,height,expanded,geometry}));
    }
  }
  await evaluate('document.getElementById("profile-tree").innerHTML=window.treeOriginal');
};
