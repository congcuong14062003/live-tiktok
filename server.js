'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const source = require('./legacy_bank.js');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 8094);
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const clients = new Set();
const QUESTION_COUNT = 15;
// Mỗi chu kỳ 30 câu có đủ A1–C2; C1 và C2 xuất hiện mỗi cấp một lần.
const MIX_LEVELS = [...Array(10).fill('A1'), ...Array(8).fill('A2'), ...Array(7).fill('B1'),
  ...Array(3).fill('B2'), 'C1', 'C2'];
const MEANING_OVERRIDES = {
  release: 'phát hành', grey: 'màu xám (cách viết Anh-Anh)',
  choice: 'sự lựa chọn', impressive: 'gây ấn tượng',
  recognise: 'nhận ra (cách viết Anh-Anh)', analyse: 'phân tích (cách viết Anh-Anh)',
  enforce: 'thực thi luật lệ', substantial: 'có quy mô đáng kể',
  emphasise: 'nhấn mạnh (cách viết Anh-Anh)',
  prioritise: 'ưu tiên (cách viết Anh-Anh)',
};
const ADVANCED_WORDS = {
  C1: 'bias dilemma incentive inequality integrity nuance precedent resilience setback stigma turmoil abstract abundant adverse analogy autonomous breakthrough candid deliberate dynamic enormous identical optimism tangible versatile'.split(' '),
  C2: 'apathy conundrum eccentricity fortitude paradox serendipity trepidation admonish ameliorate circumvent expedite squander vindicate ephemeral tenacious transient irony eloquent lucid ominous poignant staunch stoic uncanny zealous'.split(' '),
};
const VIDEO_WORDS = {
  A2: [{ word: 'blind', meaning: 'bị mù', level: 'A2' }],
  B1: [{ word: 'consist', meaning: 'gồm có', level: 'B1' }, { word: 'globe', meaning: 'quả địa cầu', level: 'B1' }],
  B2: [{ word: 'luxury', meaning: 'sự sang trọng', level: 'B2' }],
};

