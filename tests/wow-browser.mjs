import {chromium} from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {makeTrack} from '../dist/kart-world.js';
import {makeShortcuts,routeBend} from '../dist/kart-routes.js';
const track=makeTrack();track.shortcuts=makeShortcuts(track);
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.readKartState);await page.locator('#play').click();await page.waitForFunction(()=>readKartState().countdown<1.1&&readKartState().countdown>.5);await page.keyboard.down('w');await page.waitForFunction(()=>readKartState().state==='running');let i=0,held='',shift=false,done=false,launchSeen=false;const seen=new Set(),captures=new Set();
while(i++<1900){const {state,race}=await page.evaluate(()=>readKartState());if(state==='results'){done=true;console.log('FINISH',{time:race.time,rank:race.rank,shortcuts:race.shortcuts,jumps:race.jumps});assert.ok(race.shortcuts>=2);assert.ok(race.jumps>=2);break;}if(state!=='running'){await page.waitForTimeout(50);continue;}const p=race.racers[0],lapS=p.s%track.length;let target=0;
 if(!p.routeId){const next=track.shortcuts.find(r=>r.start>lapS&&r.start-lapS<60);if(next)target=next.entryX;}
 if(!p.routeId&&!track.shortcuts.some(r=>r.start>lapS&&r.start-lapS<60)){const gate=[.30,.70].find(u=>u*track.length>lapS&&u*track.length-lapS<30);if(gate)target=((Math.floor(p.s/track.length)+Math.round(gate*10))%2?1:-1)*5.6;}
 const bend=routeBend(track,p),desired=-bend*p.speed*3.5/(11.4*(.72+p.speed/110))+(target-p.x)*1.2;
 const key=desired>.18?'ArrowRight':desired<-.18?'ArrowLeft':'';if(key!==held){if(held)await page.keyboard.up(held);if(key)await page.keyboard.down(key);held=key;}
 if(p.air>0&&!p.trick&&!shift){await page.keyboard.down('Shift');shift=true;}if(p.air===0&&shift){await page.keyboard.up('Shift');shift=false;}
 if(p.item)await page.keyboard.press('Space');
 for(const e of race.events){seen.add(e.type);if(e.type==='launch-boost')launchSeen=true;}
 const shot=lapS>track.length*.053&&lapS<track.length*.075?'obstacle':lapS>track.length*.275&&lapS<track.length*.30?'gate':p.routeId?(p.air>0?'jump':p.routeId):p.boost>0?'boost':null;if(shot&&!captures.has(shot)){captures.add(shot);await page.screenshot({path:'test-results/wow-'+shot+'.png'});}
 if(i%180===0)console.log('PROGRESS',race.time.toFixed(1),race.shortcuts,p.routeId,p.x.toFixed(1));await page.waitForTimeout(60);
}
assert.equal(done,true);assert.equal(launchSeen,true);assert.ok(seen.has('trick'));assert.ok(seen.has('land'));assert.ok(seen.has('shortcut-exit'));assert.ok(seen.has('jackpot')); assert.deepEqual(errors,[]);await page.screenshot({path:'test-results/wow-finish.png'});await page.keyboard.up('w');if(held)await page.keyboard.up(held);if(shift)await page.keyboard.up('Shift');await page.locator('#homeButton').click();for(const name of ['יאיר לפיד — יש עתיד','יאיר גולן — הדמוקרטים','אביגדור ליברמן — ישראל ביתנו','אריה דרעי — ש״ס','איתמר בן גביר — עוצמה יהודית']){await page.getByRole('button',{name,exact:true}).click();}await page.screenshot({path:'test-results/wow-driver.png',fullPage:true});console.log('PASS real keyboard shortcut entries/exits, air tricks, launch boost, item effects, finished race, all drivers', [...seen]);await browser.close();
