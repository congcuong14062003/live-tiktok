// Original 32-second instrumental loop: soft electric-piano chords and bell notes.
const fs = require('node:fs');
const path = require('node:path');

const sampleRate = 22050;
const seconds = 32;
const samples = new Float32Array(sampleRate * seconds);
const chords = [
  [53, 57, 60, 64], // Fmaj7
  [50, 53, 57, 60], // Dm7
  [46, 50, 53, 57], // Bbmaj7
  [48, 52, 55, 62], // Cadd9
];
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const fade = (time, duration) => Math.min(1, time / 0.8, (duration - time) / 1.1);

for (let chordIndex = 0; chordIndex < 4; chordIndex++) {
  const start = chordIndex * 8 * sampleRate;
  for (const note of chords[chordIndex]) {
    const frequency = hz(note);
    for (let i = 0; i < 8 * sampleRate; i++) {
      const time = i / sampleRate;
      const envelope = Math.max(0, fade(time, 8));
      const wave = Math.sin(2 * Math.PI * frequency * time)
        + 0.23 * Math.sin(4 * Math.PI * frequency * time)
        + 0.07 * Math.sin(6 * Math.PI * frequency * time);
      samples[start + i] += 0.048 * envelope * wave;
    }
  }
  // A sparse, descending bell phrase leaves space for the countdown cue.
  const phrase = [chords[chordIndex][3] + 12, chords[chordIndex][2] + 12,
    chords[chordIndex][1] + 12, chords[chordIndex][2] + 12];
  phrase.forEach((note, step) => {
    const frequency = hz(note);
    const offset = Math.floor((chordIndex * 8 + step * 2 + 0.25) * sampleRate);
    for (let i = 0; i < 1.75 * sampleRate && offset + i < samples.length; i++) {
      const time = i / sampleRate;
      const envelope = (1 - Math.exp(-time * 35)) * Math.exp(-time * 2.3);
      const wave = Math.sin(2 * Math.PI * frequency * time)
        + 0.35 * Math.sin(4 * Math.PI * frequency * time);
      samples[offset + i] += 0.075 * envelope * wave;
    }
  });
}

// Smooth the loop seam without adding a sharp stop.
for (let i = 0; i < samples.length; i++) {
  const position = i / sampleRate;
  const edge = Math.min(1, position / 0.7, (seconds - position) / 0.7);
  samples[i] *= Math.max(0, edge);
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
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'chill-loop.wav'), Buffer.concat([header, data]));
