import * as T from './vendor/three.module.min.js';
// Tiny SDF sculpting kit: primitives are smoothly blended ("clay"), carved, and painted,
// then meshed with surface nets. Normals come from the field gradient, colours are baked per vertex.
const hex=h=>{const c=new T.Color(h);return[c.r,c.g,c.b];};
const len=(x,y,z)=>Math.sqrt(x*x+y*y+z*z);
export function E(c,r,col,o={}){return{t:'e',c,r,col:col&&hex(col),k:o.k??.08,m:o.m||'add',soft:o.soft??.03,g:o.g,amt:o.amt??1,bc:c,br:Math.max(...r)};}
export function C(a,b,r,col,o={}){const r2=o.r2??r,bc=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];return{t:'c',a,b,r,r2,col:col&&hex(col),k:o.k??.06,m:o.m||'add',soft:o.soft??.03,g:o.g,amt:o.amt??1,bc,br:len(b[0]-a[0],b[1]-a[1],b[2]-a[2])/2+Math.max(r,r2)};}
// Custom field with an explicit bounding sphere.
export function F(f,bc,br,col,o={}){return{t:'f',f,col:col&&hex(col),k:o.k??.05,m:o.m||'add',soft:o.soft??.03,g:o.g,amt:o.amt??1,bc,br};}
export const sub=(op,col,k)=>Object.assign(op,{m:'sub',k:k??op.k,col:col?hex(col):null});
export const paint=(op,col,soft=.03,amt=1)=>Object.assign(op,{m:'paint',col:hex(col),soft,amt});
function prim(o,x,y,z){let d;
 if(o.t==='e'){const px=(x-o.c[0])/o.r[0],py=(y-o.c[1])/o.r[1],pz=(z-o.c[2])/o.r[2],k0=len(px,py,pz),k1=len(px/o.r[0],py/o.r[1],pz/o.r[2]);d=k1>1e-9?k0*(k0-1)/k1:-Math.min(...o.r);}
 else if(o.t==='c'){const bx=o.b[0]-o.a[0],by=o.b[1]-o.a[1],bz=o.b[2]-o.a[2],px=x-o.a[0],py=y-o.a[1],pz=z-o.a[2];let h=(px*bx+py*by+pz*bz)/(bx*bx+by*by+bz*bz);h=h<0?0:h>1?1:h;d=len(px-bx*h,py-by*h,pz-bz*h)-(o.r+(o.r2-o.r)*h);}
 else d=o.f(x,y,z);
 // Combed-hair grooves: a shallow ripple across the strand direction.
 if(o.g&&d<.05)d+=o.g[3]*Math.sin((x*o.g[0]+y*o.g[1]+z*o.g[2]));
 return d;}
export function field(ops,x,y,z,col){let d=1e9;
 for(const o of ops){const dc=len(x-o.bc[0],y-o.bc[1],z-o.bc[2])-o.br-.03;
  if(o.m==='add'){if(dc>d+o.k)continue;const di=prim(o,x,y,z);let h=.5+.5*(di-d)/o.k;h=h<0?0:h>1?1:h;d=di*(1-h)+d*h-o.k*h*(1-h);if(col&&o.col){for(let i=0;i<3;i++)col[i]=o.col[i]*(1-h)+col[i]*h;}}
  else if(o.m==='sub'){if(dc>o.k)continue;const di=-prim(o,x,y,z);let h=.5-.5*(di-d)/o.k;h=h<0?0:h>1?1:h;const nd=di*(1-h)+d*h+o.k*h*(1-h);if(col&&o.col){const w=Math.min(1,Math.max(0,(nd-d)/o.k*2));for(let i=0;i<3;i++)col[i]+=(o.col[i]-col[i])*w;}d=nd;}
  else if(col){if(dc>o.soft)continue;const di=prim(o,x,y,z);if(di>o.soft)continue;const w=o.amt*(di<=0?1:1-di/o.soft);for(let i=0;i<3;i++)col[i]+=(o.col[i]-col[i])*w;}}
 return d;}