function normalizeRow(row, level) {
  const word = row?.[0]?.match(/“([^”]+)”/)?.[1]?.trim().toLowerCase();
  const meaning = row?.[1]?.[row?.[2]]?.trim();
  if (!word || !meaning || !/^[a-z]+$/.test(word) || word.length < 3 || word.length > 16 || meaning.length > 48) return null;
  return { word, meaning: MEANING_OVERRIDES[word] || meaning, level };
}
function loadExtraBank() {
  const parsed = Object.fromEntries(LEVELS.map(level => [level, []]));
  let level = '';
  for (const line of fs.readFileSync(path.join(__dirname, 'extra_bank.tsv'), 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/^\[[A-C][12]\]$/.test(line)) { level = line.slice(1, -1); continue; }
    const [word, meaning, ...rest] = line.split('|');
    if (!level || rest.length || !/^[a-z]{3,16}$/.test(word) || !meaning?.trim() || meaning.length > 48) {
      throw new Error(`Mục từ bổ sung không hợp lệ: ${line}`);
    }
    parsed[level].push({ word, meaning: MEANING_OVERRIDES[word] || meaning.trim(), level });
  }
  return parsed;
}
const extraBank = loadExtraBank();
const seenWords = new Set();
const bank = Object.fromEntries(LEVELS.map(level => {
  const selected = ADVANCED_WORDS[level] ? new Set(ADVANCED_WORDS[level]) : null;
  const rows = source[level].map(row => normalizeRow(row, level))
    .filter(row => row && (!selected || selected.has(row.word)));
  rows.push(...(VIDEO_WORDS[level] || []), ...extraBank[level]);
  for (const row of rows) {
    if (seenWords.has(row.word)) throw new Error(`Từ bị trùng: ${row.word}`);
    seenWords.add(row.word);
  }
  if (selected && rows.length !== selected.size) throw new Error(`Thiếu từ cấp ${level}`);
  return [level, rows];
}));
const stats = { total: LEVELS.reduce((n, level) => n + bank[level].length, 0), byLevel: Object.fromEntries(LEVELS.map(level => [level, bank[level].length])) };
if (stats.total !== 2000) throw new Error(`Ngân hàng phải có 2.000 từ; hiện có ${stats.total}`);
function shuffle(rows) {
  const copy = rows.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
let queues = {}, levelDeck = [];
function resetQueues() {
  queues = Object.fromEntries(LEVELS.map(level => [level, { rows: shuffle(bank[level]), at: 0 }]));
  levelDeck = [];
}
function drawQuestion(levelMode, previousWord) {
  for (let attempts = 0; attempts < 12; attempts++) {
    if (!levelDeck.length) levelDeck = shuffle(MIX_LEVELS);
    const level = levelMode === 'MIX' ? levelDeck.pop() : levelMode;
    const queue = queues[level];
    if (queue.at >= queue.rows.length) { queue.rows = shuffle(bank[level]); queue.at = 0; }
    const question = queue.rows[queue.at++];
    if (question.word !== previousWord) return question;
  }
  return queues[levelMode === 'MIX' ? 'A1' : levelMode].rows[0];
}
const LETTERS = ['A', 'B', 'C', 'D'];
function meaningCore(value) {
  return value.toLowerCase().normalize('NFC').replace(/\([^)]*\)/g, '')
    .replace(/(?:^|\s)(?:sự|việc|cái|một)(?=\s)/gu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function spellingDistance(left, right) {
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 0; i < left.length; i++) {
    const current = [i + 1];
    for (let j = 0; j < right.length; j++) {
      current.push(Math.min(current[j] + 1, previous[j + 1] + 1, previous[j] + (left[i] === right[j] ? 0 : 1)));
    }
    previous = current;
  }
  return previous[right.length];
}
function withChoices(question) {
  const targetMeaning = meaningCore(question.meaning);
  const distractors = shuffle(bank[question.level].filter(row => {
    const otherMeaning = meaningCore(row.meaning);
    return row.word !== question.word && spellingDistance(row.word, question.word) > 2
      && otherMeaning !== targetMeaning
      && !(targetMeaning.length >= 4 && otherMeaning.includes(targetMeaning))
      && !(otherMeaning.length >= 4 && targetMeaning.includes(otherMeaning));
  }));
  const close = distractors.filter(row => Math.abs(row.word.length - question.word.length) <= 2);
  const picked = close.slice(0, 3);
  if (picked.length < 3) picked.push(...distractors.filter(row => !picked.includes(row)).slice(0, 3 - picked.length));
  const options = shuffle([question.word, ...picked.map(row => row.word)]);
  if (options.length !== 4) throw new Error(`Không đủ lựa chọn cho ${question.word}`);
  return { ...question, options, correctOption: LETTERS[options.indexOf(question.word)] };
}
resetQueues();
const state = {
  status: 'idle', phase: 'idle', level: 'MIX', think: 10, reveal: 3, breaktime: 18,
  question: null, questionNumber: 0, match: 1, phaseStart: Date.now(), phaseDuration: 0,
  pausedAt: 0, revision: 0, voicePreviewRevision: 0, voice: { supported: false, available: false, name: '' }, previous: null, answers: [], scores: {}, firstCorrect: null,
  chat: { status: 'disconnected', username: 'aimoingay.tips', message: 'Chưa kết nối bình luận TikTok.', received: 0, lastCommentAt: null, deliveryLagMs: null, lastComment: null },
};
let correctThisQuestion = new Set();
let connection = null, reconnectTimer = null, shouldConnect = false;

function startQuestion(now) {
  state.previous = state.question ? { word: state.question.word, meaning: state.question.meaning, correctOption: state.question.correctOption } : null;
  state.question = withChoices(drawQuestion(state.level, state.question?.word));
  state.questionNumber = (state.questionNumber % QUESTION_COUNT) + 1;
  if (state.questionNumber === 1 && state.previous) { state.match++; state.scores = {}; }
  state.phase = 'think'; state.phaseStart = now; state.phaseDuration = state.think;
  state.firstCorrect = null; correctThisQuestion = new Set(); state.revision++;
}
function transition(now) {
  if (state.phase === 'think') {
    state.phase = 'answer'; state.phaseStart = now; state.phaseDuration = state.reveal; state.revision++;
  } else if (state.phase === 'answer') {
    if (state.questionNumber === QUESTION_COUNT && state.breaktime > 0) {
      state.phase = 'outro'; state.phaseStart = now; state.phaseDuration = state.breaktime; state.revision++;
    } else startQuestion(now);
  } else if (state.phase === 'outro') startQuestion(now);
}
function advance(now = Date.now()) {
  if (state.status !== 'running' || state.phase === 'idle') return;
  while (now - state.phaseStart >= state.phaseDuration * 1000) {
    const end = state.phaseStart + state.phaseDuration * 1000;
    transition(end);
  }
}
function answerKey(text) {
  return String(text || '').normalize('NFKC').trim().match(/^([A-D])[.!?]?$/i)?.[1]?.toUpperCase() || '';
}
function safeAvatarUrl(value) {
  if (typeof value !== 'string' || value.length > 1024) return '';
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}
function receiveComment(input, broadcastNow = true) {
  advance();
  const id = String(input.id || input.username || '').slice(0, 80);
  const name = String(input.name || input.username || 'Người xem').replace(/[\r\n\t]/g, ' ').trim().slice(0, 28);
  const username = String(input.username || '').replace(/^@/, '').replace(/[\r\n\t]/g, '').trim().slice(0, 30);
  const avatar = safeAvatarUrl(input.avatar);
  const content = String(input.content || '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 60);
  if (!id || !content) return false;
  const open = Boolean(state.question && state.status === 'running' && state.phase === 'think');
  const selected = answerKey(content);
  const correct = open && selected === state.question.correctOption;
  let points = 0;
  if (correct && !correctThisQuestion.has(id)) {
    points = state.firstCorrect ? 10 : 13;
    if (!state.firstCorrect) state.firstCorrect = name;
    correctThisQuestion.add(id);
    const old = state.scores[id] || { name, username, avatar, points: 0, correct: 0 };
    state.scores[id] = { name, username: username || old.username, avatar: avatar || old.avatar, points: old.points + points, correct: old.correct + 1 };
  }
  const status = !open ? state.status === 'paused' ? 'paused' : state.phase === 'answer' || state.phase === 'outro' ? 'late' : 'waiting'
    : correct ? points ? 'correct' : 'duplicate' : selected ? 'wrong' : 'chat';
  state.answers.unshift({ name, content, correct, points, status });
  state.answers = state.answers.slice(0, 8);
  if (broadcastNow) broadcast();
  return correct;
}
function normalizeTikTokChat(event) {
  const user = event.user || {};
  return {
    id: user.id?.toString() || user.userId?.toString() || user.displayId || user.uniqueId,
    username: user.displayId || user.uniqueId,
    name: user.nickname || user.displayId || user.uniqueId,
    avatar: user.avatarThumb?.urlList?.[0] || user.avatarMedium?.urlList?.[0],
    content: event.content || event.comment,
  };
}
function estimateDeliveryLag(createTime, receivedAt = Date.now()) {
  const raw = Number(createTime);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const sentAt = raw > 1e12 ? raw : raw > 1e9 ? raw * 1000 : 0;
  const lag = receivedAt - sentAt;
  return lag >= -1000 && lag <= 300000 ? Math.max(0, lag) : null;
}
function leaderboard() {
  return Object.entries(state.scores).map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => b.points - a.points || b.correct - a.correct || a.name.localeCompare(b.name, 'vi')).slice(0, 10);
}
function snapshot() {
  const clock = state.status === 'paused' ? state.pausedAt : Date.now();
  const elapsed = (clock - state.phaseStart) / 1000;
  return {
    ...state, scores: undefined, leaderboard: leaderboard(),
    remaining: state.phase === 'idle' ? 0 : Math.max(0, state.phaseDuration - elapsed),
    duration: state.phaseDuration, total: stats.total, serverNow: Date.now(),
  };
}
function broadcast() {
  const message = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const client of clients) { try { client.write(message); } catch { clients.delete(client); } }
}

