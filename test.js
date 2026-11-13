const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { state, stats, bank, withChoices, control, receiveComment, normalizeTikTokChat, estimateDeliveryLag, advance, answerKey, snapshot } = require('./server');

assert.equal(stats.total, 2000);
assert.equal(stats.byLevel.C1, 25);
assert.equal(stats.byLevel.C2, 25);
for (const [word, meaning] of Object.entries({ blind: 'bị mù', release: 'phát hành', consist: 'gồm có', luxury: 'sự sang trọng', globe: 'quả địa cầu' })) {
  assert.equal(Object.values(bank).flat().find(row => row.word === word)?.meaning, meaning);
}
assert.equal(new Set(Object.values(bank).flat().map(row => row.word)).size, 2000);
const clueKeys = Object.values(bank).flat().map(row => `${row.meaning.toLowerCase()}|${row.word[0]}|${row.word.length}`);
assert.equal(new Set(clueKeys).size, 2000, 'Gợi ý cùng nghĩa, chữ đầu và độ dài gây mơ hồ');
assert.deepEqual(normalizeTikTokChat({ user: { id: '42', displayId: 'nguoi.xem', nickname: 'Người xem' }, content: 'a' }),
  { id: '42', username: 'nguoi.xem', name: 'Người xem', avatar: undefined, content: 'a' });
