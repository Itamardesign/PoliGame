import * as T from './vendor/three.module.min.js';
import {E,C,F,sub,paint,sculpt} from './kart-sculpt.js';
import {FACES} from './kart-faces.js';
// Heads: each leader's real (freely licensed) portrait is projected onto a 3D head whose relief
// follows that photo's landmarks. Bodies: SDF-sculpted suits matching the same photos.
const LOOKS=[
 {id:'netanyahu',W:1.06,L:1,skin:'#dc9e7c',lip:'#c07a70',eye:'#7d8c7c',eyeR:.108,lid:.55,lidTilt:-.25,bags:true,
  brow:'#b3b6b8',browT:.036,browY:[.2,.26,.2],nose:{l:1.05,w:1.25,tip:1.35},jaw:{w:.68,chin:.21,chinY:0},cheek:1.15,jowl:true,
  mouth:{w:.95,smile:.012,asym:.025,thin:true},wrinkles:2,folds:true,
  hair:'#e7e8ea',hairDark:'#b8bcc1',hairStyle:'silverBack',
  body:{suit:'#161b2c',shirt:'#f4f6f9',tie:'#1f6fe0',w:1.05,pin:true}},
 {id:'lapid',W:.98,L:1.04,skin:'#d9a081',lip:'#bb7a6e',eye:'#687f8c',eyeR:.108,lid:.18,lidTilt:.05,
  brow:'#4a4d52',browT:.048,browY:[.21,.23,.2],nose:{l:1,w:.95,tip:.95},jaw:{w:.66,chin:.27,chinY:-.01,square:true},cheek:.85,
  mouth:{w:1.15,smile:.04,asym:0,teeth:true},wrinkles:0,folds:true,
  hair:'#c9cdd1',hairDark:'#8c9298',hairStyle:'volume',
  body:{suit:'#15181d',shirt:'#c9daf0',tie:'#1c3f4a',w:1,pin:true}},
 {id:'golan',W:.9,L:1.1,skin:'#d49a77',lip:'#b77566',eye:'#7496a4',eyeR:.108,lid:.3,lidTilt:-.1,
  brow:'#8f9088',browT:.03,browY:[.2,.24,.19],nose:{l:1.25,w:.9,tip:.95},jaw:{w:.54,chin:.2,chinY:-.03},cheek:.8,
  mouth:{w:.95,smile:.025,asym:.01,thin:true},wrinkles:3,folds:true,
  hair:'#b9bab2',hairDark:'#8e8f88',hairStyle:'bald',
  body:{suit:'#2c3d5c',shirt:'#c6daf2',tie:'#1c2748',w:.95}},
 {id:'lieberman',W:1.16,L:.98,skin:'#dca086',lip:'#b77a70',eye:'#5f6e72',eyeR:.095,lid:.5,lidTilt:.2,
  brow:'#6e6d69',browT:.05,browY:[.16,.23,.24],nose:{l:.95,w:1.2,tip:1.15},jaw:{w:.74,chin:.25,chinY:0},cheek:1.1,
  mouth:{w:.95,smile:-.012,asym:0},wrinkles:1,folds:false,
  hair:'#a4a39e',hairDark:'#7e7d78',hairStyle:'shaved',beard:{col:'#95938d',dark:'#6f6d68',t:.035},
  body:{suit:'#1e2433',shirt:'#bcd3ee',tie:'#28305c',w:1.2,neck:1.25}},
 {id:'deri',W:1.05,L:1.02,skin:'#b97e5c',lip:'#a8665c',eye:'#4a3526',eyeR:.108,lid:.3,lidTilt:-.05,
  brow:'#76726a',browT:.04,browY:[.21,.25,.2],nose:{l:1.1,w:1.15,tip:1.1},jaw:{w:.66,chin:.22,chinY:0},cheek:1,
  mouth:{w:1,smile:.03,asym:.005},wrinkles:1,folds:true,
  hair:'#a3a098',hairDark:'#77746e',hairStyle:'cropped',beard:{col:'#dcd9d1',dark:'#a9a69e',t:.07},glasses:'thin',kippah:'velvet',
  body:{suit:'#1b2233',shirt:'#fbfaf7',tie:'#1e2a44',w:1.08}},
 {id:'bengvir',W:1.12,L:.96,skin:'#dca380',lip:'#bf7b6e',eye:'#553f2c',eyeR:.108,lid:.1,lidTilt:0,
  brow:'#33261c',browT:.042,browY:[.22,.24,.21],nose:{l:.95,w:1.05,tip:1.12},jaw:{w:.7,chin:.24,chinY:.02},cheek:1.35,
  mouth:{w:1.05,smile:.035,asym:.01,teeth:true},wrinkles:0,folds:false,stubble:'#a9876f',
  hair:'#33251b',hairDark:'#1f170f',hairStyle:'dark',glasses:'round',kippah:'knit',
  body:{suit:'#1d2c4f',shirt:'#f7f8fb',tie:'#2b4ea0',w:1.12}}
];
function bodyOps(c){const b=c.body,w=b.w,nk=b.neck||1,o=[],add=x=>o.push(x),sides=[-1,1],S=c.skin;
 add(E([0,1.5,-.08],[.6*w,.55,.42],b.suit,{k:.1}));add(C([-.45*w,1.86,-.08],[.45*w,1.86,-.08],.2,b.suit,{k:.18}));
 for(const s of sides){add(C([s*.58*w,1.82,-.06],[s*.66*w,1.46,.18],.15,b.suit,{k:.08}));add(C([s*.66*w,1.46,.18],[s*.53,1.41,.5],.13,b.suit,{k:.06}));add(C([s*.535,1.41,.5],[s*.52,1.41,.55],.118,b.shirt,{k:.015}));
  add(E([s*.49,1.42,.62],[.12,.1,.13],S,{k:.05}));add(C([s*.44,1.46,.62],[s*.4,1.5,.72],.04,S,{k:.03}));}
 add(C([0,1.86,-.05],[0,2.2,-.05],.2*nk,S,{k:.06}));
 // Shirt V between the lapels, painted then creased along the lapel edges.
 const v=b.open?.52:.42;paint(F((x,y,z)=>Math.max(Math.abs(x)-(y-1.28)*v,1.28-y,.05-z),[0,1.75,.25],.6,b.shirt),b.shirt,.012);
 for(const s of sides)sub(C([s*.02,1.3,.34],[s*.3*v/.42,2.0,.26],.012),null,.015);
 for(const s of sides)add(C([s*.2*nk,2.0,.02],[s*.05,1.9,.25],.05,b.shirt,{k:.03}));
 if(b.tie){paint(F((x,y,z)=>Math.max(Math.abs(x)-.045-(1.92-y)*.05,1.36-y,y-1.92,.05-z),[0,1.65,.3],.4,b.tie),b.tie,.008);add(E([0,1.89,.28],[.055,.045,.05],b.tie,{k:.02}));}
 else paint(F((x,y,z)=>Math.max(Math.abs(x)-(y-1.72)*.38,1.72-y,.05-z),[0,1.9,.2],.4,S),S,.012);
 add(E([0,1.24,.3],[.03,.03,.02],'#111418',{k:.01}));
 if(b.pin){add(E([.24,1.78,.31],[.035,.025,.02],'#ffffff',{k:.008}));paint(E([.24,1.78,.33],[.012,.012,.02]),'#2e63c7',.006);}
 return o;}
