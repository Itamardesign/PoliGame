import {chromium} from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true,executablePath:'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--enable-unsafe-swiftshader']});
const baseUrl=process.env.KART_BASE_URL??'http://127.0.0.1:4173';
try{
 for(const {width,height} of [{width:320,height:640},{width:390,height:844},{width:844,height:390}]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(baseUrl);await page.waitForFunction(()=>window.readKartState);
  await page.locator('#play').tap();await page.waitForFunction(()=>readKartState().state==='running');
  const layout=await page.evaluate(()=>{
   const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
   return{arena:rect('#arena'),buttons:[...document.querySelectorAll('#touch button')].map(b=>({key:b.dataset.key,...rect(`#touch [data-key="${b.dataset.key}"]`)})),hidden:['#leaderboard','.map-wrap','.sector-badge','.camera-toggle','.driver-bubble'].every(s=>getComputedStyle(document.querySelector(s)).display==='none'),overflow:getComputedStyle(document.body).overflow,scrollWidth:document.documentElement.scrollWidth};
  });
  assert.equal(layout.arena.x,0);assert.equal(layout.arena.y,0);assert.equal(layout.arena.width,width);assert.equal(layout.arena.height,height);
  assert.equal(layout.hidden,true);assert.equal(layout.overflow,'hidden');assert.ok(layout.scrollWidth<=width);
  for(const b of layout.buttons){assert.ok(b.width>=44&&b.height>=44,`${b.key} too small`);assert.ok(b.x>=0&&b.y>=0&&b.right<=width&&b.bottom<=height,`${b.key} outside viewport`);}
  for(let i=0;i<layout.buttons.length;i++)for(let j=i+1;j<layout.buttons.length;j++){const a=layout.buttons[i],b=layout.buttons[j];assert.ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,`${a.key} overlaps ${b.key}`);}
  await page.screenshot({path:`test-results/kart-layout-${width}x${height}.png`});
  assert.deepEqual(errors,[]);await page.close();
 }
 const desktop=await browser.newPage({viewport:{width:1440,height:900}});
 await desktop.goto(baseUrl);await desktop.waitForFunction(()=>window.readKartState);
 await desktop.locator('#play').click();await desktop.waitForFunction(()=>readKartState().state==='running');
 assert.equal(await desktop.locator('#arena').evaluate(el=>getComputedStyle(el).position),'relative');
 assert.equal(await desktop.locator('#leaderboard').isVisible(),true);
 assert.equal(await desktop.locator('#touch').isVisible(),false);
 assert.equal(await desktop.locator('.touch-guide').first().isVisible(),false);
 await desktop.locator('#help').click();assert.match(await desktop.locator('#infoContent').innerText(),/Shift/);
 console.log('PASS full-viewport phone layouts and unchanged desktop HUD');
}finally{await browser.close();}
