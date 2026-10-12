import * as T from './vendor/three.module.min.js';
import { encountersFor, encounterAt } from './kart-encounters.js';
import { textCanvasTexture } from './world-kit.js';

// Watermelon rind: dark green stripes over pale green, wrapped around the ball.
let rindTexture, warningTexture;
const rind = () =>
  (rindTexture ??= textCanvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7fae4f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2f5a24';
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      const x = (i / 14) * w;
      ctx.moveTo(x, 0);
      for (let y = 0; y <= h; y += 16) ctx.lineTo(x + Math.sin(y * 0.09 + i) * 7, y);
      for (let y = h; y >= 0; y -= 16) ctx.lineTo(x + 16 + Math.sin(y * 0.09 + i) * 7, y);
      ctx.fill();
    }
  }));
// Israeli warning sign: white triangle, red border, black exclamation mark.
const warning = () =>
  (warningTexture ??= textCanvasTexture(256, 256, (ctx, w) => {
    ctx.clearRect(0, 0, w, w);
    ctx.beginPath();
    ctx.moveTo(w / 2, 14);
    ctx.lineTo(w - 12, w - 22);
    ctx.lineTo(12, w - 22);
    ctx.closePath();
    ctx.fillStyle = '#d42a2a';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w / 2, 52);
    ctx.lineTo(w - 44, w - 42);
    ctx.lineTo(44, w - 42);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(w / 2 - 9, 100, 18, 70);
    ctx.beginPath();
    ctx.arc(w / 2, 192, 11, 0, Math.PI * 2);
    ctx.fill();
  }));

export function makeEncounterWorld(scene, track, box, label, mat) {
  const objects = encountersFor(track.id).map(e => {
    const frame = track.at(e.u * track.length),
      root = new T.Group();
    root.position.copy(frame.p);
    root.rotation.y = Math.atan2(frame.t.x, frame.t.z);
    scene.add(root);
    const actor = new T.Group();
    root.add(actor);
    if (e.kind === 'ball') {
      // A giant watermelon escaped from the market, rolling across the road.
      const ball = new T.Mesh(
        new T.SphereGeometry(1.8, 24, 16),
        new T.MeshStandardMaterial({ map: rind(), roughness: 0.55 })
      );
      ball.scale.set(1, 0.92, 1.12);
      ball.position.y = 1.7;
      ball.castShadow = true;
      actor.add(ball);
      actor.userData.ball = ball;
      for (const side of [-1, 1]) {
        box(root, 0.12, 2.6, 0.12, '#8a9096', side * 11.4, 1.3, 9);
        const sign = new T.Mesh(
          new T.PlaneGeometry(1.5, 1.5),
          new T.MeshBasicMaterial({ map: warning(), transparent: true, side: T.DoubleSide })
        );
        sign.position.set(side * 11.4, 2.9, 9);
        root.add(sign);
      }
    } else {
      // A gilded arch over a lane: drive through it for three ballots and a boost.
      const gold = new T.MeshStandardMaterial({
        color: '#e6b94f',
        metalness: 0.25,
        roughness: 0.35,
        emissive: '#3a2a08'
      });
      for (const side of [-1, 1]) {
        const post = new T.Mesh(new T.BoxGeometry(0.4, 5, 0.4), gold);
        post.position.set(side * 2.3, 2.5, 0);
        post.castShadow = true;
        actor.add(post);
      }
      const beam = new T.Mesh(new T.BoxGeometry(5, 0.5, 0.5), gold);
      beam.position.y = 5;
      actor.add(beam);
      const sign = label('+3 פתקים', 3.6, 0.8, '#1d2533', '#f2c14e', 110);
      sign.position.set(0, 4.25, -0.27);
      sign.rotation.y = Math.PI;
      actor.add(sign);
      const pad = box(actor, 4.2, 0.04, 4.6, '#2a2618', 0, 0.09, 0);
      pad.material = new T.MeshStandardMaterial({ color: '#2a2618', emissive: '#6a5014', roughness: 0.6 });
      actor.userData.pad = pad;
    }
    return { e, actor };
  });
  return {
    update(time, lap) {
      for (const { e, actor } of objects) {
        actor.position.x = -encounterAt(e, time, lap).x;
        if (e.kind === 'ball') actor.userData.ball.rotation.z = Math.sin(time * 1.3 + e.u * 19) * 3.8;
        else
          actor.userData.pad.material.emissive.set('#6a5014').multiplyScalar(0.5 + 0.3 * Math.sin(time * 4));
      }
    }
  };
}