function setChat(status, message) { state.chat.status = status; state.chat.message = message; broadcast(); }
function scheduleReconnect() {
  if (!shouldConnect || reconnectTimer) return;
  reconnectTimer = setTimeout(() => { reconnectTimer = null; void connectChat(); }, 15000);
}
async function connectChat() {
  if (!shouldConnect || connection) return;
  setChat('connecting', `Đang kết nối @${state.chat.username}...`);
  let current;
  try {
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = await import('tiktok-live-connector');
    if (!shouldConnect || connection) return;
    current = new TikTokLiveConnection(state.chat.username, { processInitialData: false });
    connection = current;
    current.on(WebcastEvent.CHAT, event => {
      if (!shouldConnect || connection !== current) return;
      const input = normalizeTikTokChat(event);
      state.chat.received++;
      state.chat.lastCommentAt = Date.now();
      state.chat.deliveryLagMs = estimateDeliveryLag(event.common?.createTime, state.chat.lastCommentAt);
      const previous = state.answers[0];
      receiveComment(input, false);
      const latest = state.answers[0];
      state.chat.lastComment = latest !== previous
        ? { name: latest.name, content: latest.content, status: latest.status }
        : { name: String(input.name || 'Người xem').slice(0, 28), content: String(input.content || '').slice(0, 60), status: 'invalid' };
      broadcast();
    });
    current.on(ControlEvent.ERROR, ({ info, exception }) => {
      if (!shouldConnect || connection !== current) return;
      const message = String(exception?.message || info || 'Lỗi kết nối TikTok').slice(0, 160);
      setChat('error', message);
      if (connection === current) {
        connection = null;
        void Promise.resolve(current.disconnect()).catch(() => {});
        scheduleReconnect();
      }
    });
    current.on(ControlEvent.DISCONNECTED, () => {
      if (!shouldConnect || connection !== current) return;
      if (connection === current) connection = null;
      setChat('disconnected', 'Mất kết nối bình luận, sẽ thử lại sau 15 giây.');
      scheduleReconnect();
    });
    await current.connect();
    if (!shouldConnect) { await current.disconnect(); return; }
    if (connection !== current) return;
    setChat('connected', `Đã kết nối bình luận @${state.chat.username}.`);
  } catch (error) {
    if (!shouldConnect || (current && connection !== current)) return;
    connection = null;
    setChat('error', `${String(error.message || error).slice(0, 130)} · Thử lại sau 15 giây.`);
    scheduleReconnect();
  }
}
async function disconnectChat() {
  shouldConnect = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  const current = connection; connection = null;
  if (current) try { await current.disconnect(); } catch {}
  setChat('disconnected', 'Đã ngắt kết nối bình luận TikTok.');
}

