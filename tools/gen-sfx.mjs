// Generates the game's sound effects and announcer lines with ElevenLabs, into dist/assets/sfx/.
// The key stays on this machine: the output is plain mp3 files and a manifest the game loads.
//
//   npm run sfx                      generate whatever is missing
//   npm run sfx -- --force           regenerate everything
//   npm run sfx -- --only hit,land   (re)generate just these (sfx names or announcer text)
//   npm run sfx -- --no-voice        skip the announcer
//   npm run sfx -- --list            show what would be generated
import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SFX, VOICE } from './sfx-catalog.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = path.join(root, 'dist/assets/sfx');
const API = 'https://api.elevenlabs.io/v1';
const FORMAT = 'mp3_44100_128';

try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {}
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const force = flag('--force') || !!only;
const key = process.env.ELEVENLABS_API_KEY?.trim();
const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || 'pNInz6obpgDQGcFmaJgB';
const ttsModel = process.env.ELEVENLABS_TTS_MODEL?.trim() || 'eleven_v3';

const exists = f => access(f).then(() => true, () => false);
const voiceFile = text => 'voice-' + Object.keys(VOICE).indexOf(text) + '.mp3';

async function call(url, body) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify(body)
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const detail = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise(r => setTimeout(r, 2000 * attempt));
      continue;
    }
    throw new Error(`${res.status} ${detail.slice(0, 300)}`);
  }
}

const soundEffect = s =>
  call(`${API}/sound-generation?output_format=${FORMAT}`, {
    text: s.prompt,
    duration_seconds: s.seconds,
    prompt_influence: s.influence ?? 0.45,
    loop: !!s.loop,
    model_id: 'eleven_text_to_sound_v2'
  });
const speech = text =>
  call(`${API}/text-to-speech/${voiceId}?output_format=${FORMAT}`, {
    text,
    model_id: ttsModel,
    language_code: 'he'
  });

// Build the job list.
const jobs = [];
for (const [name, s] of Object.entries(SFX)) {
  const n = s.variants ?? 1;
  for (let i = 1; i <= n; i++) {
    const file = n > 1 ? `${name}-${i}.mp3` : `${name}.mp3`;
    jobs.push({ label: name, file, wanted: !only || only.has(name), run: () => soundEffect(s) });
  }
}
if (!flag('--no-voice'))
  for (const [text, prompt] of Object.entries(VOICE))
    jobs.push({ label: `🎙 ${text}`, file: voiceFile(text), wanted: !only || only.has(text), run: () => speech(prompt) });

if (flag('--list')) {
  for (const j of jobs) console.log(`${j.file.padEnd(22)} ${j.label}`);
  process.exit(0);
}
if (!key) {
  console.error('Missing ELEVENLABS_API_KEY. Put it in coalition-chaos/.env (see .env.example).');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
let made = 0,
  failed = 0;
for (const j of jobs) {
  const target = path.join(outDir, j.file);
  if (!j.wanted || (!force && (await exists(target)))) continue;
  process.stdout.write(`… ${j.label} → ${j.file}`);
  try {
    await writeFile(target, await j.run());
    made++;
    console.log('  ✓');
  } catch (err) {
    failed++;
    console.log(`  ✗ ${err.message}`);
  }
}

// The manifest lists only files that exist, so a partial run still plays.
const manifest = { sfx: {}, voice: {} };
for (const [name, s] of Object.entries(SFX)) {
  const n = s.variants ?? 1,
    files = [];
  for (let i = 1; i <= n; i++) {
    const file = n > 1 ? `${name}-${i}.mp3` : `${name}.mp3`;
    if (await exists(path.join(outDir, file))) files.push(file);
  }
  if (files.length) manifest.sfx[name] = { files, volume: s.volume ?? 0.6, ...(s.loop && { loop: true }) };
}
for (const text of Object.keys(VOICE))
  if (await exists(path.join(outDir, voiceFile(text)))) manifest.voice[text] = voiceFile(text);
await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(
  `\nGenerated ${made}, failed ${failed}. Manifest: ${Object.keys(manifest.sfx).length} sounds, ${Object.keys(manifest.voice).length} announcer lines.`
);
if (failed) process.exitCode = 1;
