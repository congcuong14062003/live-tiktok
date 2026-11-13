const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const muted = params.get('mute') === '1';
let volume = Number(params.get('volume') ?? '0.65');
if (!Number.isFinite(volume)) volume = 0.65;
volume = Math.max(0, Math.min(1, volume));

const sounds = {};
for (const [name, gain] of Object.entries({ music: 0.34, correct: 0.68, reveal: 0.82, next: 0.12 })) {
  const source = name === 'music' ? '/assets/chill-loop.m4a'
    : name === 'correct' || name === 'reveal' ? '/assets/answer-chime.m4a' : '/' + name + '.mp3';
  const audio = new Audio(source);
  audio.preload = 'auto';
  audio.loop = name === 'music';
  audio.volume = muted ? 0 : volume * gain;
  sounds[name] = audio;
}
let audioContext = null;
function softTick(secondsLeft) {
  if (muted) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') void audioContext.resume();
    const start = audioContext.currentTime;
    const tone = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(secondsLeft === 1 ? 880 : 720, start);
    tone.frequency.exponentialRampToValueAtTime(secondsLeft === 1 ? 760 : 620, start + 0.17);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * (secondsLeft === 1 ? 0.14 : 0.10)), start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    tone.connect(envelope).connect(audioContext.destination);
    tone.start(start);
    tone.stop(start + 0.23);
  } catch (_) {}
}
function play(name) {
  if (muted) return;
  const audio = sounds[name];
  if (name === 'reveal') { sounds.correct.pause(); sounds.correct.currentTime = 0; }
  if (name !== 'music') { audio.pause(); audio.currentTime = 0; }
  audio.play().then(() => $('sound-unlock').hidden = true)
    .catch(() => { if (name === 'music') $('sound-unlock').hidden = false; });
}
$('sound-unlock').onclick = () => {
  if (audioContext?.state === 'suspended') void audioContext.resume();
  if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
  play('music');
};
function box(tag, cls, text) {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function avatar(player, cls) {
  const holder = box('span', cls, '');
  const initial = Array.from((player?.name || player?.username || '?').trim())[0]?.toUpperCase() || '?';
  holder.textContent = initial;
  if (player?.avatar) {
    const image = document.createElement('img');
    image.src = player.avatar;
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.onerror = () => image.remove();
    holder.append(image);
  }
  return holder;
}
function speechVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices().filter(v => /^en[-_]/i.test(v.lang));
  return voices.find(v => /google|english.*united states|american/i.test(v.name)) || voices[0] || null;
}
function reportVoice() {
  if (muted) return;
  const voice = speechVoice();
  void fetch('/control', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'voice-status', supported: 'speechSynthesis' in window, available: Boolean(voice), name: voice?.name || '' })
  }).catch(() => {});
}
if ('speechSynthesis' in window) window.speechSynthesis.addEventListener('voiceschanged', reportVoice);
reportVoice();
let speechActive = false;
function speakEnglish(text) {
  if (muted || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  speechActive = false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.voice = speechVoice();
  utterance.rate = 0.83;
  utterance.pitch = 1;
  utterance.volume = Math.min(1, volume * 0.95);
  utterance.onstart = () => { speechActive = true; sounds.music.volume = volume * 0.08; };
  utterance.onend = utterance.onerror = () => {
    speechActive = false;
    sounds.music.volume = muted ? 0 : volume * 0.34;
  };
  window.speechSynthesis.speak(utterance);
}
function celebrate() {
  const confetti = $('confetti');
  confetti.replaceChildren(...Array.from({ length: 36 }, (_, i) => {
    const piece = box('i', 'confetti-piece', '');
    piece.style.left = `${(i * 37.7) % 100}%`;
    piece.style.animationDelay = `${(i * 0.13) % 2}s`;
    piece.style.animationDuration = `${2.9 + (i % 5) * 0.24}s`;
    piece.style.background = ['#f7c879', '#bba8eb', '#96d9b3', '#f2a9b7'][i % 4];
    return piece;
  }));
}

let state = null, received = 0, lastKey = '', lastRevision = -1, lastTick = -1;
let lastCelebratedMatch = null;
let lastVoicePreviewRevision = null;
let lastQuestionSpeech = '';
let lastCorrectSoundKey = '';
let lastLeadersView = '', lastAnswersView = '', lastChoicesView = '', lastOutroView = '';
function render(s) {
  state = s; received = performance.now(); $('disconnect').hidden = true;
  const previewEnglish = lastVoicePreviewRevision !== null && s.voicePreviewRevision !== lastVoicePreviewRevision;
  lastVoicePreviewRevision = s.voicePreviewRevision;
  const leaders = s.leaderboard || [];
  const leadersView = JSON.stringify(leaders);
  if (leadersView !== lastLeadersView) {
    lastLeadersView = leadersView;
  $('podium').replaceChildren(...[1, 0, 2].map(i => {
    const player = leaders[i];
    const item = box('div', 'podium-item' + (i === 0 ? ' first' : ''), '');
    item.append(box('span', 'medal', i === 0 ? '👑' : i === 1 ? '🥈' : '🥉'), avatar(player, 'podium-avatar'),
      box('span', 'name', player ? player.name : '—'), box('span', 'score', player ? `${player.points} điểm` : 'Chưa có điểm'));
    return item;
  }));
  $('leaderboard').replaceChildren(...(leaders.length ? leaders.map((player, i) => {
    const row = box('div', 'rank-row', '');
    row.append(box('span', 'rank-name', `${i === 0 ? '👑' : i + 1}  ${player.name}`),
      box('span', 'rank-number', player.correct), box('span', 'rank-points', player.points));
    return row;
  }) : [box('div', 'empty', 'Chưa có người chơi.')]));
  }
  const answers = s.answers || [];
  const answersView = JSON.stringify(answers);
  if (answersView !== lastAnswersView) {
    lastAnswersView = answersView;
  $('answers').replaceChildren(...(answers.length ? answers.map(answer => {
    const row = box('div', 'guess-row', '');
    const main = box('div', 'guess-main', '');
    main.append(box('span', 'guess-name', answer.name), box('span', 'guess-text', answer.content));
    const feedback = answer.points ? `+${answer.points}` : ({ wrong: 'sai', late: 'muộn', paused: 'dừng', waiting: 'chờ', duplicate: 'đã tính', chat: 'chat' }[answer.status] || '—');
    row.append(main, box('span', 'guess-points' + (answer.points ? '' : ' wrong'), feedback));
    return row;
  }) : [box('div', 'empty', 'Chưa có bình luận.')]));
  }
  $('match').textContent = s.match;
  $('chat-indicator').textContent = ({ connected: 'CHAT LIVE', connecting: 'ĐANG KẾT NỐI', error: 'LỖI CHAT' }[s.chat.status] || 'CHƯA KẾT NỐI');
  $('chat-indicator').parentElement.classList.toggle('offline', s.chat.status !== 'connected');
  $('outro-match').textContent = `KẾT QUẢ HIỆP ${s.match}`;
  if (leadersView !== lastOutroView) {
  lastOutroView = leadersView;
  $('outro-list').replaceChildren(...[0, 1, 2].map(i => {
    const player = leaders[i];
    const row = box('div', 'outro-row' + (i === 0 ? ' first' : ''), '');
    const identity = box('div', 'outro-identity', '');
    identity.append(box('span', 'outro-name', player ? player.name : 'Chưa có người chơi'),
      box('span', 'outro-username', player?.username ? `@${player.username}` : ''));
    row.append(box('span', 'outro-medal', ['🥇', '🥈', '🥉'][i]), avatar(player, 'outro-avatar'),
      identity, box('span', 'outro-points', player ? `${player.points} điểm` : '—'));
    return row;
  }));
  }
  $('outro').hidden = s.phase !== 'outro';
  if (s.phase === 'outro' && leaders.length && lastCelebratedMatch !== s.match) {
    lastCelebratedMatch = s.match;
    celebrate();
  }
  if (s.phase !== 'outro') $('confetti').replaceChildren();
  if (!s.question) {
    lastKey = ''; lastRevision = s.revision; lastCelebratedMatch = null;
    lastQuestionSpeech = '';
    $('meaning').textContent = 'Sẵn sàng học tiếng Anh?'; $('choices').replaceChildren(); lastChoicesView = '';
    $('question-count').textContent = 'CÂU 0 / 15'; $('answer-line').textContent = 'Chờ bắt đầu từ trang điều khiển';
    $('footer-state').textContent = 'Đang chờ bắt đầu'; sounds.music.pause();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    speechActive = false;
    if (previewEnglish) speakEnglish('person');
    return;
  }
  const key = `${s.match}|${s.questionNumber}|${s.question.word}`;
  const correctSoundKey = `${key}|${s.phaseStart}`;
  if (s.firstCorrect && s.phase === 'think' && lastCorrectSoundKey !== correctSoundKey) {
    lastCorrectSoundKey = correctSoundKey;
    play('correct');
  }
  if (key !== lastKey) {
    lastKey = key; $('meaning').textContent = s.question.meaning;
    $('meaning').className = 'meaning' + (s.question.meaning.length > 31 ? ' very-long' : s.question.meaning.length > 22 ? ' long' : '');
  }
  $('level').textContent = s.question.level;
  $('question-count').textContent = `CÂU ${s.questionNumber} / 15`;
  $('previous').textContent = s.previous ? `Câu trước: ${s.previous.correctOption} · ${s.previous.word.toUpperCase()}` : 'Bình luận A, B, C hoặc D để lên bảng điểm!';
  const revealed = s.phase === 'answer', word = s.question.word;
  const choicesView = `${key}|${revealed}|${s.question.options.join(',')}`;
  if (choicesView !== lastChoicesView) {
  lastChoicesView = choicesView;
  $('choices').replaceChildren(...s.question.options.map((option, i) => {
    const choice = box('div', 'choice' + (revealed ? option === word ? ' correct' : ' dim' : ''), '');
    choice.append(box('span', 'choice-label', 'ABCD'[i]), box('span', 'choice-word', option.toUpperCase()));
    return choice;
  }));
  }
  $('answer-line').replaceChildren();
  if (revealed) $('answer-line').append('Đáp án  ', box('strong', '', `${s.question.correctOption} · ${word.toUpperCase()}`));
  else $('answer-line').textContent = 'Bình luận A, B, C hoặc D · Không phân biệt hoa/thường';
  $('notice').textContent = revealed ? 'Hết giờ · Đã khóa điểm câu này' : s.phase === 'outro' ? 'Chúc mừng những người chơi xuất sắc!' : 'Trả lời đúng: +10 điểm · Đúng đầu tiên: +13 điểm';
  $('footer-state').textContent = s.phase === 'think' ? 'Đang nhận đáp án' : s.phase === 'answer' ? 'Đã khóa điểm' : 'Tổng kết';
  if (s.revision !== lastRevision) {
    if (lastRevision !== -1 && s.status === 'running') {
      if (revealed) play('reveal');
      else if (s.phase === 'think') play('next');
    }
    const speechKey = `${key}|${s.phase}`;
    if (s.status === 'running' && speechKey !== lastQuestionSpeech) {
      if (revealed) setTimeout(() => {
        if (state?.status === 'running' && state.phase === 'answer'
          && state.match === s.match && state.questionNumber === s.questionNumber
          && state.question?.word === word) speakEnglish(word);
      }, 700);
      lastQuestionSpeech = speechKey;
    }
    lastRevision = s.revision; lastTick = -1;
  }
  if (s.status === 'running' && s.phase !== 'outro' && sounds.music.paused) play('music');
  else if (s.status !== 'running' || s.phase === 'outro') sounds.music.pause();
  if (previewEnglish) speakEnglish(word);
}
function frame() {
  if (state?.question) {
    let remain = state.remaining;
    if (state.status === 'running') remain -= Math.max(0, performance.now() - received) / 1000;
    remain = Math.max(0, remain);
    const thinking = state.phase === 'think';
    $('fill').style.transform = `scaleX(${thinking ? Math.min(1, remain / (state.duration || 1)) : 0})`;
    $('seconds').textContent = thinking ? `${Math.ceil(remain)}s` : '0s';
    $('timer-label').textContent = thinking ? 'THỜI GIAN TRẢ LỜI' : state.phase === 'answer' ? 'ĐÃ KHÓA ĐIỂM' : 'TỔNG KẾT';
    if (thinking && state.status === 'running') {
      const tick = Math.ceil(remain);
      if (tick !== lastTick) { if (tick > 0 && tick <= 5 && lastTick !== -1) softTick(tick); lastTick = tick; }
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
const events = new EventSource('/events');
events.onmessage = event => { try { render(JSON.parse(event.data)); } catch (error) { console.error(error); } };
events.onerror = () => { $('disconnect').hidden = false; sounds.music.pause(); };