assert.equal(normalizeTikTokChat({ user: { userId: '43', uniqueId: 'khach' }, comment: 'B' }).content, 'B');
assert.equal(estimateDeliveryLag('1700000000', 1700000002300), 2300);
assert.equal(estimateDeliveryLag('1700000000000', 1700000002300), 2300);
assert.equal(estimateDeliveryLag('invalid', 1700000002300), null);
assert.equal(receiveComment({ id: 'idle', name: 'Khách', content: 'a' }), false);
assert.equal(state.answers[0].status, 'waiting');
for (let i = 0; i < 20; i++) {
  const gray = withChoices(bank.A1.find(row => row.word === 'gray'));
  assert(!gray.options.includes('grey'), 'Không đưa hai cách viết của cùng một từ vào một câu');
}
for (const [word, meaning] of Object.entries({ classroom: 'phòng học', architect: 'kiến trúc sư', paradox: 'Nghịch lý' })) {
  assert.equal(Object.values(bank).flat().find(row => row.word === word)?.meaning, meaning);
}
control({ action: 'start', level: 'MIX', think: 10, reveal: 3, breaktime: 18 });
function assertChoices(question) {
  assert.equal(question.options.length, 4);
  assert.equal(new Set(question.options).size, 4);
  assert.equal(question.options['ABCD'.indexOf(question.correctOption)], question.word);
  const words = Object.values(bank).flat();
  for (const option of question.options.filter(option => option !== question.word)) {
    assert.notEqual(words.find(row => row.word === option)?.meaning.toLowerCase(), question.meaning.toLowerCase());
  }
}
assertChoices(state.question);
const mixedLevels = [state.question.level];
for (let i = 1; i < 30; i++) { control({ action: 'next' }); assertChoices(state.question); mixedLevels.push(state.question.level); }
assert.equal(mixedLevels.filter(level => level === 'A1').length, 10);
assert.equal(mixedLevels.filter(level => level === 'A2').length, 8);
assert.equal(mixedLevels.filter(level => level === 'B1').length, 7);
assert.equal(mixedLevels.filter(level => level === 'B2').length, 3);
assert.equal(mixedLevels.filter(level => level === 'C1').length, 1);
assert.equal(mixedLevels.filter(level => level === 'C2').length, 1);
assert.equal(answerKey('  a! '), 'A');
assert.equal(answerKey('D'), 'D');
assert.equal(answerKey('person'), '');
assert.equal(answerKey('AB'), '');
assert.equal(control({ action: 'start', level: 'A1', think: 10, reveal: 3, breaktime: 8 }), null);
assertChoices(state.question);
assert.equal(state.phase, 'think');
assert.equal(state.questionNumber, 1);
assert.equal(state.breaktime, 15);
const previewBefore = state.voicePreviewRevision;
control({ action: 'preview-voice' });
assert.equal(state.voicePreviewRevision, previewBefore + 1);
const word = state.question.word;
const letter = state.question.correctOption;
const wrongLetter = 'ABCD'.replace(letter, '')[0];
assert.equal(receiveComment({ id: 'u1', name: 'Minh', content: 'wrong' }), false);
assert.equal(receiveComment({ id: 'u1', name: 'Minh', content: wrongLetter.toLowerCase() }), false);
assert.equal(snapshot().leaderboard.length, 0);
assert.equal(receiveComment({ id: 'u1', name: 'Minh', content: word }), false);
assert.equal(receiveComment({ id: 'u1', name: 'Minh', username: 'minh.tips', avatar: 'https://example.com/avatar.jpg', content: letter.toLowerCase() + '!' }), true);
assert.equal(snapshot().leaderboard[0].points, 13);
assert.equal(snapshot().leaderboard[0].username, 'minh.tips');
assert.equal(snapshot().leaderboard[0].avatar, 'https://example.com/avatar.jpg');
receiveComment({ id: 'u1', name: 'Minh', content: letter });
assert.equal(snapshot().leaderboard[0].points, 13);
receiveComment({ id: 'u2', name: 'Lan', avatar: 'javascript:alert(1)', content: letter.toLowerCase() });
assert.equal(snapshot().leaderboard.find(x => x.id === 'u2').points, 10);
assert.equal(snapshot().leaderboard.find(x => x.id === 'u2').avatar, '');
state.phaseStart -= 11000;
advance();
assert.equal(state.phase, 'answer');
receiveComment({ id: 'u3', name: 'Tùng', content: letter });
assert.equal(snapshot().leaderboard.length, 2);
assert.equal(state.answers[0].status, 'late');
control({ action: 'next' });
assert.equal(state.questionNumber, 2);
assert.equal(state.answers[0].content, letter);
control({ action: 'clear-scores' });
assert.equal(snapshot().leaderboard.length, 0);
receiveComment({ id: 'u4', name: 'Hoa', content: state.question.correctOption.toLowerCase() });
state.questionNumber = 15;
state.phase = 'answer';
state.phaseDuration = 1;
state.phaseStart = Date.now() - 1100;
advance();
assert.equal(state.phase, 'outro');
assert.equal(snapshot().leaderboard[0].name, 'Hoa');
state.phaseStart = Date.now() - 19000;
advance();
assert.equal(state.phase, 'think');
assert.equal(state.questionNumber, 1);
assert.equal(state.match, 2);
assert.equal(snapshot().leaderboard.length, 0);
for (const file of ['admin.html', 'live.html']) {
  const html = fs.readFileSync(file, 'utf8');
  if (file === 'live.html') assert(html.includes('<script src="/live.js"></script>'));
  else {
    const script = html.split('<script>')[1]?.split('</script>')[0];
    assert(script, `${file} cần có script`);
    new vm.Script(script, { filename: file });
  }
}
const liveScript = fs.readFileSync('live.js', 'utf8');
new vm.Script(liveScript, { filename: 'live.js' });
assert(!liveScript.includes('vi-VN'), 'Không được phát thuyết minh tiếng Việt');
assert(liveScript.includes('tick <= 5'), 'Tiếng đếm ngược cần bắt đầu ở 5 giây cuối');
assert(fs.statSync('assets/chill-loop.m4a').size > 100000, 'Thiếu nhạc nền chill');
assert(fs.statSync('assets/answer-chime.m4a').size > 5000, 'Thiếu âm báo đáp án');
console.log('Đã kiểm tra 2.000 từ, bốn lựa chọn A–D, chấm bình luận không phân biệt hoa/thường và top 3 cuối hiệp.');
