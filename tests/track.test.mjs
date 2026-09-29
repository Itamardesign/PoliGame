import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {makeTrack} from '../dist/kart-world.js';
import {ROAD,SECTORS,sectorAt} from '../dist/race-model.js';
const track=makeTrack();
test('positive steering is screen-right throughout the circuit, not mirrored',()=>{for(let s=0;s<track.length;s+=8){const {p,t}=track.at(s),camera=new T.PerspectiveCamera(55,1,.1,200);camera.position.copy(p).addScaledVector(t,-14);camera.position.y+=8;camera.lookAt(track.at(s+12).p);camera.updateMatrixWorld();const center=p.clone().project(camera),right=track.at(s,3).p.project(camera);assert.ok(right.x>center.x,`steering reversed at ${s}`);}});
test('road is 20 units wide, loop closes, and expanded corners have no folded inner edge',()=>{assert.equal(ROAD.halfWidth*2,20);assert.ok(track.length>800);assert.ok(track.at(0).p.distanceTo(track.at(track.length).p)<.001);for(let s=0;s<track.length;s+=1){assert.ok(Math.abs(track.bend(s))*ROAD.halfWidth<.95);}});
test('each named district is reachable and cycles at the finish',()=>{for(let i=0;i<SECTORS.length;i++)assert.equal(sectorAt((SECTORS[i].start+.01)*track.length,track.length),i);assert.equal(sectorAt(track.length,track.length),0);});
