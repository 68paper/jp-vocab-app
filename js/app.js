/**
 * app.js
 * 탭 전환 및 앱 초기화 메인 모듈
 * 모든 모듈 중 가장 마지막에 로드된다.
 *
 * ── 탭 구성 ──────────────────────────────────────────────
 *
 * home     : 카테고리 선택 화면
 * study    : 오늘의 카드 학습
 * calendar : 잔디 캘린더 학습 기록
 * settings : 단어 관리 + 설정
 *
 * ── 초기화 순서 ──────────────────────────────────────────
 *
 * 1. 기본 카테고리 초기화 (최초 1회)
 * 2. 탭 네비게이션 이벤트 바인딩
 * 3. 홈 탭 렌더링
 */

const App = (() => {

  // 현재 활성 탭
  let currentTab = 'home';

  // 탭 ID 목록
  const TABS = ['home', 'study', 'calendar', 'settings'];

  // ── 초기화 ────────────────────────────────────────────

  function init() {
    Data.initDefaultCategories();
    bindTabEvents();
    navigateTo('home');
  }

  // ── 탭 전환 ───────────────────────────────────────────

  /**
   * 탭 전환
   * @param {string} tabId - 'home' | 'study' | 'calendar' | 'settings'
   * @param {*} payload    - 탭에 전달할 추가 데이터 (예: categoryId)
   */
  function navigateTo(tabId, payload = null) {
    if (!TABS.includes(tabId)) return;

    // 이전 탭 비활성화
    TABS.forEach(id => {
      document.getElementById(`${id}-tab`)
        ?.classList.toggle('hidden', id !== tabId);
      document.querySelector(`[data-tab="${id}"]`)
        ?.classList.toggle('active', id === tabId);
    });

    currentTab = tabId;

    // 탭별 렌더링
    switch (tabId) {
      case 'home':
        renderHome();
        break;
      case 'study':
        if (payload?.categoryId) {
          Card.startStudy(payload.categoryId);
        }
        break;
      case 'calendar':
        Calendar.render();
        break;
      case 'settings':
        Settings.init();
        break;
    }
  }

  function bindTabEvents() {
    TABS.forEach(id => {
      document.querySelector(`[data-tab="${id}"]`)
        ?.addEventListener('click', () => {
          // study 탭은 홈에서 카테고리 선택 후 진입하는 방식
          // 하단 탭바에서 직접 누르면 홈으로 이동
          if (id === 'study') {
            navigateTo('home');
          } else {
            navigateTo(id);
          }
        });
    });
  }

  // ── 홈 탭 렌더링 ──────────────────────────────────────

  function renderHome() {
    const container = document.getElementById('category-list-home');
    if (!container) return;

    const categories  = Data.getCategories();
    const todayCount  = Data.getTodayStudyCount();
    const settings    = Storage.getSettings();
    const studyLog    = Data.getStudyLog();
    const todayStr    = new Date().toISOString().slice(0, 10);
    const todayDone   = !!(studyLog[todayStr]);
    const stats       = Data.getStats();

    // 상단 오늘 현황
    const summaryEl = document.getElementById('home-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <span class="summary-item">📚 총 단어 <strong>${stats.totalWords}</strong>개</span>
        <span class="summary-item">❌ 오답 <strong>${stats.wrongWords}</strong>개</span>
        <span class="summary-item">오늘 <strong>${todayCount}</strong>개 학습</span>
      `;
    }

    // 특수 카테고리 (전체 혼합 / 오답노트)
    const wrongWords  = Data.getWrongWords();
    const specialHTML = `
      <div class="category-card special" data-category-id="all">
        <span class="category-icon">🔀</span>
        <span class="category-name">전체 혼합</span>
        <span class="category-count">${stats.totalWords}개</span>
        ${todayDone ? '<span class="done-badge">✅</span>' : ''}
      </div>
      <div class="category-card special ${wrongWords.length === 0 ? 'disabled' : ''}"
           data-category-id="wrong">
        <span class="category-icon">⚠️</span>
        <span class="category-name">오답노트</span>
        <span class="category-count">${wrongWords.length}개</span>
      </div>
    `;

    // 일반 카테고리
    const categoryHTML = categories.length === 0
      ? '<p class="empty-msg">카테고리가 없습니다.<br>설정에서 단어를 추가해주세요.</p>'
      : categories.map(c => {
          const words     = Data.getWordsByCategory(c.id);
          const catLog    = studyLog[todayStr];
          const catDone   = catLog?.categoryId === c.id;
          const hasWords  = words.length > 0;

          return `
            <div class="category-card ${!hasWords ? 'disabled' : ''}"
                 data-category-id="${c.id}">
              <span class="category-name">${escapeHTML(c.name)}</span>
              <span class="category-count">${words.length}개</span>
              ${catDone ? '<span class="done-badge">✅</span>' : ''}
            </div>
          `;
        }).join('');

    container.innerHTML = specialHTML + categoryHTML;

    // 카테고리 카드 클릭 → 학습 시작
    container.querySelectorAll('.category-card:not(.disabled)').forEach(card => {
      card.addEventListener('click', () => {
        const categoryId = card.dataset.categoryId;
        navigateTo('study', { categoryId });
        // 하단 탭바 study 활성화
        TABS.forEach(id => {
          document.querySelector(`[data-tab="${id}"]`)
            ?.classList.toggle('active', id === 'study');
        });
      });
    });
  }

  // ── 유틸 ──────────────────────────────────────────────

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getCurrentTab() {
    return currentTab;
  }

  // ── public API ────────────────────────────────────────

  return {
    init,
    navigateTo,
    getCurrentTab,
  };

})();

// ── 앱 시작 ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