export function sculpt(ops,min,max,step){
 const n=[0,1,2].map(a=>Math.ceil((max[a]-min[a])/step)+1),[nx,ny,nz]=n,V=new Float32Array(nx*ny*nz);
 // Narrow band: a coarse pass per 6-cell block; only blocks near the surface are sampled exactly.
 const B=6,bn=n.map(v=>Math.ceil(v/B)),coarse=new Float32Array(bn[0]*bn[1]*bn[2]),R=Math.sqrt(3)*B/2*step*1.35+.02;
 for(let k=0;k<bn[2];k++)for(let j=0;j<bn[1];j++)for(let i=0;i<bn[0];i++)coarse[i+bn[0]*(j+bn[1]*k)]=field(ops,min[0]+(i*B+B/2)*step,min[1]+(j*B+B/2)*step,min[2]+(k*B+B/2)*step);
 for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const c=coarse[((i/B)|0)+bn[0]*(((j/B)|0)+bn[1]*((k/B)|0))];V[i+nx*(j+ny*k)]=Math.abs(c)>R?c:field(ops,min[0]+i*step,min[1]+j*step,min[2]+k*step);}
 const cell=new Int32Array((nx-1)*(ny-1)*(nz-1)).fill(-1),pos=[],C8=[[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]],EDGES=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
 const at=(i,j,k)=>V[i+nx*(j+ny*k)],ci=(i,j,k)=>i+(nx-1)*(j+(ny-1)*k);
 for(let k=0;k<nz-1;k++)for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){const v=C8.map(([a,b,c])=>at(i+a,j+b,k+c));let neg=0;for(const x of v)if(x<0)neg++;if(neg===0||neg===8)continue;
  let sx=0,sy=0,sz=0,m=0;for(const [a,b] of EDGES){if((v[a]<0)===(v[b]<0))continue;const t=v[a]/(v[a]-v[b]),A=C8[a],B=C8[b];sx+=A[0]+(B[0]-A[0])*t;sy+=A[1]+(B[1]-A[1])*t;sz+=A[2]+(B[2]-A[2])*t;m++;}
  cell[ci(i,j,k)]=pos.length/3;pos.push(min[0]+(i+sx/m)*step,min[1]+(j+sy/m)*step,min[2]+(k+sz/m)*step);}
 const idx=[];
 for(let k=1;k<nz-1;k++)for(let j=1;j<ny-1;j++)for(let i=1;i<nx-1;i++){const v0=at(i,j,k);
  // Edges along x, y and z leaving this grid point; each crossing becomes a quad of the four surrounding cells.
  const tests=[[at(i+1,j,k),[ci(i,j-1,k-1),ci(i,j,k-1),ci(i,j,k),ci(i,j-1,k)]],[at(i,j+1,k),[ci(i-1,j,k-1),ci(i-1,j,k),ci(i,j,k),ci(i,j,k-1)]],[at(i,j,k+1),[ci(i-1,j-1,k),ci(i,j-1,k),ci(i,j,k),ci(i-1,j,k)]]];
  for(const [v1,q] of tests){if((v0<0)===(v1<0))continue;const [a,b,c,d]=q.map(x=>cell[x]);if(a<0||b<0||c<0||d<0)continue;if(v0<0)idx.push(a,b,c,a,c,d);else idx.push(a,c,b,a,d,c);}}
 const normal=[],color=[],e=step*.5,col=[0,0,0];
 for(let p=0;p<pos.length;p+=3){const x=pos[p],y=pos[p+1],z=pos[p+2];const gx=field(ops,x+e,y,z)-field(ops,x-e,y,z),gy=field(ops,x,y+e,z)-field(ops,x,y-e,z),gz=field(ops,x,y,z+e)-field(ops,x,y,z-e),l=len(gx,gy,gz)||1;normal.push(gx/l,gy/l,gz/l);
  col[0]=col[1]=col[2]=.8;field(ops,x,y,z,col);color.push(col[0],col[1],col[2]);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normal,3));geo.setAttribute('color',new T.Float32BufferAttribute(color,3));geo.setIndex(idx);geo.computeBoundingSphere();return geo;}
