/**
 * quiz.js
 * 학습 로직 모듈
 * - 하루 단어 선택 알고리즘
 * - 오답 알고리즘
 * - 학습 세션 상태 관리
 * data.js에 의존한다.
 *
 * ── 하루 단어 선택 규칙 ───────────────────────────────────
 *
 * 1. 오답 단어 중 wrongCount 높은 순으로 최대 (dailyGoal - 2)개 선택
 * 2. 나머지를 새 단어(wrongCount === 0)로 채워 총 dailyGoal개 구성
 * 3. 새 단어는 최소 2개 보장
 * 4. "전체 혼합(all)" 선택 시 모든 카테고리에서 위 로직 적용
 * 5. "오답노트(wrong)" 선택 시 오답 단어만으로 구성
 *
 * ── 오답 처리 규칙 ───────────────────────────────────────
 *
 * - 틀리면: wrongCount += 1, correctStreak = 0
 * - 맞으면: correctStreak += 1
 * - correctStreak >= graduationStreak 이면 오답 졸업
 *   (wrongCount = 0, correctStreak = 0)
 */

const Quiz = (() => {

  // ── 세션 상태 ─────────────────────────────────────────
  // 현재 진행 중인 학습 세션 데이터

  let session = null;

  /**
   * 세션 초기화
   * @param {string} categoryId - 카테고리 ID | 'all' | 'wrong'
   */
  function startSession(categoryId) {
    const words = buildDailyWords(categoryId);
    if (words.length === 0) {
      return { ok: false, error: '학습할 단어가 없습니다. 단어를 먼저 등록해주세요.' };
    }

    session = {
      categoryId,
      words,           // 오늘 학습할 단어 배열
      currentIndex: 0, // 현재 카드 인덱스
      results: [],     // { wordId, correct } 배열
      isFlipped: false,
      startedAt: new Date().toISOString(),
    };

    return { ok: true, session };
  }

  function getSession() {
    return session;
  }

  function clearSession() {
    session = null;
  }

  // ── 하루 단어 선택 ────────────────────────────────────

  /**
   * 카테고리에 맞는 오늘의 단어 배열 생성
   */
  function buildDailyWords(categoryId) {
    const settings = Storage.getSettings();
    const dailyGoal = settings.dailyGoal;
    const maxWrong  = dailyGoal - 2; // 오답 최대 (새 단어 최소 2개 보장)

    let allWords;

    if (categoryId === 'wrong') {
      // 오답노트: 오답 단어만
      return shuffle(Data.getWrongWords()).slice(0, dailyGoal);
    } else if (categoryId === 'all') {
      allWords = Data.getWords();
    } else {
      allWords = Data.getWordsByCategory(categoryId);
    }

    // 오답 단어 (wrongCount >= 1), 많이 틀린 순
    const wrongWords = allWords
      .filter(w => w.wrongCount >= 1)
      .sort((a, b) => b.wrongCount - a.wrongCount)
      .slice(0, maxWrong);

    // 새 단어 (wrongCount === 0), 등록일 오래된 순 (먼저 등록한 것 먼저)
    const wrongIds  = new Set(wrongWords.map(w => w.id));
    const newWords  = allWords
      .filter(w => w.wrongCount === 0 && !wrongIds.has(w.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const newCount  = dailyGoal - wrongWords.length;
    const selected  = [
      ...wrongWords,
      ...newWords.slice(0, newCount),
    ];

    return shuffle(selected);
  }

  /**
   * 배열 셔플 (Fisher-Yates)
   */
  function shuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // ── 세션 진행 ─────────────────────────────────────────

  /**
   * 현재 카드 단어 반환
   */
  function currentWord() {
    if (!session) return null;
    return session.words[session.currentIndex] || null;
  }

  /**
   * 카드 뒤집기 상태 토글
   */
  function flipCard() {
    if (!session) return;
    session.isFlipped = !session.isFlipped;
    return session.isFlipped;
  }

  /**
   * 정답 처리 후 다음 카드로
   */
  function answerCorrect() {
    if (!session) return null;
    const word = currentWord();
    if (!word) return null;

    Data.markCorrect(word.id);
    session.results.push({ wordId: word.id, correct: true });
    return _next();
  }

  /**
   * 오답 처리 후 다음 카드로
   */
  function answerWrong() {
    if (!session) return null;
    const word = currentWord();
    if (!word) return null;

    Data.markWrong(word.id);
    session.results.push({ wordId: word.id, correct: false });
    return _next();
  }

  /**
   * 다음 카드로 이동
   * @returns {{ done: boolean, index: number, total: number }}
   */
  function _next() {
    session.isFlipped = false;
    session.currentIndex++;

    const done = session.currentIndex >= session.words.length;
    if (done) _finishSession();

    return {
      done,
      index: session.currentIndex,
      total: session.words.length,
    };
  }

  /**
   * 세션 완료 처리 - 학습 기록 저장
   */
  function _finishSession() {
    const count = session.results.length;
    Data.recordStudy(count, session.categoryId);
  }

  // ── 세션 결과 ─────────────────────────────────────────

  /**
   * 현재 세션 결과 요약 반환
   */
  function getSessionResult() {
    if (!session) return null;

    const total   = session.results.length;
    const correct = session.results.filter(r => r.correct).length;
    const wrong   = total - correct;

    // 틀린 단어 상세
    const wrongWords = session.results
      .filter(r => !r.correct)
      .map(r => Data.getWordById(r.wordId))
      .filter(Boolean);

    return {
      total,
      correct,
      wrong,
      wrongWords,
      categoryId: session.categoryId,
    };
  }

  /**
   * 진행률 반환
   * @returns {{ current: number, total: number, percent: number }}
   */
  function getProgress() {
    if (!session) return { current: 0, total: 0, percent: 0 };
    const total   = session.words.length;
    const current = session.currentIndex;
    return {
      current,
      total,
      percent: total > 0 ? Math.round((current / total) * 100) : 0,
    };
  }

  /**
   * 카드가 뒤집혀 있는지 여부
   */
  function isFlipped() {
    return session ? session.isFlipped : false;
  }

  // ── public API ────────────────────────────────────────

  return {
    // 세션
    startSession,
    getSession,
    clearSession,

    // 카드 제어
    currentWord,
    flipCard,
    answerCorrect,
    answerWrong,

    // 상태 조회
    getProgress,
    getSessionResult,
    isFlipped,
  };

})();
