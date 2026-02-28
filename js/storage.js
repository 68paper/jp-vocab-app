/**
 * storage.js
 * localStorage 읽기/쓰기 전담 모듈
 * 모든 데이터 접근은 이 모듈을 통해서만 이루어진다.
 */

const Storage = (() => {

  const KEYS = {
    WORDS:      'vocab_words',
    CATEGORIES: 'vocab_categories',
    STUDY_LOG:  'vocab_study_log',
    SETTINGS:   'vocab_settings',
  };

  /**
   * localStorage에서 JSON 파싱해서 반환
   * 키가 없거나 파싱 실패 시 fallback 반환
   */
  function get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`[Storage] get 실패 - key: ${key}`, e);
      return fallback;
    }
  }

  /**
   * localStorage에 JSON 직렬화해서 저장
   */
  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[Storage] set 실패 - key: ${key}`, e);
      return false;
    }
  }

  /**
   * 특정 키 삭제
   */
  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error(`[Storage] remove 실패 - key: ${key}`, e);
      return false;
    }
  }

  /**
   * 앱 데이터 전체 초기화 (설정 포함)
   */
  function clearAll() {
    Object.values(KEYS).forEach(key => remove(key));
  }

  // ── 단어 ──────────────────────────────────────────────

  function getWords() {
    return get(KEYS.WORDS, []);
  }

  function setWords(words) {
    return set(KEYS.WORDS, words);
  }

  // ── 카테고리 ──────────────────────────────────────────

  function getCategories() {
    return get(KEYS.CATEGORIES, []);
  }

  function setCategories(categories) {
    return set(KEYS.CATEGORIES, categories);
  }

  // ── 학습 기록 ─────────────────────────────────────────

  function getStudyLog() {
    return get(KEYS.STUDY_LOG, {});
  }

  function setStudyLog(log) {
    return set(KEYS.STUDY_LOG, log);
  }

  // ── 설정 ──────────────────────────────────────────────

  const DEFAULT_SETTINGS = {
    dailyGoal:        10,  // 하루 학습 목표 단어 수
    grassLevel1:      10,  // 잔디 연한 색 기준
    grassLevel2:      20,  // 잔디 중간 색 기준
    grassLevel3:      30,  // 잔디 진한 색 기준
    graduationStreak:  3,  // 오답 졸업 연속 정답 횟수
  };

  function getSettings() {
    const saved = get(KEYS.SETTINGS, {});
    // 저장된 설정과 기본값 병합 (새 키 추가 대비)
    return { ...DEFAULT_SETTINGS, ...saved };
  }

  function setSettings(settings) {
    return set(KEYS.SETTINGS, settings);
  }

  // ── 전체 데이터 내보내기 / 가져오기 (JSON 백업/복원) ──

  function exportAll() {
    return {
      words:      getWords(),
      categories: getCategories(),
      studyLog:   getStudyLog(),
      settings:   getSettings(),
      exportedAt: new Date().toISOString(),
    };
  }

  function importAll(data) {
    try {
      if (!data || typeof data !== 'object') throw new Error('유효하지 않은 데이터');
      if (data.words)      setWords(data.words);
      if (data.categories) setCategories(data.categories);
      if (data.studyLog)   setStudyLog(data.studyLog);
      if (data.settings)   setSettings(data.settings);
      return true;
    } catch (e) {
      console.error('[Storage] importAll 실패', e);
      return false;
    }
  }

  // ── public API ────────────────────────────────────────

  return {
    KEYS,
    DEFAULT_SETTINGS,
    get,
    set,
    remove,
    clearAll,
    getWords,
    setWords,
    getCategories,
    setCategories,
    getStudyLog,
    setStudyLog,
    getSettings,
    setSettings,
    exportAll,
    importAll,
  };

})();
