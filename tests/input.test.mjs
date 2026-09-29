import test from 'node:test';
import assert from 'node:assert/strict';
import {readControls} from '../dist/kart-input.js';
test('physical WASD works regardless of keyboard layout',()=>{assert.deepEqual(readControls(new Set(['KeyW','KeyD','ShiftLeft'])),{left:false,right:true,accelerate:true,brake:false,drift:true});});
test('releasing one of two keys mapped to a direction keeps steering',()=>{const keys=new Set(['KeyA','ArrowLeft']);keys.delete('KeyA');assert.equal(readControls(keys).left,true);keys.clear();assert.equal(readControls(keys).left,false);});
test('simultaneous touch and keyboard are combined without losing either',()=>{const c=readControls(new Set(['KeyW']),new Set(['right','drift']));assert.equal(c.accelerate,true);assert.equal(c.right,true);assert.equal(c.drift,true);});
