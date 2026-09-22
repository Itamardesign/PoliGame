export const DURATION=61;
export function randomSeed(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function dayKey(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function hash(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export const RULESET='chaos-2';
export function newRun(seed){return {seed,seats:24,peak:24,hits:0,shield:false,combo:0,maxCombo:0,pickups:0,deals:0,spins:0,spinCooldown:0,time:0,held:0,formed:false,defectIn:6,defections:0,ended:false,reason:''};}
export function phase(time){return time<15?0:time<30?1:time<49?2:3;}
export function pace(state){return {speed:21+state.time*.28+(state.formed?3:0),interval:Math.max(.70,1.16-state.time*.007)};}
function checkEnd(s){if(s.hits>=3){s.ended=true;s.reason='scandals';}else if(s.seats<=0){s.ended=true;s.reason='empty';}}
function majority(s){s.peak=Math.max(s.peak,s.seats);if(!s.formed&&s.seats>=61){s.formed=true;s.defectIn=6;return true;}return false;}
export function collect(s,type){if(s.ended)return {kind:'none'};
 if(type==='shield'){s.shield=true;return {kind:'shield'};}
 if(type==='seat'){s.combo++;s.maxCombo=Math.max(s.maxCombo,s.combo);s.pickups++;const amount=s.combo%5===0?6:3;s.seats=Math.min(120,s.seats+amount);return {kind:majority(s)?'formed':'seat',amount,combo:s.combo};}
 if(type==='deal'){s.deals++;s.hits++;s.combo=0;s.seats=Math.min(120,s.seats+9);const formed=majority(s);checkEnd(s);return {kind:'deal',amount:9,formed};}
 if(type!=='hazard')return {kind:'none'};
 if(s.shield){s.shield=false;return {kind:'saved'};}
 s.hits++;s.combo=0;s.seats=Math.max(0,s.seats-12);checkEnd(s);return {kind:'hit',amount:12};
}
export function tick(s,dt){if(s.ended||!Number.isFinite(dt)||dt<=0)return {defected:0};const step=Math.min(dt,DURATION-s.time);s.time+=step;s.spinCooldown=Math.max(0,s.spinCooldown-step);if(s.seats>=61)s.held+=step;let defected=0;if(s.formed){s.defectIn-=step;while(s.defectIn<=0){s.defectIn+=4;s.seats=Math.max(0,s.seats-4);s.defections+=4;defected+=4;}}checkEnd(s);if(s.time>=DURATION){s.ended=true;s.reason=s.seats>=61?'won':'minority';}return {defected};}
export function useSpin(s){if(s.ended||s.spinCooldown>0)return false;s.spinCooldown=12;s.spins++;return true;}
export function score(s){return Math.floor(s.time*10+s.pickups*100+s.maxCombo*40+s.held*35+s.seats*12+(s.reason==='won'?1000:0));}
export function courseRow(rng,index,time=0){const safe=Math.floor(rng()*3);const row=[{lane:safe,type:index>0&&index%14===0?'shield':'seat'}];const other=(safe+1+Math.floor(rng()*2))%3;const third=3-safe-other;
 if(index>=2)row.push({lane:other,type:'hazard',variant:Math.floor(rng()*3)});
 if(index>=5&&index%8===5)row.push({lane:third,type:'deal'});
 else if(index>=7&&time>=12)row.push({lane:third,type:'hazard',variant:Math.floor(rng()*3)});
 return row;
}
export function challengeFromSearch(search){const p=new URLSearchParams(search);const raw=p.get('seed');if(p.get('v')!==RULESET||raw===null||!/^\d{1,10}$/.test(raw))return null;const seed=Number(raw);if(seed>4294967295)return null;return {seed,score:Math.max(0,Math.min(999999,Math.floor(Number(p.get('score'))||0)))};}
export function challengeURL(base,s){const url=new URL(base);url.search='';url.hash='';url.searchParams.set('v',RULESET);url.searchParams.set('seed',String(s.seed));url.searchParams.set('score',String(score(s)));return url.href;}