const cache=new Map(),skinMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.62}),baseMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.85});
// Preload the face photos so the driver-select portraits render with faces on the first frame.
const photos=new Map();
if(typeof document!=='undefined')await Promise.all(Object.keys(FACES).map(async id=>{const img=new Image();img.src='./assets/faces/'+id+'.jpg';try{await img.decode();photos.set(id,img);}catch{}}));
function faceMaterial(id){const img=photos.get(id);if(!img)return new T.MeshStandardMaterial({color:FACES[id].skin,roughness:.8});
 // Feather the crop into an ellipse so the photo melts into the 3D hair/skin base at the edges.
 const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d');x.filter='saturate(1.18) contrast(1.06) brightness(1.03)';x.drawImage(img,0,0);x.globalAlpha=.55;x.filter='blur(2px) saturate(1.2)';x.drawImage(img,0,0);x.globalAlpha=1;x.filter='none';x.globalCompositeOperation='destination-in';
 x.save();x.translate(c.width/2,c.height/2);x.scale(c.width/2*.98,c.height/2*1.06);const g=x.createRadialGradient(0,0,.8,0,0,1);g.addColorStop(0,'#000');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(-1,-1,2,2);x.restore();
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;
 return new T.MeshStandardMaterial({map:t,vertexColors:true,transparent:true,roughness:.78,emissive:'#ffffff',emissiveMap:t,emissiveIntensity:.28});}
