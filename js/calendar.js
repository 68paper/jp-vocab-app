/**
 * calendar.js
 * 잔디 캘린더 UI 렌더링 모듈
 * data.js, storage.js에 의존한다.
 *
 * ── 화면 구조 ────────────────────────────────────────────
 *
 * #calendar-tab
 *   .calendar-header
 *     .calendar-title       <- "학습 기록"
 *     .calendar-stats       <- 총 학습일, 총 단어 수
 *   .calendar-months        <- 월 레이블 (Jan, Feb ...)
 *   .calendar-grid          <- 잔디 셀 52주 × 7일
 *     .calendar-cell        <- 날짜별 셀
 *       data-date           <- "2024-03-01"
 *       data-count          <- 학습 단어 수
 *   .calendar-legend        <- 색상 범례
 *   .calendar-tooltip       <- 셀 터치 시 툴팁
 *
 * ── 잔디 색상 기준 (설정에서 조정 가능) ──────────────────
 *
 * 0개       : --grass-0 (빈 칸, 회색 테두리)
 * 1-19개    : --grass-1 (연한 초록)
 * 20-29개   : --grass-2 (중간 초록)
 * 30개 이상 : --grass-3 (진한 초록)
 */

const Calendar = (() => {

  // ── DOM 참조 ──────────────────────────────────────────

  let els = {};

  function initElements() {
    els = {
      grid:    document.getElementById('calendar-grid'),
      months:  document.getElementById('calendar-months'),
      legend:  document.getElementById('calendar-legend'),
      tooltip: document.getElementById('calendar-tooltip'),
      statDays:  document.getElementById('stat-days'),
      statWords: document.getElementById('stat-words'),
    };
  }

  // ── 렌더링 진입점 ─────────────────────────────────────

  function render() {
    initElements();
    const log      = Data.getStudyLog();
    const settings = Storage.getSettings();

    renderStats(log);
    renderGrid(log, settings);
    renderLegend(settings);
    bindTooltip();
  }

  // ── 통계 ──────────────────────────────────────────────

  function renderStats(log) {
    const days       = Object.keys(log).length;
    const totalWords = Object.values(log).reduce((sum, v) => sum + (v.count || 0), 0);

    if (els.statDays)  els.statDays.textContent  = `${days}일`;
    if (els.statWords) els.statWords.textContent = `${totalWords}개`;
  }

  // ── 잔디 그리드 ───────────────────────────────────────

  /**
   * 오늘 기준 52주(364일) + 오늘 포함한 그리드 생성
   * 깃허브처럼 일요일 시작, 왼쪽이 과거 오른쪽이 현재
   */
  function renderGrid(log, settings) {
    if (!els.grid) return;
    els.grid.innerHTML = '';

    const today     = new Date();
    const startDate = getGridStartDate(today);
    const cells     = [];
    const monthLabels = [];

    let prevMonth = -1;
    let colIndex  = 0;

    const cursor = new Date(startDate);
    while (cursor <= today) {
      const dateStr = toDateString(cursor);
      const count   = (log[dateStr] || {}).count || 0;
      const level   = getGrassLevel(count, settings);
      const month   = cursor.getMonth();

      // 월 레이블 추적 (새 월이 시작되는 열)
      if (month !== prevMonth && cursor.getDay() === 0) {
        monthLabels.push({ col: colIndex, label: getMonthLabel(month) });
        prevMonth = month;
      }

      const cell = document.createElement('div');
      cell.className   = `calendar-cell grass-${level}`;
      cell.dataset.date  = dateStr;
      cell.dataset.count = count;
      cell.dataset.category = (log[dateStr] || {}).categoryId || '';

      cells.push(cell);
      els.grid.appendChild(cell);

      // 일요일(0)마다 열 증가
      if (cursor.getDay() === 6) colIndex++;
      cursor.setDate(cursor.getDate() + 1);
    }

    renderMonthLabels(monthLabels);
  }

  /**
   * 그리드 시작일 계산
   * 오늘로부터 52주 전 일요일
   */
  function getGridStartDate(today) {
    const start = new Date(today);
    start.setDate(start.getDate() - 52 * 7);
    // 가장 가까운 일요일로 맞춤
    start.setDate(start.getDate() - start.getDay());
    return start;
  }

  /**
   * 학습량에 따른 잔디 레벨 반환 (0-3)
   */
  function getGrassLevel(count, settings) {
    if (count <= 0)                          return 0;
    if (count < settings.grassLevel2)        return 1;
    if (count < settings.grassLevel3)        return 2;
    return 3;
  }

  // ── 월 레이블 ─────────────────────────────────────────

  function renderMonthLabels(monthLabels) {
    if (!els.months) return;
    els.months.innerHTML = '';

    monthLabels.forEach(({ col, label }) => {
      const span = document.createElement('span');
      span.className   = 'month-label';
      span.textContent = label;
      span.style.gridColumn = col + 1;
      els.months.appendChild(span);
    });
  }

  function getMonthLabel(monthIndex) {
    const labels = ['1월', '2월', '3월', '4월', '5월', '6월',
                    '7월', '8월', '9월', '10월', '11월', '12월'];
    return labels[monthIndex];
  }

  // ── 범례 ──────────────────────────────────────────────

  function renderLegend(settings) {
    if (!els.legend) return;
    els.legend.innerHTML = `
      <span class="legend-label">적음</span>
      <div class="legend-cell grass-0"></div>
      <div class="legend-cell grass-1"></div>
      <div class="legend-cell grass-2"></div>
      <div class="legend-cell grass-3"></div>
      <span class="legend-label">많음</span>
      <span class="legend-detail">
        (${settings.grassLevel1}개 / ${settings.grassLevel2}개 / ${settings.grassLevel3}개 이상)
      </span>
    `;
  }

  // ── 툴팁 ──────────────────────────────────────────────

  function bindTooltip() {
    if (!els.grid || !els.tooltip) return;

    els.grid.addEventListener('click', (e) => {
      const cell = e.target.closest('.calendar-cell');
      if (!cell) {
        hideTooltip();
        return;
      }
      showTooltip(cell, e);
    });

    // 그리드 바깥 클릭 시 툴팁 닫기
    document.addEventListener('click', (e) => {
      if (!els.grid.contains(e.target)) hideTooltip();
    });
  }

  function showTooltip(cell, e) {
    const date     = cell.dataset.date;
    const count    = parseInt(cell.dataset.count, 10) || 0;
    const catId    = cell.dataset.category;
    const category = catId && catId !== 'all' && catId !== 'wrong'
      ? Data.getCategoryById(catId)
      : null;

    const dateLabel     = formatDateLabel(date);
    const countLabel    = count > 0 ? `${count}개 학습` : '학습 없음';
    const categoryLabel = count > 0
      ? (catId === 'all'   ? '전체 혼합' :
         catId === 'wrong' ? '오답노트'  :
         category          ? category.name : '')
      : '';

    els.tooltip.innerHTML = `
      <span class="tooltip-date">${dateLabel}</span>
      <span class="tooltip-count">${countLabel}</span>
      ${categoryLabel ? `<span class="tooltip-category">${escapeHTML(categoryLabel)}</span>` : ''}
    `;

    // 툴팁 위치 (셀 기준)
    const rect = cell.getBoundingClientRect();
    const tabRect = document.getElementById('calendar-tab').getBoundingClientRect();
    els.tooltip.style.left = `${rect.left - tabRect.left + rect.width / 2}px`;
    els.tooltip.style.top  = `${rect.top  - tabRect.top  - 10}px`;
    els.tooltip.classList.remove('hidden');
  }

  function hideTooltip() {
    if (els.tooltip) els.tooltip.classList.add('hidden');
  }

  // ── 유틸 ──────────────────────────────────────────────

  function toDateString(date) {
    return date.toISOString().slice(0, 10);
  }

  function formatDateLabel(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${year}년 ${parseInt(month, 10)}월 ${parseInt(day, 10)}일`;
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── public API ────────────────────────────────────────

  return {
    render,
  };

})();
