/**
 * data.js
 * 단어 / 카테고리 데이터 CRUD 모듈
 * storage.js에 의존한다.
 */

const Data = (() => {

  // ── 유틸 ──────────────────────────────────────────────

  function generateId() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function today() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  // ── 기본 카테고리 ─────────────────────────────────────

  const DEFAULT_CATEGORIES = ['식당', '교통', '쇼핑', '숙소', '긴급상황'];

  /**
   * 앱 최초 실행 시 기본 카테고리 초기화
   * 이미 카테고리가 있으면 건너뜀
   */
  function initDefaultCategories() {
    const existing = Storage.getCategories();
    if (existing.length > 0) return;

    const defaults = DEFAULT_CATEGORIES.map(name => ({
      id:        generateId(),
      name,
      isDefault: true,
      createdAt: today(),
    }));
    Storage.setCategories(defaults);
  }

  // ── 카테고리 ──────────────────────────────────────────

  function getCategories() {
    return Storage.getCategories();
  }

  function getCategoryById(id) {
    return getCategories().find(c => c.id === id) || null;
  }

  function addCategory(name) {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: '카테고리 이름을 입력해주세요.' };

    const existing = getCategories();
    if (existing.some(c => c.name === trimmed)) {
      return { ok: false, error: '이미 존재하는 카테고리입니다.' };
    }

    const newCategory = {
      id:        generateId(),
      name:      trimmed,
      isDefault: false,
      createdAt: today(),
    };
    Storage.setCategories([...existing, newCategory]);
    return { ok: true, category: newCategory };
  }

  function deleteCategory(id) {
    const categories = getCategories();
    const target = categories.find(c => c.id === id);
    if (!target) return { ok: false, error: '카테고리를 찾을 수 없습니다.' };

    // 카테고리 삭제 시 해당 카테고리의 단어도 함께 삭제
    const words = Storage.getWords().filter(w => w.categoryId !== id);
    Storage.setWords(words);
    Storage.setCategories(categories.filter(c => c.id !== id));
    return { ok: true };
  }

  function renameCategory(id, newName) {
    const trimmed = newName.trim();
    if (!trimmed) return { ok: false, error: '카테고리 이름을 입력해주세요.' };

    const categories = getCategories();
    const idx = categories.findIndex(c => c.id === id);
    if (idx === -1) return { ok: false, error: '카테고리를 찾을 수 없습니다.' };

    categories[idx] = { ...categories[idx], name: trimmed };
    Storage.setCategories(categories);
    return { ok: true, category: categories[idx] };
  }

  // ── 단어 ──────────────────────────────────────────────

  function getWords() {
    return Storage.getWords();
  }

  function getWordsByCategory(categoryId) {
    return getWords().filter(w => w.categoryId === categoryId);
  }

  /**
   * 오답 단어 목록 반환 (wrongCount >= 1)
   * 많이 틀린 순으로 정렬
   */
  function getWrongWords() {
    return getWords()
      .filter(w => w.wrongCount >= 1)
      .sort((a, b) => b.wrongCount - a.wrongCount);
  }

  function getWordById(id) {
    return getWords().find(w => w.id === id) || null;
  }

  /**
   * 단어 추가
   * @param {string} japanese  - 일본어
   * @param {string} furigana  - 후리가나 (선택)
   * @param {string} korean    - 한글 뜻
   * @param {string} categoryId - 카테고리 ID
   */
  function addWord({ japanese, furigana = '', korean, categoryId }) {
    if (!japanese.trim()) return { ok: false, error: '일본어를 입력해주세요.' };
    if (!korean.trim())   return { ok: false, error: '한글 뜻을 입력해주세요.' };
    if (!categoryId)      return { ok: false, error: '카테고리를 선택해주세요.' };
    if (!getCategoryById(categoryId)) {
      return { ok: false, error: '존재하지 않는 카테고리입니다.' };
    }

    const newWord = {
      id:            generateId(),
      japanese:      japanese.trim(),
      furigana:      furigana.trim(),
      korean:        korean.trim(),
      categoryId,
      wrongCount:    0,
      correctStreak: 0,
      createdAt:     today(),
    };
    Storage.setWords([...getWords(), newWord]);
    return { ok: true, word: newWord };
  }

  function updateWord(id, fields) {
    const words = getWords();
    const idx = words.findIndex(w => w.id === id);
    if (idx === -1) return { ok: false, error: '단어를 찾을 수 없습니다.' };

    // 수정 허용 필드만 업데이트
    const allowed = ['japanese', 'furigana', 'korean', 'categoryId'];
    const updated = { ...words[idx] };
    allowed.forEach(key => {
      if (fields[key] !== undefined) updated[key] = fields[key];
    });

    words[idx] = updated;
    Storage.setWords(words);
    return { ok: true, word: updated };
  }

  function deleteWord(id) {
    const words = getWords();
    if (!words.find(w => w.id === id)) {
      return { ok: false, error: '단어를 찾을 수 없습니다.' };
    }
    Storage.setWords(words.filter(w => w.id !== id));
    return { ok: true };
  }

  /**
   * 단어 정답/오답 처리
   * quiz.js에서 호출
   */
  function markCorrect(id) {
    const words = getWords();
    const idx = words.findIndex(w => w.id === id);
    if (idx === -1) return;

    const settings = Storage.getSettings();
    const word = { ...words[idx] };
    word.correctStreak += 1;

    // 오답 졸업 조건
    if (word.wrongCount > 0 && word.correctStreak >= settings.graduationStreak) {
      word.wrongCount    = 0;
      word.correctStreak = 0;
    }

    words[idx] = word;
    Storage.setWords(words);
  }

  function markWrong(id) {
    const words = getWords();
    const idx = words.findIndex(w => w.id === id);
    if (idx === -1) return;

    const word = { ...words[idx] };
    word.wrongCount    += 1;
    word.correctStreak  = 0;
    words[idx] = word;
    Storage.setWords(words);
  }

  // ── CSV 관련 데이터 처리 ───────────────────────────────
  // csv.js에서 파싱 후 이 함수로 단어 일괄 등록

  /**
   * 단어 배열 일괄 추가
   * 카테고리 이름이 없으면 자동 생성
   * @param {Array} rows - { japanese, furigana, korean, categoryName } 배열
   * @returns {{ added: number, errors: string[] }}
   */
  function bulkAddWords(rows) {
    const results = { added: 0, errors: [] };

    rows.forEach((row, i) => {
      const lineNum = i + 2; // 헤더 포함 1-index

      // 카테고리 이름으로 ID 찾거나 새로 생성
      let categoryId;
      const categoryName = (row.categoryName || '').trim();
      if (!categoryName) {
        results.errors.push(`${lineNum}행: 카테고리가 없습니다.`);
        return;
      }

      const existing = getCategories().find(c => c.name === categoryName);
      if (existing) {
        categoryId = existing.id;
      } else {
        const result = addCategory(categoryName);
        if (!result.ok) {
          results.errors.push(`${lineNum}행: 카테고리 생성 실패 - ${result.error}`);
          return;
        }
        categoryId = result.category.id;
      }

      const result = addWord({
        japanese:   row.japanese,
        furigana:   row.furigana || '',
        korean:     row.korean,
        categoryId,
      });

      if (result.ok) {
        results.added++;
      } else {
        results.errors.push(`${lineNum}행: ${result.error}`);
      }
    });

    return results;
  }

  // ── 학습 기록 ─────────────────────────────────────────

  function getStudyLog() {
    return Storage.getStudyLog();
  }

  /**
   * 오늘 학습 기록 업데이트
   * @param {number} count      - 학습한 단어 수
   * @param {string} categoryId - 학습한 카테고리 ID ('all' = 전체 혼합)
   */
  function recordStudy(count, categoryId) {
    const log = getStudyLog();
    const key = today();
    const prev = log[key] || { count: 0, categoryId };
    log[key] = {
      count:      prev.count + count,
      categoryId: prev.categoryId || categoryId,
    };
    Storage.setStudyLog(log);
  }

  function getTodayStudyCount() {
    const log = getStudyLog();
    return (log[today()] || { count: 0 }).count;
  }

  // ── 통계 ──────────────────────────────────────────────

  function getStats() {
    const words = getWords();
    const categories = getCategories();
    return {
      totalWords:    words.length,
      totalCategories: categories.length,
      wrongWords:    words.filter(w => w.wrongCount > 0).length,
      todayCount:    getTodayStudyCount(),
    };
  }

  // ── public API ────────────────────────────────────────

  return {
    // 초기화
    initDefaultCategories,

    // 카테고리
    getCategories,
    getCategoryById,
    addCategory,
    deleteCategory,
    renameCategory,

    // 단어
    getWords,
    getWordsByCategory,
    getWrongWords,
    getWordById,
    addWord,
    updateWord,
    deleteWord,
    bulkAddWords,

    // 정답/오답
    markCorrect,
    markWrong,

    // 학습 기록
    getStudyLog,
    recordStudy,
    getTodayStudyCount,

    // 통계
    getStats,
  };

})();
