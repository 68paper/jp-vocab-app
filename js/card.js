/**
 * card.js
 * 카드 플립 UI 렌더링 및 이벤트 처리 모듈
 * quiz.js에 의존한다.
 *
 * ── 화면 구조 ────────────────────────────────────────────
 *
 * #study-tab
 *   .study-header
 *     .progress-text        <- "3 / 10"
 *     .progress-bar
 *       .progress-fill
 *   .card-container
 *     .card                 <- 클릭/터치 시 플립
 *       .card-front
 *         .card-japanese    <- <ruby> 태그로 후리가나 표시
 *         .card-category    <- 카테고리 이름
 *       .card-back
 *         .card-korean      <- 한글 뜻
 *   .answer-buttons         <- 카드 뒤집힌 후 활성화
 *     button.btn-wrong      <- ❌ 틀림
 *     button.btn-correct    <- ✅ 맞음
 *   .study-result           <- 학습 완료 시 표시 (평소엔 숨김)
 *     .result-score
 *     .result-wrong-list
 *     button.btn-retry
 *     button.btn-home
 */

const Card = (() => {

  // ── DOM 참조 ──────────────────────────────────────────

  let els = {};

  function initElements() {
    els = {
      studyTab:      document.getElementById('study-tab'),
      progressText:  document.getElementById('progress-text'),
      progressFill:  document.getElementById('progress-fill'),
      card:          document.getElementById('study-card'),
      cardFront:     document.getElementById('card-front'),
      cardBack:      document.getElementById('card-back'),
      cardJapanese:  document.getElementById('card-japanese'),
      cardCategory:  document.getElementById('card-category'),
      cardKorean:    document.getElementById('card-korean'),
      answerButtons: document.getElementById('answer-buttons'),
      btnCorrect:    document.getElementById('btn-correct'),
      btnWrong:      document.getElementById('btn-wrong'),
      studyResult:   document.getElementById('study-result'),
      resultScore:   document.getElementById('result-score'),
      resultWrongList: document.getElementById('result-wrong-list'),
      btnRetry:      document.getElementById('btn-retry'),
      btnHome:       document.getElementById('btn-home'),
      btnSpeak:      document.getElementById('btn-speak'),
    };
  }

  // ── 렌더링 ────────────────────────────────────────────

  /**
   * 학습 탭 진입 시 호출
   * @param {string} categoryId - 'all' | 'wrong' | 카테고리 ID
   */
  function startStudy(categoryId) {
    initElements();

    const result = Quiz.startSession(categoryId);
    if (!result.ok) {
      showError(result.error);
      return;
    }

    showStudyView();
    renderCard();
    bindEvents();
    initTTS();
  }

  /**
   * 현재 카드 렌더링
   */
  function renderCard() {
    const word = Quiz.currentWord();
    if (!word) return;

    // 후리가나 있으면 <ruby> 태그, 없으면 그냥 텍스트
    els.cardJapanese.innerHTML = word.furigana
      ? `<ruby>${escapeHTML(word.japanese)}<rt>${escapeHTML(word.furigana)}</rt></ruby>`
      : escapeHTML(word.japanese);

    els.cardKorean.textContent = word.korean;

    // 카테고리 이름 표시
    const category = Data.getCategoryById(word.categoryId);
    els.cardCategory.textContent = category ? category.name : '';

    // 카드 앞면으로 초기화
    els.card.classList.remove('flipped');
    setAnswerButtonsVisible(false);

    updateProgress();

    // 카드 진입 시 자동 발음 (300ms 딜레이: 카드 등장 후 재생)
    setTimeout(() => speakJapanese(word.japanese), 300);
  }

  /**
   * 진행률 업데이트
   */
  function updateProgress() {
    const { current, total, percent } = Quiz.getProgress();
    els.progressText.textContent = `${current} / ${total}`;
    els.progressFill.style.width = `${percent}%`;
  }

  /**
   * 학습 완료 결과 화면 렌더링
   */
  function renderResult() {
    const result = Quiz.getSessionResult();
    if (!result) return;

    // 점수
    els.resultScore.innerHTML = `
      <span class="result-correct">✅ ${result.correct}개</span>
      <span class="result-divider">/</span>
      <span class="result-total">${result.total}개</span>
    `;

    // 틀린 단어 목록
    if (result.wrongWords.length > 0) {
      els.resultWrongList.innerHTML = `
        <p class="result-wrong-title">❌ 틀린 단어</p>
        <ul class="wrong-words-list">
          ${result.wrongWords.map(w => `
            <li>
              <span class="wrong-japanese">
                ${w.furigana
                  ? `<ruby>${escapeHTML(w.japanese)}<rt>${escapeHTML(w.furigana)}</rt></ruby>`
                  : escapeHTML(w.japanese)}
              </span>
              <span class="wrong-korean">${escapeHTML(w.korean)}</span>
            </li>
          `).join('')}
        </ul>
      `;
    } else {
      els.resultWrongList.innerHTML = '<p class="result-perfect">🎉 전부 맞혔어요!</p>';
    }

    showResultView();
  }

  // ── 이벤트 바인딩 ─────────────────────────────────────

  function bindEvents() {
    // 카드 클릭/터치 → 플립
    els.card.addEventListener('click', handleCardFlip);

    // 맞음 버튼
    els.btnCorrect.addEventListener('click', handleCorrect);

    // 틀림 버튼
    els.btnWrong.addEventListener('click', handleWrong);

    // 다시 풀기
    els.btnRetry.addEventListener('click', () => {
      const session = Quiz.getSession();
      if (session) startStudy(session.categoryId);
    });

    // 홈으로
    els.btnHome.addEventListener('click', () => {
      Quiz.clearSession();
      App.navigateTo('home');
    });

    // 발음 듣기 버튼
    els.btnSpeak?.addEventListener('click', (e) => {
      e.stopPropagation(); // 카드 플립 방지
      const word = Quiz.currentWord();
      if (word) speakJapanese(word.japanese);
    });
  }

  function handleCardFlip() {
    if (Quiz.isFlipped()) return; // 이미 뒤집혀 있으면 무시

    Quiz.flipCard();
    els.card.classList.add('flipped');
    setAnswerButtonsVisible(true);
  }

  function handleCorrect() {
    const next = Quiz.answerCorrect();
    if (!next) return;
    if (next.done) {
      renderResult();
    } else {
      nextCardWithTransition();
    }
  }

  function handleWrong() {
    const next = Quiz.answerWrong();
    if (!next) return;
    if (next.done) {
      renderResult();
    } else {
      nextCardWithTransition();
    }
  }

  /**
   * 카드 전환 시 플립 트랜지션이 끝난 후 내용 교체
   * 1. 버튼 즉시 비활성화 (중복 클릭 방지)
   * 2. 카드를 다시 앞면으로 되돌리는 트랜지션 실행 (500ms)
   * 3. 트랜지션 완료 후 다음 단어 내용으로 교체
   */
  function nextCardWithTransition() {
    // 버튼 중복 클릭 방지
    setAnswerButtonsVisible(false);

    // flipped 클래스 제거 → 앞면으로 되돌아가는 트랜지션 시작
    els.card.classList.remove('flipped');

    // card.css의 transition 500ms 와 맞춤
    setTimeout(() => {
      renderCard();
    }, 500);
  }

  // ── 뷰 전환 ──────────────────────────────────────────

  function showStudyView() {
    els.studyResult.classList.add('hidden');
    els.card.classList.remove('hidden');
    els.progressText.closest('.study-header').classList.remove('hidden');
  }

  function showResultView() {
    els.card.classList.add('hidden');
    els.answerButtons.classList.add('hidden');
    els.progressText.closest('.study-header').classList.add('hidden');
    els.studyResult.classList.remove('hidden');
  }

  function showError(message) {
    els.studyResult.classList.remove('hidden');
    els.resultScore.textContent = '';
    els.resultWrongList.innerHTML = `<p class="error-message">${escapeHTML(message)}</p>`;
    els.card.classList.add('hidden');
    els.answerButtons.classList.add('hidden');
  }

  function setAnswerButtonsVisible(visible) {
    if (visible) {
      els.answerButtons.classList.remove('hidden');
    } else {
      els.answerButtons.classList.add('hidden');
    }
  }

  // ── TTS (Web Speech API) ─────────────────────────────

  /**
   * 일본어 텍스트를 음성으로 읽기
   * Web Speech API 미지원 브라우저에서는 버튼 자체를 숨김
   */
  function speakJapanese(text) {
    if (!('speechSynthesis' in window)) return;

    // 이전 발음 중단
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang  = 'ja-JP';
    utterance.rate  = 0.9;  // 약간 느리게 (학습용)
    utterance.pitch = 1.0;

    // 버튼 피드백: 재생 중 색상 변경
    if (els.btnSpeak) {
      els.btnSpeak.classList.add('speaking');
      utterance.onend = () => els.btnSpeak.classList.remove('speaking');
    }

    speechSynthesis.speak(utterance);
  }

  /**
   * TTS 지원 여부에 따라 발음 버튼 표시/숨김
   */
  function initTTS() {
    if (!els.btnSpeak) return;
    if (!('speechSynthesis' in window)) {
      els.btnSpeak.classList.add('hidden');
    }
  }

  // ── 유틸 ──────────────────────────────────────────────

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── public API ────────────────────────────────────────

  return {
    startStudy,
    renderCard,
  };

})();
