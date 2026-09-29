import {chromium} from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true,executablePath:'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--enable-unsafe-swiftshader']});
const baseUrl=process.env.KART_BASE_URL??'http://127.0.0.1:4173';
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(baseUrl);await page.waitForFunction(()=>window.readKartState);
 await page.locator('#help').tap();
 const help=await page.locator('#infoContent').innerText();
 assert.match(help,/געו במקום פנוי במסלול/);assert.doesNotMatch(help,/Shift|SHIFT|Alt|ALT|WASD|רווח/);
 await page.screenshot({path:'test-results/kart-mobile-help.png'});
 await page.locator('#closeInfo').tap();
 assert.equal(await page.locator('.touch-guide').first().isVisible(),true);
 assert.equal(await page.locator('.desktop-guide').first().isVisible(),false);
 await page.locator('#play').tap();await page.waitForFunction(()=>readKartState().state==='running');
 let direction='';
 for(let i=0;i<220;i++){
  const player=await page.evaluate(()=>readKartState().race.racers[0]);
  if(player.item)break;
  const next=player.x<-.3?'ArrowRight':player.x>.3?'ArrowLeft':'';
  if(next!==direction){if(direction)await page.keyboard.up(direction);if(next)await page.keyboard.down(next);direction=next;}
  await page.waitForTimeout(70);
 }
 if(direction)await page.keyboard.up(direction);
 const before=await page.evaluate(()=>readKartState());
 assert.ok(before.race.racers[0].item,'failed to collect a power item');
 assert.equal(await page.locator('#arena').evaluate(el=>el.classList.contains('item-ready')),true);
 assert.equal(await page.locator('#item').isVisible(),true);
 assert.match(await page.locator('#item').evaluate(el=>getComputedStyle(el,'::after').content),/געו במסלול/);
 await page.screenshot({path:'test-results/kart-power-ready.png'});
 await page.locator('#game').tap({position:{x:195,y:300}});
 await page.waitForFunction(()=>readKartState().race.racers[0].item===null);
 assert.equal(await page.locator('#arena').evaluate(el=>el.classList.contains('item-ready')),false);
 assert.ok((await page.evaluate(()=>readKartState().race.events)).some(e=>e.type==='item-use'));
 assert.deepEqual(errors,[]);
 console.log('PASS mobile power cue, touch guidance, and track tap activation');
}finally{await browser.close();}
