import * as T from './vendor/three.module.min.js';
import {encountersFor,encounterAt} from './kart-encounters.js';
export function makeEncounterWorld(scene,track,box,label,mat){
 const objects=encountersFor(track.id).map(e=>{const frame=track.at(e.u*track.length),root=new T.Group();root.position.copy(frame.p);root.rotation.y=Math.atan2(frame.t.x,frame.t.z);scene.add(root);const actor=new T.Group();root.add(actor);
 if(e.kind==='ball'){
  const ball=new T.Mesh(new T.SphereGeometry(1.8,16,12),mat('#f4a85e'));ball.position.y=1.9;ball.castShadow=true;actor.add(ball);const band=new T.Mesh(new T.TorusGeometry(1.81,.13,6,28),mat('#fff2ba'));ball.add(band);const mark=label('ספין!',2.1,.7,'#fff1be','#633c3e',100);mark.position.set(0,0,-1.82);mark.rotation.y=Math.PI;ball.add(mark);actor.userData.ball=ball;
  for(let i=-4;i<=4;i++){const tile=box(root,1.2,.03,.7,'#e9af63',i*2,.06,0);tile.rotation.y=.25;}
  for(const side of [-1,1]){box(root,.25,3.8,.25,'#665b55',side*10.8,1.9,0);const sign=label('זהירות · ספין מתגלגל',5.5,.8,'#f4ba76','#4d403a',110);sign.position.set(side*10.8,4,0);sign.rotation.y=Math.PI;root.add(sign);}
 }else{
  for(const side of [-1,1]){box(actor,.45,5.4,.45,'#e5ac41',side*2.4,2.7,0);const bulb=new T.Mesh(new T.SphereGeometry(.4,8,6),new T.MeshBasicMaterial({color:'#fff3a2'}));bulb.position.set(side*2.4,5.4,0);actor.add(bulb);}box(actor,5.3,.35,.5,'#f8d677',0,5.3,0);const sign=label('בונוס הפתעה!',5,1,'#fff0a0','#4e5140',120);sign.position.set(0,4.7,-.3);sign.rotation.y=Math.PI;actor.add(sign);const pad=box(actor,4.5,.04,5,'#f5d979',0,.09,0);actor.userData.pad=pad;for(let i=0;i<3;i++){const coin=new T.Mesh(new T.OctahedronGeometry(.4),new T.MeshBasicMaterial({color:'#fff4ad'}));coin.position.set((i-1)*1.1,1.3,0);actor.add(coin);}
 }
 return{e,actor};});
 return {update(time,lap){for(const {e,actor} of objects){actor.position.x=-encounterAt(e,time,lap).x;if(e.kind==='ball')actor.userData.ball.rotation.z=Math.sin(time*1.3+e.u*19)*3.8;else actor.userData.pad.material.emissive.set('#6a5014').multiplyScalar(.5+.3*Math.sin(time*4));}}};
}
