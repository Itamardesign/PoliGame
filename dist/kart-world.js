import * as T from './vendor/three.module.min.js';
import {makeDriver} from './kart-drivers.js';
import {PARTIES,rng,clamp,ROAD,SECTORS,sectorAt} from './race-model.js';
const materials=new Map();
export function mat(c){if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.67}));return materials.get(c);}
export function box(g,w,h,d,c,x=0,y=0,z=0){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;}
function ball(g,r,c,x,y,z,sx=1,sy=1,sz=1){const m=new T.Mesh(new T.SphereGeometry(r,16,12),mat(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;g.add(m);return m;}
function cyl(g,r1,r2,h,c,x,y,z,n=16){const m=new T.Mesh(new T.CylinderGeometry(r1,r2,h,n),mat(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;}
export function label(text,w=4,h=1,bg='#f7f3d9',color='#2b4436',size=80){const c=document.createElement('canvas');c.width=512;c.height=192;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,512,192);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${size}px Heebo, Arial`;ctx.fillText(text,256,100,480);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));return mesh;}
export async function loadLogos(){const loader=new T.TextureLoader();return Promise.all(PARTIES.map(async p=>{try{const texture=await loader.loadAsync('./assets/'+p.logo);texture.colorSpace=T.SRGBColorSpace;return texture;}catch{return null;}}));}
const special=new Map();
// Shiny, glowing and glass finishes for the vehicle details (cached, so batching still merges them).
function finish(kind,c){const key=kind+c;if(!special.has(key))special.set(key,kind==='chrome'?new T.MeshStandardMaterial({color:c,metalness:.45,roughness:.22}):kind==='glow'?new T.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:1.4,roughness:.4}):kind==='glass'?new T.MeshStandardMaterial({color:c,transparent:true,opacity:.42,roughness:.08,metalness:.2}):new T.MeshStandardMaterial({color:c,roughness:.95}));return special.get(key);}
function as(m,kind,c){m.material=finish(kind,c);return m;}
function rod(g,a,b,r,c,kind){const A=new T.Vector3(...a),B=new T.Vector3(...b),m=new T.Mesh(new T.CylinderGeometry(r,r,A.distanceTo(B),10),kind?finish(kind,c):mat(c));m.position.copy(A).add(B).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),B.clone().sub(A).normalize());m.castShadow=true;g.add(m);return m;}
let flagTex;
function israelFlag(w,h){if(!flagTex){const c=document.createElement('canvas');c.width=300;c.height=210;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,300,210);x.fillStyle='#1f55c6';x.fillRect(0,22,300,30);x.fillRect(0,158,300,30);x.strokeStyle='#1f55c6';x.lineWidth=9;for(const d of [1,-1]){x.beginPath();x.moveTo(150,105-44*d);x.lineTo(150+38,105+22*d);x.lineTo(150-38,105+22*d);x.closePath();x.stroke();}flagTex=new T.CanvasTexture(c);flagTex.colorSpace=T.SRGBColorSpace;}
 return new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:flagTex,side:T.DoubleSide}));}
// A wheel is built in its own group (axle along local y), batched, then spun by the race loop.
function wheel(g,x,z,{r=.47,w=.45,tire='#20262a',rim='#c9d0d6',hub='#ffffff',spokes=5,knobs=0,rimKind='chrome'}={}){
 const wg=new T.Group();wg.position.set(x,r+.04,z);g.add(wg);
 cyl(wg,r,r,w,tire,0,0,0,26);cyl(wg,r*.86,r*.86,w+.02,'#15191b',0,0,0,24);
 as(cyl(wg,r*.62,r*.62,w+.04,rim,0,0,0,24),rimKind,rim);as(cyl(wg,r*.2,r*.2,w+.1,hub,0,0,0,12),'chrome',hub);
 for(let i=0;i<spokes;i++){const s=box(wg,.07,w+.07,r*1.18,'#262b2e');s.rotation.y=i/spokes*Math.PI;}
 for(let i=0;i<knobs;i++){const a=i/knobs*Math.PI*2,k=box(wg,.12,w*.92,.17,tire,Math.cos(a)*r,0,Math.sin(a)*r);k.rotation.y=-a;}
 wg.rotation.z=Math.PI/2;batchStatic(wg);g.userData.wheels.push(wg);return wg;}
const STYLE={
 // Likud — "Bibi-Bot": armoured state limousine with a tinted rear cabin, chrome grille and fender flags.
 limo(g,p){const body='#132449',chrome='#dfe5ec';
  box(g,2.1,.5,4.1,body,0,.8,-.05);as(box(g,2.14,.07,4.05,chrome,0,.58,-.05),'chrome',chrome);box(g,2.13,.1,4.0,p.color,0,.93,-.05);
  box(g,1.92,.24,1.3,body,0,1.13,1.3);box(g,.1,.03,1.25,chrome,0,1.26,1.3);
  as(box(g,1.3,.46,.08,chrome,0,.9,2.07),'chrome',chrome);as(box(g,2.2,.16,.2,chrome,0,.56,2.1),'chrome',chrome);as(box(g,2.2,.16,.2,chrome,0,.56,-2.14),'chrome',chrome);
  for(const s of [-1,1]){as(ball(g,.14,'#fff7cf',s*.8,.97,2.02,1,1,.5),'glow','#fff7cf');as(box(g,.34,.14,.05,'#ff3b3b',s*.72,.95,-2.1),'glow','#ff3b3b');
   rod(g,[s*.9,1.02,1.85],[s*.9,1.78,1.85],.025,chrome,'chrome');const f=israelFlag(.52,.36);f.position.set(s*.9,1.58,1.58);f.rotation.y=Math.PI/2;g.add(f);
   as(box(g,.16,.08,.3,chrome,s*1.12,1.2,.75),'chrome',chrome);}
  as(box(g,1.7,.5,.05,'#b9dcf7',0,1.46,.95),'glass','#b9dcf7').rotation.x=-.4;
  // Rear VIP cabin: armoured roof, tinted windows and a gold seal on each door.
  box(g,1.96,.82,1.32,body,0,1.44,-1.36);as(box(g,1.98,.36,.95,'#1a2330',0,1.56,-1.36),'glass','#1a2330');box(g,1.86,.1,1.24,body,0,1.9,-1.36);
  for(const s of [-1,1]){const seal=as(cyl(g,.16,.16,.04,'#e3c35a',s*.99,1.16,-1.36),'chrome','#e3c35a');seal.rotation.z=Math.PI/2;}
  as(box(g,.5,.04,.9,'#2c3b4d',0,1.97,-1.4),'chrome','#2c3b4d');
  return {front:2.13,rear:-2.2,plateY:.86,flames:[[-.55,.6,-2.35],[.55,.6,-2.35]],flag:[.75,1.95,-1.9],wheel:{rim:'#dfe5ec',spokes:8,hub:'#2875df'}};},
 // Yesh Atid — "Atid GT": low wedge supercar with side pods, rear wing and an "ON AIR" studio light.
 sport(g,p){const dark='#141d24',white='#f4f8fa';
  box(g,2.2,.2,3.9,dark,0,.5,0);for(const s of [-1,1]){box(g,.55,.46,2.3,p.color,s*.86,.8,-.3);box(g,.06,.26,.7,dark,s*1.14,.84,.15);box(g,.3,.05,2.3,white,s*.86,1.04,-.3);}
  const nose=box(g,1.35,.3,1.7,p.color,0,.78,1.25);nose.rotation.x=.12;for(const s of [-1,1]){const st=box(g,.15,.03,1.7,white,s*.2,.95,1.25);st.rotation.x=.12;as(box(g,.42,.06,.05,'#e8fbff',s*.5,.76,2.08),'glow','#e8fbff');}
  box(g,2.25,.06,.4,dark,0,.52,2.08);box(g,1.45,.36,1.2,p.color,0,1.0,-1.35);for(let i=0;i<4;i++)box(g,1.1,.03,.08,dark,0,1.19,-1.0-i*.22);
  for(const s of [-1,1]){box(g,.08,.55,.18,dark,s*.55,1.43,-1.78);box(g,.06,.4,.62,white,s*1.16,1.62,-1.8);}
  const wing=box(g,2.3,.07,.58,p.color,0,1.72,-1.82);wing.rotation.x=.12;as(box(g,1.9,.07,.04,'#ff4b5c',0,1.02,-1.96),'glow','#ff4b5c');
  const onAir=label('ON AIR',.95,.26,'#e0303a','#ffffff',110);onAir.position.set(0,1.4,-1.9);onAir.rotation.y=Math.PI;g.add(onAir);g.userData.fx.push({mesh:onAir,kind:'blink',rate:1.6});
  // A news-anchor's desk microphone on the dash.
  rod(g,[-.62,1.12,.95],[-.62,1.62,.8],.03,dark);ball(g,.1,'#3a4046',-.62,1.7,.78,1,1.3,1);box(g,.14,.1,.03,'#22bddd',-.62,1.54,.86);
  return {front:2.1,rear:-1.98,plateY:.72,flames:[[-.22,.78,-2.15],[.22,.78,-2.15]],flag:[.95,1.2,-.9],wheel:{r:.45,rim:'#1d2a33',hub:'#7fe9ff',spokes:5,rimKind:'chrome'}};},
 // Democrats — "Demokrati-Kart": protest dune buggy with a tall roll cage, megaphone, flag and an exposed V-twin.
 buggy(g,p){const cage='#3a4046',chrome='#cfd6dc';
  box(g,1.55,.4,2.7,p.color,0,.78,.05);const nose=box(g,1.25,.3,.8,p.color,0,.78,1.6);nose.rotation.x=.25;box(g,1.6,.05,.7,'#ffffff',0,.99,.9);
  for(const s of [-1,1]){rod(g,[s*1.0,.9,-.72],[s*.92,3.62,-.72],.07,cage);rod(g,[s*.92,3.55,-.72],[s*.8,1.0,-1.9],.06,cage);rod(g,[s*.85,.72,1.75],[s*.85,.72,-1.9],.06,cage);rod(g,[s*1.0,1.25,-.72],[s*.85,1.25,.9],.05,cage);}
  rod(g,[-.95,3.6,-.72],[.95,3.6,-.72],.07,cage);rod(g,[-.95,2.3,-.72],[.95,2.3,-.72],.05,cage);rod(g,[-.9,.8,2.0],[.9,.8,2.0],.07,chrome,'chrome');
  for(const s of [-1,1])as(ball(g,.13,'#fff7cf',s*.4,1.05,1.95),'glow','#fff7cf');
  // Megaphone on the cage, pointing ahead.
  const horn=new T.Mesh(new T.CylinderGeometry(.24,.07,.55,16,1,true),new T.MeshStandardMaterial({color:'#f4f1ea',roughness:.5,side:T.DoubleSide}));horn.rotation.x=Math.PI/2;horn.position.set(.55,3.78,-.45);g.add(horn);cyl(g,.08,.08,.22,p.color,.55,3.78,-.8).rotation.x=Math.PI/2;
  rod(g,[-.9,1.0,-1.8],[-.9,4.1,-1.8],.03,chrome,'chrome');const f=israelFlag(.82,.58);f.position.set(-.9,3.78,-2.22);f.rotation.y=Math.PI/2;g.add(f);
  box(g,.95,.45,.7,'#4b5157',0,1.02,-1.45);for(const s of [-1,1]){const c=as(cyl(g,.15,.13,.45,chrome,s*.32,1.4,-1.45),'chrome',chrome);c.rotation.z=s*.6;}as(cyl(g,.2,.2,.14,p.color,.55,1.55,-1.2),'chrome',p.color);
  for(const s of [-1,1])rod(g,[s*.35,1.0,-1.8],[s*.45,1.45,-2.25],.06,chrome,'chrome');
  return {front:2.02,rear:-1.95,plateY:.85,flames:[[-.45,1.45,-2.35],[.45,1.45,-2.35]],flag:[1.0,1.25,-1.5],wheel:{r:.44,rim:'#e8e8e2',hub:p.color,spokes:4,knobs:10},rearWheel:{r:.6,w:.56,rim:'#e8e8e2',hub:p.color,spokes:4,knobs:14},wheelZ:[1.3,-1.2]};},
 // Yisrael Beytenu — "Beytenu Express": muscle car with a supercharger through the hood, side pipes and ducktail.
 muscle(g,p){const black='#1b1d20',chrome='#d6dce2';
  box(g,2.15,.55,3.95,p.color,0,.86,0);box(g,1.8,.14,1.45,p.color,0,1.2,1.2);box(g,1.85,.2,1.0,p.color,0,1.2,-1.45);
  for(const s of [-1,1]){box(g,.2,.02,1.45,black,s*.28,1.28,1.2);box(g,.2,.02,1.0,black,s*.28,1.31,-1.45);box(g,.2,.02,1.2,black,s*1.08,.88,0).rotation.y=Math.PI/2;
   rod(g,[s*1.16,.55,.9],[s*1.16,.55,-1.3],.08,chrome,'chrome');for(let i=0;i<3;i++)as(box(g,.05,.1,.2,chrome,s*1.21,.55,.5-i*.6),'chrome',chrome);
   for(const k of [.55,.82])as(ball(g,.12,'#fff5c8',s*k,.93,1.98,1,1,.5),'glow','#fff5c8');as(box(g,.5,.12,.05,'#ff3030',s*.6,.95,-1.99),'glow','#ff3030');}
  box(g,1.3,.32,.06,black,0,.9,1.99);as(box(g,2.2,.14,.18,chrome,0,.6,2.05),'chrome',chrome);as(box(g,2.2,.14,.18,chrome,0,.6,-2.05),'chrome',chrome);
  // Blower: chrome supercharger, belt pulley and a black shotgun scoop.
  as(box(g,.62,.32,.5,chrome,0,1.42,1.0),'chrome',chrome);box(g,.56,.2,.38,black,0,1.66,1.02);as(box(g,.5,.1,.05,chrome,0,1.66,1.22),'chrome',chrome);const pulley=cyl(g,.14,.14,.06,black,0,1.35,1.28);pulley.rotation.x=Math.PI/2;
  const tail=box(g,2.0,.08,.38,black,0,1.34,-1.85);tail.rotation.x=-.3;
  return {front:2.02,rear:-2.02,plateY:.9,flames:[[-1.16,.55,-1.5],[1.16,.55,-1.5]],flag:[.8,1.3,-.95],wheel:{r:.47,rim:chrome,hub:'#ffda92',spokes:5},rearWheel:{r:.56,w:.62,rim:chrome,hub:'#ffda92',spokes:5}};},
 // Shas — "Shas Turbo": gilded carriage kart with a velvet throne, crown and two lanterns.
 royal(g,p){const gold='#e2b84a',velvet='#5e2a8f';
  ball(g,1,p.color,0,.86,0,1.05,.42,1.78);const band=as(new T.Mesh(new T.TorusGeometry(1,.05,8,48),mat(gold)),'chrome',gold);band.rotation.x=Math.PI/2;band.scale.set(1.06,1.8,1);band.position.y=1.02;g.add(band);
  as(ball(g,.2,gold,0,.95,1.82),'chrome',gold);
  for(const s of [-1,1]){as(box(g,.22,.34,1.0,gold,s*.72,1.3,-.2),'chrome',gold);box(g,.2,.08,.95,velvet,s*.72,1.5,-.2);as(ball(g,.13,gold,s*.72,1.48,.34),'chrome',gold);
   rod(g,[s*.98,1.0,1.4],[s*.98,1.78,1.4],.03,gold,'chrome');as(box(g,.22,.26,.22,'#ffd98a',s*.98,1.9,1.4),'glow','#ffd98a');as(cyl(g,.02,.16,.14,gold,s*.98,2.1,1.4),'chrome',gold);
   as(ball(g,.14,gold,s*.78,3.62,-.86),'chrome',gold);}
  as(box(g,1.56,2.36,.22,gold,0,2.35,-.88),'chrome',gold);as(box(g,1.28,2.08,.08,velvet,0,2.33,-.75),'matte',velvet);box(g,1.1,.2,.9,velvet,0,1.1,-.2);
  // Crown finial above the throne back.
  as(cyl(g,.4,.34,.32,gold,0,3.78,-.88,12),'chrome',gold);for(let i=0;i<6;i++){const a=i/6*Math.PI*2;as(ball(g,.07,gold,Math.cos(a)*.38,4.0,-.88+Math.sin(a)*.38),'chrome',gold);}as(ball(g,.1,'#7b3fd0',0,3.82,-.5),'glow','#9a5cf0');
  return {front:1.86,rear:-1.86,plateY:.9,flames:[[-.5,.7,-2.0],[.5,.7,-2.0]],flag:[1.05,1.1,-1.1],wheel:{r:.5,w:.34,tire:'#2a1838',rim:gold,hub:gold,spokes:8,rimKind:'chrome'}};},
 // Otzma Yehudit — "Otzma 4x4": lifted patrol jeep with a roll-bar police light bar, bull bar, snorkel and spare wheel.
 offroad(g,p){const dark='#3f5d33',black='#1d2220',steel='#aab3b8';
  box(g,1.9,.2,3.4,black,0,.95,0);box(g,1.95,.52,1.25,p.color,0,1.26,1.25);box(g,1.95,.52,1.15,p.color,0,1.26,-1.32);for(const s of [-1,1])box(g,.18,.52,1.5,p.color,s*.89,1.26,-.1);
  for(let i=0;i<7;i++)box(g,.07,.3,.04,black,(i-3)*.14,1.28,1.89);for(const s of [-1,1]){as(ball(g,.15,'#fff6cf',s*.72,1.3,1.88,1,1,.5),'glow','#fff6cf');for(const z of [1.18,-1.18])box(g,.5,.12,1.2,black,s*1.1,1.55,z);}
  as(box(g,1.7,.05,.5,'#cfe3f0',0,1.56,1.35),'glass','#cfe3f0');box(g,1.8,.07,.08,dark,0,1.56,1.1);
  // Bull bar and snorkel.
  for(const s of [-1,1])rod(g,[s*.7,.8,2.12],[s*.7,1.55,2.12],.06,black);rod(g,[-.85,1.5,2.12],[.85,1.5,2.12],.06,black);rod(g,[-.95,.9,2.12],[.95,.9,2.12],.07,black);
  rod(g,[1.05,1.2,.72],[1.05,2.2,.72],.07,black);box(g,.18,.12,.24,black,1.05,2.24,.8);
  // Roll bar behind the driver with a blinking police light bar.
  for(const s of [-1,1]){rod(g,[s*.95,1.4,-.8],[s*.95,3.55,-.8],.07,steel,'chrome');rod(g,[s*.95,3.4,-.8],[s*.9,1.5,-1.85],.06,steel,'chrome');}rod(g,[-.95,3.55,-.8],[.95,3.55,-.8],.07,steel,'chrome');
  box(g,1.6,.14,.34,black,0,3.7,-.8);for(const s of [-1,1]){const light=as(box(g,.62,.16,.3,s<0?'#ff2d3a':'#2f6bff',s*.42,3.8,-.8),'glow',s<0?'#ff2d3a':'#2f6bff');g.userData.fx.push({mesh:light,kind:'blink',rate:5,phase:s<0?0:1});}
  const spare=cyl(g,.5,.5,.32,black,0,1.45,-2.08,20);spare.rotation.x=Math.PI/2;const sr=as(cyl(g,.3,.3,.36,steel,0,1.45,-2.08,16),'chrome',steel);sr.rotation.x=Math.PI/2;
  for(const s of [-1,1])box(g,.26,.42,.18,dark,s*.72,1.72,-1.72);
  return {front:2.22,rear:-2.35,plateY:1.02,flames:[[-.6,.95,-2.1],[.6,.95,-2.1]],flag:[.8,1.5,-1.6],wheel:{r:.6,w:.55,rim:'#566b4c',hub:'#d4eca8',spokes:6,knobs:16,rimKind:'matte'}};}
};
export function makeKart(index,logos){
 const p=PARTIES[index],g=new T.Group();g.userData.wheels=[];g.userData.fx=[];
 const spec=STYLE[p.style](g,p);
 // Shared cockpit: seat, column and steering wheel sit in the same place on every chassis.
 if(p.style!=='royal'){box(g,1.15,.24,.9,'#2a2f33',0,1.02,-.2);box(g,1.15,.95,.22,'#2a2f33',0,1.48,-.62);}
 rod(g,[0,1.05,1.0],[0,1.42,.68],.05,'#2b3434');const steering=new T.Mesh(new T.TorusGeometry(.39,.065,8,20),mat('#2b3434'));steering.position.set(0,1.42,.65);steering.rotation.x=-.7;g.add(steering);
 const [zf,zr]=spec.wheelZ||[1.1,-1.04];for(const x of [-1.13,1.13]){wheel(g,x,zf,spec.wheel);wheel(g,x,zr,spec.rearWheel||spec.wheel);}
 const driver=makeDriver(index);g.add(driver);g.userData.driver=driver;g.userData.head=driver.userData.head;g.userData.eyes=driver.userData.eyes;
 // Front and rear campaign plaques carry the actual downloaded party logos.
 for(const front of [true,false]){const z=front?spec.front:spec.rear,d=front?1:-1;box(g,1.13,.42,.06,index===3?'#264b6b':'#fff9ea',0,spec.plateY,z);let plaque;
 if(logos[index])plaque=new T.Mesh(new T.PlaneGeometry(1.03,.34),new T.MeshBasicMaterial({map:logos[index],transparent:true,side:T.DoubleSide}));else plaque=label(p.name,1.03,.34,'#fff9ea',p.color,95);
 plaque.position.set(0,spec.plateY,z+d*.035);if(!front)plaque.rotation.y=Math.PI;g.add(plaque);}
 const [fx,fy,fz]=spec.flag;cyl(g,.025,.025,1.9,'#fff2cd',fx,fy+.95,fz);const flag=label(p.name,.88,.38,p.color,'#ffffff',90);flag.position.set(fx+.42,fy+1.75,fz);g.add(flag);
 const shield=new T.Mesh(new T.SphereGeometry(2.6,28,18),new T.MeshBasicMaterial({color:'#80e8fa',transparent:true,opacity:.16,depthWrite:false}));shield.position.y=1.6;shield.visible=false;g.add(shield);g.userData.shield=shield;
 const flames=[];for(const [x,y,z] of spec.flames){const flame=new T.Mesh(new T.ConeGeometry(.3,1.65,12),new T.MeshBasicMaterial({color:'#91efff'}));flame.rotation.x=-Math.PI/2;flame.position.set(x,y,z);g.add(flame);flame.visible=false;flames.push(flame);}g.userData.flames=flames;
 const name=label(p.short,1.7,.48,'#f4f5dc','#294330',90);name.position.set(0,4.6,0);name.visible=false;g.add(name);g.userData.name=name;
 return g;
}
export function makeTrack(){const points=[[0,0,0],[0,1,64],[42,3,110],[97,5,100],[132,2,50],[103,0,10],[127,1,-45],[89,4,-99],[27,2,-107],[-29,0,-80],[-46,0,-34]];const curve=new T.CatmullRomCurve3(points.map(([x,y,z])=>new T.Vector3(x*1.23,y*1.15,z*1.23)),true,'catmullrom',.48);const length=curve.getLength();
 function at(s,offset=0){const u=((s/length)%1+1)%1,p=curve.getPointAt(u),t=curve.getTangentAt(u).normalize(),right=new T.Vector3(-t.z,0,t.x).normalize();p.addScaledVector(right,offset);return{p,t,right};}
 function bend(s){const a=at(s).t,b=at(s+3).t;return Math.atan2(a.z*b.x-a.x*b.z,a.dot(b))/3;}
 return {curve,length,at,bend};}
function ribbon(track,offset,width,color,height=0){const pos=[],indices=[],uv=[],N=560;for(let i=0;i<=N;i++){for(const edge of [-1,1]){const p=track.at(i/N*track.length,offset+edge*width/2).p;pos.push(p.x,p.y+height,p.z);uv.push((edge+1)*width/16,i/N*track.length/8);}if(i<N){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();const m=new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness:1,side:T.DoubleSide}));m.receiveShadow=true;return m;}
export function buildWorld(scene,track){
 const rand=rng(6161);box(scene,650,1,600,'#8dae6e',35,-.55,0);
 // Broad, textured tarmac with readable edges and gently sloped, grounded shoulders.
 scene.add(ribbon(track,0,26,'#d4c59d',-.1));
 const asphalt=ribbon(track,0,ROAD.halfWidth*2,'#59656b',.035);
 const grain=document.createElement('canvas');grain.width=grain.height=128;const ctx=grain.getContext('2d'),noise=ctx.createImageData(128,128);for(let i=0;i<noise.data.length;i+=4){const n=165+Math.floor(rand()*44);noise.data.set([n,n,n,255],i);}ctx.putImageData(noise,0,0);const texture=new T.CanvasTexture(grain);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;asphalt.material.map=texture;scene.add(asphalt);
 for(const side of [-1,1]){
  scene.add(ribbon(track,side*9.25,.17,'#f8f5dc',.07));
  scene.add(ribbon(track,side*10.6,.85,'#e8f5ea',.045));
  for(let s=0;s<track.length;s+=2.6){const {p,t}=track.at(s,side*10.35);const curb=box(scene,.75,.19,2.5,Math.floor(s/2.6)%2?'#fff5e2':SECTORS[sectorAt(s,track.length)].color,p.x,p.y,p.z);curb.rotation.y=Math.atan2(t.x,t.z);}
  // Embankment extends to the ground so raised track no longer floats above the grass.
  const vertices=[],idx=[];for(let i=0;i<=280;i++){const inner=track.at(i/280*track.length,side*12.8).p,outer=track.at(i/280*track.length,side*17).p;vertices.push(inner.x,inner.y-.13,inner.z,outer.x,-.05,outer.z);if(i<280){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(idx);geometry.computeVertexNormals();scene.add(new T.Mesh(geometry,new T.MeshStandardMaterial({color:'#95ac71',side:T.DoubleSide,roughness:1})));
 }
 // Two faint racing lanes leave ample room for overtaking rather than a center divider.
 for(let s=6;s<track.length;s+=8)for(const offset of [-3.2,3.2]){const {p,t}=track.at(s,offset);const stripe=box(scene,.12,.025,2.6,'#c7d0c9',p.x,p.y+.065,p.z);stripe.rotation.y=Math.atan2(t.x,t.z);}
 // The old game's Jerusalem stone, geometric trees and sun-faded palette.
 function tree(x,z,scale=1){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(scale);cyl(g,.14,.22,1.8,'#998667',0,.9,0,7);const crown=new T.Mesh(new T.IcosahedronGeometry(1.25,1),mat('#638e50'));crown.position.y=2.6;crown.scale.set(.9,1.35,.9);crown.castShadow=true;g.add(crown);scene.add(g);}
 const samples=Array.from({length:150},(_,i)=>track.at(i/150*track.length).p);
 function near(x,z,d){return samples.some(p=>(p.x-x)**2+(p.z-z)**2<d*d);}
 for(let i=0;i<155;i++){const x=-115+rand()*350,z=-185+rand()*360;if(near(x,z,22)||Math.hypot(x-42,z)<36)continue;tree(x,z,.8+rand()*.9);}
 function building(x,z,h,w=8){const g=new T.Group();g.position.set(x,0,z);box(g,w,h,7,'#e9dfbc',0,h/2,0);box(g,w+.4,.35,7.5,'#f8edce',0,h+.1,0);for(let y=1.8;y<h-.4;y+=2.1)for(let dx=-w/2+1.4;dx<w/2-1;dx+=2.2){box(g,.85,1.1,.09,'#73938d',dx,y,3.55);box(g,.85,1.1,.09,'#73938d',dx,y,-3.55);}scene.add(g);}
 for(let i=0;i<44;i++){const x=-120+rand()*365,z=-185+rand()*360;if(!near(x,z,29)&&Math.hypot(x-42,z)>38)building(x,z,4+rand()*10,5+rand()*8);}
 // A miniature Knesset as the central landmark, with colonnades and a forecourt.
 const kn=new T.Group();kn.position.set(44,0,10);scene.add(kn);box(kn,39,.7,23,'#d9cdab',0,.15,0);box(kn,32,6,15,'#ddcfaa',0,3.6,0);box(kn,37,.65,19,'#f6edcf',0,7,0);box(kn,38,.25,20,'#ede3c1',0,7.5,0);
 for(let x=-16;x<=16;x+=2.7){box(kn,.65,6.5,.7,'#f4e9c5',x,3.5,9);box(kn,.65,6.5,.7,'#f4e9c5',x,3.5,-9);}for(let i=0;i<5;i++)box(kn,34,.3,1.2,'#ecdfb9',0,.6-i*.1,10+i*.8);
 const ks=label('הכנסת',10,2,'#f6edcf','#637a69',100);ks.position.set(0,7,9.6);kn.add(ks);
 cyl(kn,.09,.12,15,'#ebeee1',21,7.5,5);const flag=label('✡',4.5,2.7,'#fcf9e9','#4783b3',130);flag.position.set(23.2,13,5);kn.add(flag);
 // Starting gantry, chequered road, grandstands and campaign decorations.
 const start=new T.Group();scene.add(start);scene.userData.gantry=start;const {p,t}=track.at(0);start.position.copy(p);start.rotation.y=Math.atan2(t.x,t.z);
 for(const x of [-11.8,11.8]){box(start,.55,11,.55,'#385d4c',x,5.5,0);box(start,1.6,.6,1.8,'#e8e5c7',x,.3,0);}box(start,24.2,1.5,.8,'#e9fa91',0,10.5,0);const title=label('המרוץ לכיסא',21,1.2,'#e9fa91','#2c4938',95);title.position.set(0,10.5,-.43);title.rotation.y=Math.PI;start.add(title);const back=title.clone();back.rotation.y=0;back.position.z=.43;start.add(back);
 for(let x=-10;x<10;x++)for(let z=-1;z<1;z++){box(start,1,.025,1,(x+z)%2?'#f9f4dc':'#334d40',x+.5,.07,z+.5);}
 for(let i=0;i<5;i++){box(start,12,.6,1.2,'#d6c9a4',17,.3+i*.6,3+i*1.3);for(let j=0;j<10;j++){const c=['#cf7551','#6487b0','#e6bc61','#8bab75'][Math.floor(rand()*4)];ball(start,.26,c,12+j*1.1,1+i*.6,3+i*1.3,.8,1.3,.8);}}
 for(let s=28;s<track.length;s+=38){const side=Math.floor(s/38)%2?1:-1;const {p,t}=track.at(s,side*17.8);const pole=new T.Group();pole.position.copy(p);pole.rotation.y=Math.atan2(t.x,t.z)+(side>0?Math.PI/2:-Math.PI/2);scene.add(pole);box(pole,.12,3.2,.12,'#ddd8b8',0,1.6,0);const sign=label(['עוד סיבוב בחירות','זהירות: ספין','הבטחות ללא כיסוי','פנייה פוליטית חדה','61 זה רק ההתחלה'][Math.floor(s/38)%5],4.5,1.2,'#f5edcb','#436048',75);sign.position.y=3.2;pole.add(sign);}
 // Bunting across the starting straight.
 for(let z of [16,35])for(let i=0;i<17;i++){const triangle=new T.Mesh(new T.ConeGeometry(.4,.7,3),mat(['#ee8759','#f0d274','#72a6b5','#edf2cb'][i%4]));triangle.rotation.z=Math.PI;triangle.position.set(-10+i*1.25,10-Math.sin(i/16*Math.PI)*1.5,z);scene.add(triangle);}
 // Background hills, clouds and a warm sun.
 for(let i=0;i<17;i++){const a=i/17*Math.PI*2;const hill=new T.Mesh(new T.IcosahedronGeometry(35+rand()*30,1),mat(i%2?'#a9c392':'#a2be8c'));hill.position.set(35+Math.cos(a)*220,-7,Math.sin(a)*205);hill.scale.y=.4;scene.add(hill);}
 for(let i=0;i<13;i++){const g=new T.Group();g.position.set(-170+rand()*370,40+rand()*30,-155+rand()*300);for(let j=0;j<3;j++)ball(g,4+rand()*3,'#f5f3dc',j*5,0,0,1,.4,.55);scene.add(g);}
 addCircuitDetails(scene,track);
 return samples;
}
export function makePickup(type){const g=new T.Group();
 if(type==='ramp'){const platform=box(g,5,.3,4,'#bc82e7',0,.4,0);platform.rotation.x=-.19;for(const x of [-2.5,2.5])box(g,.15,.35,4,'#ffeac0',x,.3,0);const sign=label('↑',2.2,2.2,'#bc82e7','#fff2bc',145);sign.rotation.x=-Math.PI/2;sign.position.set(0,.83,.5);g.add(sign);}
 if(type==='box'){const b=box(g,1.4,1.4,1.4,'#e9d16f',0,1.7,0);b.rotation.z=.15;for(const z of [-.72,.72]){const q=label('?',.95,1,'#e9d16f','#fffcec',140);q.position.set(0,1.7,z);if(z<0)q.rotation.y=Math.PI;g.add(q);}const ring=new T.Mesh(new T.TorusGeometry(1.05,.06,6,24),mat('#faf1b1'));ring.rotation.x=Math.PI/2;ring.position.y=.4;g.add(ring);}
 if(type==='coin'){box(g,.65,.9,.11,'#fff6d6',0,1.2,0);const note=label('61',.5,.6,'#fff6d6','#4391a4',130);note.position.set(0,1.2,.06);g.add(note);}
 if(type==='barrier'){for(const x of [-.75,.75])box(g,.14,1.3,.2,'#637568',x,.65,0);box(g,2.05,.65,.5,'#dc805d',0,1,0);for(const x of [-.7,0,.7]){const b=box(g,.24,.59,.03,'#fae9be',x,1,-.27);b.rotation.z=.35;}const sign=label('ספין!',1.3,.43,'#f5edcb','#a24e36',100);sign.position.set(0,1.7,-.1);sign.rotation.y=Math.PI;g.add(sign);}
 if(type==='boost'){box(g,3.5,.07,6.4,'#45cce0',0,.1,0);for(let z=-2.3;z<2.5;z+=1.2){const a=box(g,.15,.02,1.1,'#f0ffb1',-.35,.14,z);a.rotation.y=-.7;const b=box(g,.15,.02,1.1,'#f0ffb1',.35,.14,z);b.rotation.y=.7;}}
 return g;
}
// Merge static colored geometry by material to keep the scene responsive on laptops and phones.
export function batchStatic(root,exclude=new Set()){
 root.updateMatrixWorld(true);const groups=new Map(),inverse=root.matrixWorld.clone().invert(),remove=[];
 root.traverse(m=>{if(!m.isMesh||m.material.map||m.material.vertexColors||Array.isArray(m.material)||exclude.has(m))return;const key=m.material;let bucket=groups.get(key);if(!bucket){bucket=[];groups.set(key,bucket);}const geo=(m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone());geo.applyMatrix4(inverse.clone().multiply(m.matrixWorld));bucket.push(geo);remove.push(m);});
 for(const [material,list] of groups){const merged=new T.BufferGeometry();for(const attr of ['position','normal','uv']){const parts=list.map(g=>g.getAttribute(attr));if(parts.some(p=>!p))continue;const length=parts.reduce((s,p)=>s+p.array.length,0),buffer=new Float32Array(length);let offset=0;for(const p of parts){buffer.set(p.array,offset);offset+=p.array.length;}merged.setAttribute(attr,new T.BufferAttribute(buffer,parts[0].itemSize));}const mesh=new T.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);list.forEach(g=>g.dispose());}remove.forEach(m=>m.removeFromParent());
}

function addCircuitDetails(scene,track){
 const rand=rng(74161);
 function along(s,x=0){const g=new T.Group(),{p,t}=track.at(s,x);g.position.copy(p);if(Math.abs(x)>=17)g.position.y=0;g.rotation.y=Math.atan2(t.x,t.z);scene.add(g);return g;}
 // Four visual districts, each with a color gate and its own landmark.
 SECTORS.slice(1).forEach((section,i)=>{const g=along(section.start*track.length);for(const x of [-12.1,12.1]){box(g,.65,10.6,.65,'#f8f2df',x,5.3,0);box(g,1.5,.7,1.7,section.color,x,.35,0);box(g,.22,6.7,.15,section.color,x,4.2,-.36);}box(g,24.7,1.05,.6,section.color,0,10.8,0);const text=label(section.name,15,.88,section.color,'#213946',95);text.position.set(0,10.8,-.33);text.rotation.y=Math.PI;g.add(text);for(const x of [-9,9]){const number=label('0'+(i+2),2,.88,section.color,'#213946',110);number.position.set(x,10.8,-.34);number.rotation.y=Math.PI;g.add(number);}});
 // Bank-side chevrons and reflective bollards telegraph the sharp turns early.
 for(let s=18;s<track.length;s+=9){const bend=track.bend(s),side=bend>0?1:-1;
  for(const edge of [-1,1]){const g=along(s,edge*12.1);box(g,.16,1.1,.16,'#f4edce',0,.55,0);box(g,.18,.22,.18,SECTORS[sectorAt(s,track.length)].color,0,.94,0);}
  if(Math.abs(bend)>.015&&Math.floor(s/9)%2===0){const g=along(s,side*14.3);box(g,.12,2,.12,'#526d5d',0,1,0);const sign=label(bend>0?'❮❮❮':'❯❯❯',3.6,1.3,'#243c45','#efff9b',110);sign.position.set(0,2.4,0);sign.rotation.y=Math.PI;g.add(sign);}
 }
 // Elevated promenade: guardrails, crossbeams and warm sandstone bridge piers.
 for(let s=track.length*.24;s<track.length*.39;s+=6){const g=along(s);for(const x of [-14.3,14.3]){box(g,.28,1.25,.28,'#ded2b4',x,.63,0);box(g,.24,.19,6.2,'#937ad6',x,1.28,0);box(g,.13,.12,6.2,'#d0c2fa',x,.72,0);}const h=g.position.y+.7;for(const x of [-7.6,7.6])box(g,1.3,h,1.7,'#d6c7a8',x,-h/2-.12,0);box(g,24,.45,1,'#d6c7a8',0,-.38,0);}
 // Market hairpin: striped awnings, produce crates and campaign café counters.
 for(let i=0;i<12;i++){const s=track.length*(.49+i*.011),side=i%2?1:-1,g=along(s,side*(20+i%3));g.rotation.y+=side>0?-Math.PI/2:Math.PI/2;const color=['#e98758','#54b9bb','#e4b94f'][i%3];box(g,4.4,1.35,2.2,'#c99f69',0,.67,0);for(const x of [-2,2])box(g,.14,3.7,.14,'#957655',x,1.85,0);for(let stripe=0;stripe<8;stripe++){const awning=box(g,.6,.16,3.8,stripe%2?'#fff0cc':color,-2.1+stripe*.6,3.65,.25);awning.rotation.x=.12;}for(let j=0;j<6;j++)ball(g,.27,j%2?'#ed7851':'#a7c855',(j-2.5)*.55,1.58,.4);const sign=label(['קפה קואליציה','פלאפל 61','הבטחות בשקל'][i%3],3.7,.65,color,'#273b35',80);sign.position.set(0,2.55,1.05);g.add(sign);}
 // Monumental ballot box and a balloon: landmarks you can recognize at speed.
 const ballot=along(track.length*.58,-30);box(ballot,6,6,6,'#f6eed6',0,3,0);box(ballot,6.3,.45,6.3,'#3784af',0,6.2,0);box(ballot,3.7,.035,.48,'#253c45',0,6.445,0);const paper=box(ballot,2.6,3.4,.1,'#fffdf0',0,7.9,0);paper.rotation.z=.17;const number=label('61',4,3,'#f6eed6','#2f7599',145);number.position.set(0,3.5,-3.04);number.rotation.y=Math.PI;ballot.add(number);
 const balloon=along(track.length*.12,30);const envelope=ball(balloon,4.8,'#f2ba58',0,19,0,1,1.23,1);for(const x of [-1.3,1.3])cyl(balloon,.035,.035,4,'#f6edcf',x,12.5,0);box(balloon,2.8,1.4,2,'#976c49',0,10.8,0);const balloonText=label('61',5,3,'#f2ba58','#314b40',140);balloonText.position.set(0,19,-4.82);balloonText.rotation.y=Math.PI;balloon.add(balloonText);
 // Park hairpin: flower beds, stylized cypresses and a windmill on the skyline.
 for(let i=0;i<22;i++){const g=along(track.length*(.77+i*.007),i%2?19:-19);for(let j=0;j<4;j++){cyl(g,.04,.04,.48,'#547c48',(j-1.5)*.5,.24,0,5);ball(g,.17,['#f2c552','#e58aaa','#dcd4f4'][i%3],(j-1.5)*.5,.59,0);}}
 const mill=along(track.length*.83,-29);cyl(mill,2,3.5,11,'#e6d9b7',0,5.5,0);cyl(mill,0,3.1,3,'#b87b56',0,12.5,0,8);for(let i=0;i<4;i++){const blade=new T.Group();blade.position.set(0,10,-3);blade.rotation.z=Math.PI/4+i*Math.PI/2;box(blade,.23,6,.18,'#866c4c',0,2.8,0);box(blade,.95,3.7,.11,'#f5ebcf',.4,3.9,0);mill.add(blade);}ball(mill,.42,'#7f674c',0,10,-3.15);
 for(let s=45;s<track.length;s+=60){const g=along(s,18);for(let i=0;i<3;i++){cyl(g,.12,.19,1.5,'#8e7857',i*1.8,.75,0,6);cyl(g,.05,.7,4,'#4e825b',i*1.8,3.1,0,7);}}
}
