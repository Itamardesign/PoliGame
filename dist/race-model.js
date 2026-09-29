export const LAPS = 3;
export const ROAD = Object.freeze({halfWidth:10, driveEdge:9.7, maxOffset:14.5});
export const SECTORS = [
 {name:'שדרות הכנסת',color:'#40c9df',start:0},
 {name:'גשר ההבטחות',color:'#9976ed',start:.23},
 {name:'שוק הקואליציה',color:'#f29c55',start:.48},
 {name:'פארק הספינים',color:'#a1d65d',start:.76}
];
export function sectorAt(s,length){const u=((s/length)%1+1)%1;return SECTORS.findLastIndex(section=>u>=section.start);}
export const PARTIES = [
 {id:'likud',name:'הליכוד',leader:'בנימין נתניהו',short:'ביבי',ride:'ביבי־בולט',tag:'לימוזינה קטנה. תוכניות גדולות.',color:'#2875df',accent:'#b7dcff',hair:'#b7bdc2',skin:'#edbb96',style:'limo',logo:'likud.png'},
 {id:'yesh',name:'יש עתיד',leader:'יאיר לפיד',short:'לפיד',ride:'עתיד GT',tag:'יש עתיד. יש גם ניטרו.',color:'#22bddd',accent:'#d3f6ff',hair:'#b8c0c5',skin:'#eabe9e',style:'sport',logo:'yesh.svg'},
 {id:'democrats',name:'הדמוקרטים',leader:'יאיר גולן',short:'גולן',ride:'דמוקרטי־קארט',tag:'לוקחים את הפנייה ביחד.',color:'#df454f',accent:'#ffb2b7',hair:'#797a72',skin:'#e4ad89',style:'buggy',logo:'democrats.svg'},
 {id:'beytenu',name:'ישראל ביתנו',leader:'אביגדור ליברמן',short:'ליברמן',ride:'ביתנו אקספרס',tag:'בלי מו״מ. עם הרבה מומנט.',color:'#ed9941',accent:'#ffda92',hair:'#858078',skin:'#e4b291',style:'muscle',logo:'beytenu.webp'},
 {id:'shas',name:'ש״ס',leader:'אריה דרעי',short:'דרעי',ride:'ש״ס טורבו',tag:'כל הדרך לכיסא. עם כיסא מפואר.',color:'#a377df',accent:'#e4d2ff',hair:'#d0c9bc',skin:'#cfa17f',style:'royal',logo:'shas.png'},
 {id:'otzma',name:'עוצמה יהודית',leader:'איתמר בן גביר',short:'בן גביר',ride:'עוצמה 4×4',tag:'עוד פנייה. עוד קצת גז.',color:'#71a753',accent:'#d4eca8',hair:'#4b3729',skin:'#ebbe96',style:'offroad',logo:'otzma.png'}
];
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function rng(seed){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=Math.imul(n^n>>>15,n|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function makeRace(party=0,difficulty='normal',seed=Date.now(),length=760,routes=[]){
 const random=rng(seed);const order=[party,...PARTIES.map((_,i)=>i).filter(i=>i!==party)];
 return {time:0,length,difficulty,random,routes,events:[],eventSeq:0,projectiles:[],done:false,used:0,drifts:0,jumps:0,shortcuts:0,racers:order.map((id,i)=>({id,player:i===0,s:-i*4,speed:0,x:(i%2?1:-1)*3.3,steer:0,lateral:0,routeId:null,routeDistance:0,routeLap:0,routeJumped:false,air:0,airTotal:1,trick:false,hop:0,magnet:0,slipstream:0,slipCooldown:0,boost:0,shield:0,stun:0,charge:0,drifting:false,item:null,coins:0,finish:null,hitCooldown:0,aiClock:3+random()*7,skill:.96+random()*.07}))};
}
export function ranking(race){return [...race.racers].sort((a,b)=>a.finish!==null&&b.finish!==null?a.finish-b.finish:a.finish!==null?-1:b.finish!==null?1:b.s-a.s);}
export function grantItem(race,racer){if(racer.item)return;const rank=ranking(race).indexOf(racer);const r=race.random();racer.item=r<.25?'shield':r<.52||rank>=4?'boost':r<.79?'poll':'magnet';emitRace(race,'item-get',racer,{item:racer.item});}
export function emitRace(race,type,racer,data={}){const event={seq:++race.eventSeq,type,id:racer.id,s:racer.s,x:racer.x,...data};race.events.push(event);if(race.events.length>70)race.events.shift();return event;}
export function launch(race,racer){if(racer.air>0)return;racer.air=racer.airTotal=1.05;racer.trick=false;race.jumps+=racer.player?1:0;emitRace(race,'jump',racer);}
export function useItem(race,racer){if(!racer.item||race.done)return null;const item=racer.item;racer.item=null;if(racer.player)race.used++;if(item==='boost')racer.boost=Math.max(racer.boost,2.6);if(item==='shield')racer.shield=6;if(item==='magnet')racer.magnet=7;emitRace(race,'item-use',racer,{item});if(item==='poll'){const target=ranking(race).filter(r=>r!==racer&&r.s>racer.s&&r.s-racer.s<160&&r.finish===null).at(-1);if(target){race.projectiles.push({from:racer.id,to:target.id,remaining:1.05});emitRace(race,'poll-fired',racer,{target:target.id});}else emitRace(race,'no-target',racer);}return item;}
export function hitRacer(racer,race=null){if(racer.hitCooldown>0)return false;racer.hitCooldown=1.5;if(racer.shield>0){racer.shield=0;if(race)emitRace(race,'shield-break',racer);return false;}racer.stun=1.25;racer.speed*=.5;racer.charge=0;if(race)emitRace(race,'hit',racer);return true;}
export function stepRace(race,dt,input={},curve=0){
 if(race.done)return;dt=clamp(dt,0,.05);race.time+=dt;
 for(const p of race.projectiles){p.remaining-=dt;if(p.remaining<=0){const target=race.racers.find(r=>r.id===p.to);if(target&&target.finish===null){if(target.shield>0){target.shield=0;emitRace(race,'shield-break',target);}else{target.stun=1.8;target.charge=0;emitRace(race,'hit',target,{from:p.from});}}}}race.projectiles=race.projectiles.filter(p=>p.remaining>0);
 for(const r of race.racers){
  if(r.finish!==null)continue;
  for(const k of ['boost','shield','stun','hitCooldown','magnet','hop','slipCooldown'])r[k]=Math.max(0,r[k]-dt);
  const wasDrifting=r.drifting,before=r.s,wasAir=r.air>0;
  if(wasAir){r.air=Math.max(0,r.air-dt);if(r.player&&input.drift&&!r.lastDrift){r.trick=true;emitRace(race,'trick',r);}if(r.air===0){if(r.trick)r.boost=Math.max(r.boost,1.8);emitRace(race,'land',r,{trick:r.trick});}}
  if(r.player){
   const requested=clamp(input.steer||0,-1,1),sensitivity=clamp(input.sensitivity??1,.65,1.35);
   // Quick turn-in, smooth velocity, and stronger damping on release. No key-repeat dependency.
   r.steer+=(requested-r.steer)*-Math.expm1(-dt*(requested===0?22:13));
   r.drifting=!!input.drift&&Math.abs(requested)>.1&&r.speed>15&&!wasAir&&Math.abs(r.x)<(r.routeId?2:ROAD.driveEdge);
   const grip=r.drifting?8.8:11.4;
   const desired=r.steer*grip*sensitivity*(.72+Math.min(r.speed,45)/110)+curve*r.speed*(r.drifting?1.8:3.5);
   r.lateral+=(desired-r.lateral)*-Math.expm1(-dt*(requested===0?20:12));
   r.x=clamp(r.x+r.lateral*dt,-ROAD.maxOffset,ROAD.maxOffset);
   if(Math.abs(r.x)>=ROAD.maxOffset)r.lateral=0;
   if(r.drifting){if(!wasDrifting){r.hop=.23;emitRace(race,'drift-start',r);}const tier=Math.floor(r.charge/ .8);r.charge=clamp(r.charge+dt,0,3);if(Math.floor(r.charge/.8)>tier)emitRace(race,'drift-charge',r,{tier:Math.min(3,Math.floor(r.charge/.8))});}
   if(wasDrifting&&!r.drifting){if(r.charge>.65){r.boost=Math.max(r.boost,r.charge>2.4?3:r.charge>1.6?1.9:1.1);race.drifts++;emitRace(race,'drift-boost',r,{tier:r.charge>2.4?3:r.charge>1.6?2:1});}r.charge=0;}
  }else{
   r.x+=(Math.sin(race.time*.48+r.id*2.1)*6.5-r.x)*dt*1.8;
   r.aiClock-=dt;if(r.aiClock<=0){grantItem(race,r);useItem(race,r);r.aiClock=7+race.random()*8;}
  }
  let target=r.player?32:(race.difficulty==='hard'?36:31.4)*r.skill;
  if(r.player)target+=Math.min(r.coins,10)*.2;
  if(r.player&&input.accelerate&&!input.brake)target+=3;
  if(r.boost>0)target+=13;
  if(r.stun>0)target*=.4;
  if(Math.abs(r.x)>(r.routeId?2.1:ROAD.driveEdge))target*=r.routeId?.65:.48;
  if(r.player&&input.brake)target*=.48;
  r.speed+=(target-r.speed)*-Math.expm1(-dt*(r.player&&input.brake?6:2.3));const distance=r.speed*dt;
  if(r.routeId){const route=race.routes.find(p=>p.id===r.routeId);r.x=clamp(r.x,-route.width/2,route.width/2);r.routeDistance=Math.min(route.length,r.routeDistance+distance);r.s=r.routeLap*race.length+route.start+(route.end-route.start)*r.routeDistance/route.length;if(!r.routeJumped&&r.routeDistance>route.length*.57){r.routeJumped=true;launch(race,r);}if(r.routeDistance>=route.length){r.routeId=null;r.x=clamp(route.exitX+r.x,-ROAD.driveEdge,ROAD.driveEdge);r.lateral=0;emitRace(race,'shortcut-exit',r,{route:route.id});}}
  else {r.s+=distance;if(r.player){const lap=Math.floor(Math.max(0,before)/race.length);for(const route of race.routes){const gate=lap*race.length+route.start;if(before<gate&&r.s>=gate&&Math.abs(r.x-route.entryX)<2.1&&r.speed>22){r.routeId=route.id;r.routeDistance=0;r.routeLap=lap;r.routeJumped=false;r.s=gate;r.x=0;r.lateral=0;race.shortcuts++;emitRace(race,'shortcut-enter',r,{route:route.id});break;}}}}
  if(r.player&&!r.routeId){const drafting=race.racers.some(other=>other!==r&&other.s-r.s>3&&other.s-r.s<18&&Math.abs(other.x-r.x)<1.8&&!other.routeId);r.slipstream=clamp(r.slipstream+(drafting?dt:-dt*2),0,1.25);if(r.slipstream>=1.25&&r.slipCooldown===0){r.boost=Math.max(r.boost,1.7);r.slipCooldown=4;r.slipstream=0;emitRace(race,'slipstream',r);}}
  r.lastDrift=!!input.drift;
  if(r.s>=race.length*LAPS){r.finish=race.time;r.s=race.length*LAPS;}
 }
 if(race.racers[0].finish!==null)race.done=true;
}