const gauss=(x,y,cx,cy,sx,sy)=>Math.exp(-((x-cx)**2/(2*sx*sx)+(y-cy)**2/(2*sy*sy)));
function headShape(id){const f=FACES[id],[bx,by,bw,bh]=f.box,Hw=.64,Hh=Hw*bh/bw,D=.74;
 const P=([px,py])=>[((px-bx)/bw-.5)*2*Hw,(.5-(py-by)/bh)*2*Hh];
 const [e1,e2]=f.eyes.map(P),n=P(f.nose),m=P(f.mouth),ey=(e1[1]+e2[1])/2,ex=(e1[0]+e2[0])/2;
 // Landmark-driven relief: brow, eye sockets, nose bridge and tip, muzzle, chin and cheekbones.
 const relief=(x,y)=>.15*gauss(x,y,n[0],n[1]+.03,.075,.07)+.075*gauss(x,y,(ex+n[0])/2,(ey+n[1])/2,.055,.12)
  -.05*gauss(x,y,e1[0],e1[1],.08,.055)-.05*gauss(x,y,e2[0],e2[1],.08,.055)+.035*gauss(x,y,ex,ey+.11,.3,.045)
  +.045*gauss(x,y,m[0],m[1],.17,.08)+.035*gauss(x,y,m[0],m[1]-.2,.12,.08)+.02*gauss(x,y,e1[0]-.06,ey-.14,.09,.07)+.02*gauss(x,y,e2[0]+.06,ey-.14,.09,.07);
 const hc=new T.Color(f.hair),sc=new T.Color(f.skin);
 const make=inflate=>{const g=new T.SphereGeometry(1,80,60),p=g.getAttribute('position'),uv=g.getAttribute('uv'),col=[];
  for(let i=0;i<p.count;i++){const sx=p.getX(i),sy=p.getY(i),sz=p.getZ(i),q=(Math.abs(sx)**2.6+Math.abs(sy)**2.6+Math.abs(sz)**2.6)**(1/2.6),ux=sx/q,uy=sy/q,uz=sz/q;const y=uy*Hh,x=ux*Hw*.93*(1-.14*Math.max(0,-uy)**2);let z=uz*D;if(uz>0)z+=relief(x,y)*uz*uz;
   p.setXYZ(i,x*inflate,y*inflate,z*inflate);uv.setXY(i,x/(2*Hw)+.5,y/(2*Hh)+.5);
   if(inflate>1){const a=Math.min(1,Math.max(0,(uz-.05)/.35));col.push(1,1,1,a);}
   else{const hair=Math.min(1,Math.max(0,(uy+.5-.3*Math.max(0,uz))/.22))*(uz>.35?Math.min(1,Math.max(0,(uy-.55)/.15)):1);col.push(sc.r+(hc.r-sc.r)*hair,sc.g+(hc.g-sc.g)*hair,sc.b+(hc.b-sc.b)*hair);}}
  g.setAttribute('color',new T.Float32BufferAttribute(col,inflate>1?4:3));g.computeVertexNormals();return g;};
 return {base:make(1),shell:make(1.006),Hw,Hh,D,ey};}
function kippah(head,kind,s){const theta=Math.PI*(kind==='velvet'?.19:.2),geo=new T.SphereGeometry(1,40,10,0,Math.PI*2,0,theta),p=geo.getAttribute('position'),col=[];
 const bands=kind==='velvet'?[[1,'#121316']]:[[.5,'#f3f1eb'],[.58,'#d8d5cb'],[.88,'#f3f1eb'],[1,'#dcd9d0']];
 for(let i=0;i<p.count;i++){const t=Math.acos(Math.min(1,p.getY(i)))/theta,c=new T.Color(bands.find(([e])=>t<=e+1e-6)[1]);col.push(c.r,c.g,c.b);}
 geo.setAttribute('color',new T.Float32BufferAttribute(col,3));geo.scale(s.Hw*.93*1.03,s.Hh*1.025,s.D*1.03);
 const m=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:kind==='velvet'?.95:.85,side:T.DoubleSide}));m.rotation.x=kind==='velvet'?-.62:-.12;m.castShadow=true;head.add(m);}
function build(index){if(cache.has(index))return cache.get(index);const c=LOOKS[index];
 const g={body:sculpt(bodyOps(c),[-1,.85,-.6],[1,2.35,.9],.035),shape:headShape(c.id),face:faceMaterial(c.id)};cache.set(index,g);return g;}
export function makeDriver(index){const c=LOOKS[index],g=build(index),s=g.shape,root=new T.Group(),head=new T.Group(),eyes=[];
 const body=new T.Mesh(g.body,skinMat);body.castShadow=true;root.add(body);
 head.position.set(0,1.98+s.Hh,-.04);root.add(head);
 const base=new T.Mesh(s.base,baseMat);base.castShadow=true;head.add(base);const face=new T.Mesh(s.shell,g.face);head.add(face);
 for(const side of [-1,1]){const ear=new T.Mesh(new T.SphereGeometry(1,16,12),new T.MeshStandardMaterial({color:FACES[c.id].skin,roughness:.8}));ear.scale.set(.06,.17,.11);ear.position.set(side*s.Hw*.9,s.ey-.08,-.05);head.add(ear);}
 if(c.kippah)kippah(head,c.kippah,s);
 root.userData={head,eyes,look:c};return root;}