function control(input) {
  const now = Date.now();
  const action = input.action;
  if (action === 'start') {
    state.level = [...LEVELS, 'MIX'].includes(input.level) ? input.level : 'MIX';
    state.think = Math.max(3, Math.min(60, Number(input.think) || 10));
    state.reveal = Math.max(1, Math.min(15, Number(input.reveal) || 3));
    const requestedBreak = Number(input.breaktime);
    state.breaktime = requestedBreak === 0 ? 0 : Math.max(15, Math.min(30, requestedBreak || 18));
    state.status = 'running'; state.phase = 'idle'; state.question = null;
    state.questionNumber = 0; state.match = 1; state.previous = null;
    state.scores = {}; state.answers = []; state.firstCorrect = null; resetQueues(); startQuestion(now);
  } else if (action === 'pause' && state.status === 'running') {
    state.pausedAt = now; state.status = 'paused'; state.revision++;
  } else if (action === 'resume' && state.status === 'paused') {
    state.phaseStart += now - state.pausedAt; state.status = 'running'; state.revision++;
  } else if (action === 'next' && state.status !== 'idle') {
    startQuestion(now); if (state.status === 'paused') state.pausedAt = now;
  } else if (action === 'reset') {
    state.status = 'idle'; state.phase = 'idle'; state.question = null; state.revision++;
  } else if (action === 'test-comment') {
    receiveComment({ id: 'test:' + String(input.name || '').trim().toLowerCase(), name: input.name, content: input.content });
  } else if (action === 'preview-voice') {
    state.voicePreviewRevision++;
  } else if (action === 'voice-status') {
    state.voice = { supported: Boolean(input.supported), available: Boolean(input.available), name: String(input.name || '').slice(0, 80) };
  } else if (action === 'clear-scores') {
    state.scores = {}; broadcast();
  } else return 'Thao tác không hợp lệ với trạng thái hiện tại';
  broadcast();
  return null;
}

