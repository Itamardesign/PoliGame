// Physical key codes also work while the desktop keyboard is set to Hebrew.
export const KEY_ACTIONS = Object.freeze({ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'accelerate',KeyW:'accelerate',ArrowDown:'brake',KeyS:'brake',ShiftLeft:'drift',ShiftRight:'drift'});
export function readControls(keys,touches=new Set()){
 const result={left:false,right:false,accelerate:false,brake:false,drift:false};
 for(const code of keys){const action=KEY_ACTIONS[code];if(action)result[action]=true;}
 for(const action of touches)if(action in result)result[action]=true;
 return result;
}
