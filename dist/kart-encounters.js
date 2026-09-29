import {emitRace,hitRacer,clamp} from './race-model.js';
export const ENCOUNTERS=[{id:'ballot',kind:'ball',u:.075},{id:'gate',kind:'gate',u:.30},{id:'market',kind:'ball',u:.60},{id:'prize',kind:'gate',u:.70},{id:'final',kind:'ball',u:.89}];
export function encountersFor(levelId='jerusalem'){
 if(levelId==='market')return [...ENCOUNTERS,{id:'market-entry',kind:'ball',u:.43},{id:'market-exit',kind:'ball',u:.78}].sort((a,b)=>a.u-b.u);
 if(levelId==='midnight')return [...ENCOUNTERS,{id:'night-1',kind:'ball',u:.18},{id:'night-2',kind:'ball',u:.42},{id:'night-3',kind:'ball',u:.78}].sort((a,b)=>a.u-b.u);
 return ENCOUNTERS;
}
export function encounterAt(e,time,lap=0){return e.kind==='ball'?{x:Math.sin(time*1.3+e.u*19)*6.8,radius:1.8}:{x:((lap+Math.round(e.u*10))%2?1:-1)*5.6,radius:2.1};}
export function stepEncounters(race,before,wasRoute){const p=race.racers[0];if(race.done||p.routeId||wasRoute)return;const lap=Math.floor(Math.max(0,before)/race.length);for(const e of encountersFor(race.levelId)){const s=lap*race.length+e.u*race.length;if(before>=s||p.s<s)continue;const at=encounterAt(e,race.time,lap),dx=Math.abs(p.x-at.x);if(e.kind==='gate'){if(dx<at.radius){p.boost=Math.max(p.boost,2.1);p.coins=clamp(p.coins+3,0,10);emitRace(race,'jackpot',p);}}else if(p.air<=0){if(dx<at.radius+ .75){hitRacer(p,race);}else if(dx<at.radius+2){p.boost=Math.max(p.boost,1.15);emitRace(race,'near-miss',p);}}}}
export function bumpRivals(race){
 const racers=race.racers,contacts=race.bumpTimes??=new Map();
 for(let i=0;i<racers.length;i++)for(let j=i+1;j<racers.length;j++){
  const a=racers[i],b=racers[j];
  if(a.finish!==null||b.finish!==null||a.routeId||b.routeId||a.air>0||b.air>0)continue;
  const dx=a.x-b.x;
  if(Math.abs(a.s-b.s)>=2.3||Math.abs(dx)>=1.85)continue;
  const side=dx!==0?Math.sign(dx):a.id<b.id?-1:1;
  const attacker=a.boost>0&&b.boost<=0?a:b.boost>0&&a.boost<=0?b:null;
  const aShare=attacker===a?0.2:attacker===b?0.8:0.5;
  const separation=Math.min(1.85-Math.abs(dx),attacker?1.25:.9);
  a.x=clamp(a.x+side*separation*aShare,-14.5,14.5);
  b.x=clamp(b.x-side*separation*(1-aShare),-14.5,14.5);
  const key=`${Math.min(a.id,b.id)}:${Math.max(a.id,b.id)}`;
  if(race.time-(contacts.get(key)??-Infinity)<.7)continue;
  contacts.set(key,race.time);
  if(attacker){const victim=attacker===a?b:a;if(hitRacer(victim,race)){emitRace(race,'ram',attacker,{target:victim.id});continue;}}
  a.speed*=.96;b.speed*=.96;
  const source=a.player?a:b.player?b:a;
  emitRace(race,'bump',source,{target:source===a?b.id:a.id});
 }
}