function sendJson(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
const assets = new Map([
  ['/admin.html', 'text/html; charset=utf-8'], ['/live.html', 'text/html; charset=utf-8'],
  ['/live.js', 'application/javascript; charset=utf-8'],
  ['/music.mp3', 'audio/mpeg'], ['/tick.mp3', 'audio/mpeg'], ['/reveal.mp3', 'audio/mpeg'], ['/next.mp3', 'audio/mpeg'],
  ['/assets/chill-loop.m4a', 'audio/mp4'],
  ['/assets/answer-chime.m4a', 'audio/mp4'],
  ['/assets/rose-satin.jpg', 'image/jpeg'],
  ['/fonts/nunito-latin-wght-normal.woff2', 'font/woff2'],
  ['/fonts/nunito-latin-ext-wght-normal.woff2', 'font/woff2'],
  ['/fonts/nunito-vietnamese-wght-normal.woff2', 'font/woff2'],
]);
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (url.pathname === '/events' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(snapshot())}\n\n`); clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  if (url.pathname === '/state' && req.method === 'GET') return sendJson(res, 200, snapshot());
  if (url.pathname === '/bank-stats' && req.method === 'GET') return sendJson(res, 200, stats);
  if (url.pathname === '/control' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 10000) req.destroy(); });
    req.on('end', async () => {
      let input;
      try { input = JSON.parse(body); } catch { return sendJson(res, 400, { error: 'JSON không hợp lệ' }); }
      if (input.action === 'connect-chat') {
        const username = String(input.username || '').replace(/^@/, '').trim();
        if (!/^[a-zA-Z0-9_.]{2,30}$/.test(username)) return sendJson(res, 400, { error: 'Tên TikTok không hợp lệ.' });
        await disconnectChat(); state.chat.username = username; state.chat.received = 0; state.chat.lastCommentAt = null; state.chat.deliveryLagMs = null; state.chat.lastComment = null; shouldConnect = true; void connectChat();
        return sendJson(res, 200, snapshot());
      }
      if (input.action === 'disconnect-chat') { await disconnectChat(); return sendJson(res, 200, snapshot()); }
      const error = control(input);
      return sendJson(res, error ? 400 : 200, error ? { error } : snapshot());
    });
    return;
  }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const pathname = url.pathname === '/' ? '/admin.html' : url.pathname;
  if (!assets.has(pathname)) return sendJson(res, 404, { error: 'Not found' });
  fs.readFile(path.join(__dirname, pathname.slice(1)), (error, bytes) => {
    if (error) return sendJson(res, 500, { error: 'Không đọc được file' });
    res.writeHead(200, { 'Content-Type': assets.get(pathname), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(bytes);
  });
});
if (require.main === module) {
  setInterval(() => { advance(); broadcast(); }, 200);
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Cổng ${PORT} đang được sử dụng.` : error); process.exit(1); });
  server.listen(PORT, HOST, () => {
    console.log(`QUIZ LIVE • http://${HOST}:${PORT}/admin.html`);
    console.log(`MÀN HÌNH LIVE • http://${HOST}:${PORT}/live.html`);
    console.log(`NGÂN HÀNG • ${stats.total} từ, A1–C2`);
  });
}
module.exports = { server, state, stats, bank, withChoices, control, receiveComment, normalizeTikTokChat, estimateDeliveryLag, advance, answerKey, snapshot };
