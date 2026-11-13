// Original, clear two-stage success chime for quiz answers.
const fs = require('node:fs');
const path = require('node:path');
const sampleRate = 22050;
const length = 1.2;
const samples = new Float32Array(Math.ceil(sampleRate * length));
const notes = [
  { hz: 523.25, at: 0, gain: 0.27 },
  { hz: 659.25, at: 0.14, gain: 0.25 },
  { hz: 783.99, at: 0.28, gain: 0.25 },
];
for (const note of notes) {
  const start = Math.floor(note.at * sampleRate);
  for (let i = 0; i + start < samples.length; i++) {
    const t = i / sampleRate;
    const envelope = (1 - Math.exp(-t * 65)) * Math.exp(-t * 4.5);
    const wave = Math.sin(2 * Math.PI * note.hz * t)
      + 0.15 * Math.sin(4 * Math.PI * note.hz * t);
    samples[start + i] += note.gain * envelope * wave;
  }
}
const data = Buffer.alloc(samples.length * 2);
for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(data.length + 36, 4);
header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(data.length, 40);
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'answer-chime.wav'), Buffer.concat([header, data]));
