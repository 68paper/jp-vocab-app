/**
 * settings.js
 * 설정 / 단어 관리 UI 모듈
 * data.js, csv.js, storage.js에 의존한다.
 *
 * ── 화면 구조 ────────────────────────────────────────────
 *
 * #settings-tab
 *   .settings-section                  ← 단어 관리
 *     .word-input-form                 ← 단어 하나씩 입력
 *     .csv-upload-area                 ← CSV 대량 업로드
 *     .word-list                       ← 등록된 단어 목록
 *   .settings-section                  ← 카테고리 관리
 *     .category-list                   ← 카테고리 목록
 *     .category-add-form               ← 카테고리 추가
 *   .settings-section                  ← 백업 & 복원
 *     button#btn-export-json
 *     button#btn-import-json
 *     button#btn-export-csv
 *     input#input-import-json (hidden)
 *   .settings-section                  ← 학습 설정
 *     input#setting-daily-goal
 *     input#setting-graduation-streak
 *     input#setting-grass-1
 *     input#setting-grass-2
 *     input#setting-grass-3
 */

const Settings = (() => {

  let els = {};
  // 단어 목록 필터 상태
  let filterCategoryId = 'all';

  // ── 초기화 ────────────────────────────────────────────

  function init() {
    initElements();
    bindEvents();
    renderAll();
  }

  function initElements() {
    els = {
      // 단어 입력 폼
      formWord:       document.getElementById('form-word'),
      inputJapanese:  document.getElementById('input-japanese'),
      inputFurigana:  document.getElementById('input-furigana'),
      inputKorean:    document.getElementById('input-korean'),
      selectCategory: document.getElementById('select-category'),
      btnAddWord:     document.getElementById('btn-add-word'),
      wordFormMsg:    document.getElementById('word-form-msg'),

      // CSV 업로드
      inputCSV:       document.getElementById('input-csv'),
      btnUploadCSV:   document.getElementById('btn-upload-csv'),
      csvMsg:         document.getElementById('csv-msg'),

      // 단어 목록
      wordListFilter: document.getElementById('word-list-filter'),
      wordList:       document.getElementById('word-list'),

      // 카테고리 관리
      categoryList:   document.getElementById('category-list'),
      inputCatName:   document.getElementById('input-category-name'),
      btnAddCategory: document.getElementById('btn-add-category'),
      catFormMsg:     document.getElementById('cat-form-msg'),

      // 백업 & 복원
      btnExportJSON:  document.getElementById('btn-export-json'),
      btnImportJSON:  document.getElementById('btn-import-json'),
      inputImportJSON:document.getElementById('input-import-json'),
      btnExportCSV:   document.getElementById('btn-export-csv'),

      // 학습 설정
      settingDailyGoal:        document.getElementById('setting-daily-goal'),
      settingGraduationStreak: document.getElementById('setting-graduation-streak'),
      settingGrass1:           document.getElementById('setting-grass-1'),
      settingGrass2:           document.getElementById('setting-grass-2'),
      settingGrass3:           document.getElementById('setting-grass-3'),
      btnSaveSettings:         document.getElementById('btn-save-settings'),
      settingsMsg:             document.getElementById('settings-msg'),
    };
  }

  function renderAll() {
    renderCategoryOptions();
    renderWordListFilter();
    renderWordList();
    renderCategoryList();
    renderSettingsValues();
  }

  // ── 이벤트 바인딩 ─────────────────────────────────────

  function bindEvents() {
    // 단어 추가
    els.btnAddWord?.addEventListener('click', handleAddWord);

    // CSV 업로드
    els.btnUploadCSV?.addEventListener('click', () => els.inputCSV?.click());
    els.inputCSV?.addEventListener('change', handleCSVUpload);

    // 단어 목록 필터
    els.wordListFilter?.addEventListener('change', (e) => {
      filterCategoryId = e.target.value;
      renderWordList();
    });

    // 카테고리 추가
    els.btnAddCategory?.addEventListener('click', handleAddCategory);

    // 백업 & 복원
    els.btnExportJSON?.addEventListener('click', () => CSV.exportAllAsJSON());
    els.btnExportCSV?.addEventListener('click',  () => CSV.exportWordsAsCSV());
    els.btnImportJSON?.addEventListener('click', () => els.inputImportJSON?.click());
    els.inputImportJSON?.addEventListener('change', handleImportJSON);

    // 설정 저장
    els.btnSaveSettings?.addEventListener('click', handleSaveSettings);
  }

  // ── 단어 입력 폼 ──────────────────────────────────────

  function handleAddWord() {
    const japanese  = els.inputJapanese?.value.trim()  || '';
    const furigana  = els.inputFurigana?.value.trim()  || '';
    const korean    = els.inputKorean?.value.trim()    || '';
    const categoryId = els.selectCategory?.value       || '';

    const result = Data.addWord({ japanese, furigana, korean, categoryId });

    if (!result.ok) {
      showMsg(els.wordFormMsg, result.error, 'error');
      return;
    }

    showMsg(els.wordFormMsg, '단어가 추가되었습니다.', 'success');
    clearWordForm();
    renderWordList();
  }

  function clearWordForm() {
    if (els.inputJapanese)  els.inputJapanese.value  = '';
    if (els.inputFurigana)  els.inputFurigana.value  = '';
    if (els.inputKorean)    els.inputKorean.value    = '';
  }

  // ── CSV 업로드 ────────────────────────────────────────

  async function handleCSVUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    showMsg(els.csvMsg, '파일을 읽는 중...', 'info');

    const parsed = await CSV.parseCSVFile(file);
    if (!parsed.ok) {
      showMsg(els.csvMsg, parsed.error, 'error');
      els.inputCSV.value = '';
      return;
    }

    const { added, errors } = Data.bulkAddWords(parsed.rows);
    const msg = `${added}개 단어가 추가되었습니다.` +
      (errors.length > 0 ? `\n오류 ${errors.length}건:\n${errors.join('\n')}` : '');

    showMsg(els.csvMsg, msg, errors.length > 0 ? 'warning' : 'success');
    els.inputCSV.value = '';
    renderAll();
  }

  // ── 단어 목록 ─────────────────────────────────────────

  function renderWordList() {
    if (!els.wordList) return;

    const words = filterCategoryId === 'all'
      ? Data.getWords()
      : Data.getWordsByCategory(filterCategoryId);

    if (words.length === 0) {
      els.wordList.innerHTML = '<p class="empty-msg">등록된 단어가 없습니다.</p>';
      return;
    }

    const categories = Data.getCategories();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

    els.wordList.innerHTML = words.map(w => `
      <div class="word-item" data-id="${w.id}">
        <div class="word-item-main">
          <span class="word-japanese">
            ${w.furigana
              ? `<ruby>${escapeHTML(w.japanese)}<rt>${escapeHTML(w.furigana)}</rt></ruby>`
              : escapeHTML(w.japanese)}
          </span>
          <span class="word-korean">${escapeHTML(w.korean)}</span>
          <span class="word-category-badge">${escapeHTML(catMap[w.categoryId] || '')}</span>
        </div>
        <div class="word-item-meta">
          ${w.wrongCount > 0
            ? `<span class="wrong-badge">❌ ${w.wrongCount}회</span>`
            : ''}
        </div>
        <div class="word-item-actions">
          <button class="btn-edit-word" data-id="${w.id}">수정</button>
          <button class="btn-delete-word" data-id="${w.id}">삭제</button>
        </div>
      </div>
    `).join('');

    // 수정/삭제 이벤트 위임
    els.wordList.querySelectorAll('.btn-edit-word').forEach(btn => {
      btn.addEventListener('click', () => handleEditWord(btn.dataset.id));
    });
    els.wordList.querySelectorAll('.btn-delete-word').forEach(btn => {
      btn.addEventListener('click', () => handleDeleteWord(btn.dataset.id));
    });
  }

  function handleDeleteWord(id) {
    if (!confirm('이 단어를 삭제할까요?')) return;
    const result = Data.deleteWord(id);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    renderWordList();
  }

  function handleEditWord(id) {
    const word = Data.getWordById(id);
    if (!word) return;

    // 인라인 수정: 폼에 값 채우고 스크롤
    if (els.inputJapanese)  els.inputJapanese.value  = word.japanese;
    if (els.inputFurigana)  els.inputFurigana.value  = word.furigana;
    if (els.inputKorean)    els.inputKorean.value    = word.korean;
    if (els.selectCategory) els.selectCategory.value = word.categoryId;

    // 추가 버튼을 임시로 '수정 저장' 모드로 전환
    if (els.btnAddWord) {
      els.btnAddWord.textContent = '수정 저장';
      els.btnAddWord.dataset.editId = id;
      els.btnAddWord.onclick = () => handleSaveEdit(id);
    }

    els.inputJapanese?.focus();
    els.inputJapanese?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function handleSaveEdit(id) {
    const result = Data.updateWord(id, {
      japanese:   els.inputJapanese?.value.trim(),
      furigana:   els.inputFurigana?.value.trim(),
      korean:     els.inputKorean?.value.trim(),
      categoryId: els.selectCategory?.value,
    });

    if (!result.ok) {
      showMsg(els.wordFormMsg, result.error, 'error');
      return;
    }

    showMsg(els.wordFormMsg, '수정되었습니다.', 'success');
    clearWordForm();
    resetAddWordButton();
    renderWordList();
  }

  function resetAddWordButton() {
    if (els.btnAddWord) {
      els.btnAddWord.textContent = '단어 추가';
      els.btnAddWord.onclick = handleAddWord;
      delete els.btnAddWord.dataset.editId;
    }
  }

  // ── 카테고리 관리 ─────────────────────────────────────

  function renderCategoryOptions() {
    if (!els.selectCategory) return;
    const categories = Data.getCategories();
    els.selectCategory.innerHTML = `
      <option value="">카테고리 선택</option>
      ${categories.map(c =>
        `<option value="${c.id}">${escapeHTML(c.name)}</option>`
      ).join('')}
    `;
  }

  function renderWordListFilter() {
    if (!els.wordListFilter) return;
    const categories = Data.getCategories();
    els.wordListFilter.innerHTML = `
      <option value="all">전체</option>
      ${categories.map(c =>
        `<option value="${c.id}">${escapeHTML(c.name)}</option>`
      ).join('')}
    `;
    els.wordListFilter.value = filterCategoryId;
  }

  function renderCategoryList() {
    if (!els.categoryList) return;
    const categories = Data.getCategories();
    const words      = Data.getWords();

    if (categories.length === 0) {
      els.categoryList.innerHTML = '<p class="empty-msg">카테고리가 없습니다.</p>';
      return;
    }

    els.categoryList.innerHTML = categories.map(c => {
      const count = words.filter(w => w.categoryId === c.id).length;
      return `
        <div class="category-item" data-id="${c.id}">
          <span class="category-name">${escapeHTML(c.name)}</span>
          <span class="category-count">${count}개</span>
          <div class="category-actions">
            <button class="btn-rename-category" data-id="${c.id}">이름 변경</button>
            <button class="btn-delete-category" data-id="${c.id}">삭제</button>
          </div>
        </div>
      `;
    }).join('');

    els.categoryList.querySelectorAll('.btn-rename-category').forEach(btn => {
      btn.addEventListener('click', () => handleRenameCategory(btn.dataset.id));
    });
    els.categoryList.querySelectorAll('.btn-delete-category').forEach(btn => {
      btn.addEventListener('click', () => handleDeleteCategory(btn.dataset.id));
    });
  }

  function handleAddCategory() {
    const name = els.inputCatName?.value.trim() || '';
    const result = Data.addCategory(name);

    if (!result.ok) {
      showMsg(els.catFormMsg, result.error, 'error');
      return;
    }

    showMsg(els.catFormMsg, '카테고리가 추가되었습니다.', 'success');
    if (els.inputCatName) els.inputCatName.value = '';
    renderAll();
  }

  function handleRenameCategory(id) {
    const category = Data.getCategoryById(id);
    if (!category) return;

    const newName = prompt('새 카테고리 이름을 입력하세요.', category.name);
    if (!newName) return;

    const result = Data.renameCategory(id, newName);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    renderAll();
  }

  function handleDeleteCategory(id) {
    const category = Data.getCategoryById(id);
    if (!category) return;

    const words = Data.getWordsByCategory(id);
    const msg   = words.length > 0
      ? `"${category.name}" 카테고리를 삭제하면 단어 ${words.length}개도 함께 삭제됩니다. 계속할까요?`
      : `"${category.name}" 카테고리를 삭제할까요?`;

    if (!confirm(msg)) return;

    const result = Data.deleteCategory(id);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    filterCategoryId = 'all';
    renderAll();
  }

  // ── JSON 가져오기 ─────────────────────────────────────

  async function handleImportJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('현재 데이터를 백업 파일로 덮어씁니다. 계속할까요?')) {
      els.inputImportJSON.value = '';
      return;
    }

    const result = await CSV.importFromJSON(file);
    if (!result.ok) {
      alert(`가져오기 실패: ${result.error}`);
    } else {
      alert('데이터를 성공적으로 복원했습니다.');
      renderAll();
    }
    els.inputImportJSON.value = '';
  }

  // ── 학습 설정 ─────────────────────────────────────────

  function renderSettingsValues() {
    const s = Storage.getSettings();
    if (els.settingDailyGoal)        els.settingDailyGoal.value        = s.dailyGoal;
    if (els.settingGraduationStreak) els.settingGraduationStreak.value = s.graduationStreak;
    if (els.settingGrass1)           els.settingGrass1.value           = s.grassLevel1;
    if (els.settingGrass2)           els.settingGrass2.value           = s.grassLevel2;
    if (els.settingGrass3)           els.settingGrass3.value           = s.grassLevel3;
  }

  function handleSaveSettings() {
    const dailyGoal        = parseInt(els.settingDailyGoal?.value, 10);
    const graduationStreak = parseInt(els.settingGraduationStreak?.value, 10);
    const grassLevel1      = parseInt(els.settingGrass1?.value, 10);
    const grassLevel2      = parseInt(els.settingGrass2?.value, 10);
    const grassLevel3      = parseInt(els.settingGrass3?.value, 10);

    // 유효성 검사
    if (isNaN(dailyGoal)        || dailyGoal < 1)         return showMsg(els.settingsMsg, '하루 학습 수는 1 이상이어야 합니다.', 'error');
    if (isNaN(graduationStreak) || graduationStreak < 1)  return showMsg(els.settingsMsg, '졸업 기준은 1 이상이어야 합니다.', 'error');
    if (grassLevel1 >= grassLevel2)                       return showMsg(els.settingsMsg, '기본 < 놀람 < 최고 순서여야 합니다.', 'error');
    if (grassLevel2 >= grassLevel3)                       return showMsg(els.settingsMsg, '기본 < 놀람 < 최고 순서여야 합니다.', 'error');

    Storage.setSettings({ dailyGoal, graduationStreak, grassLevel1, grassLevel2, grassLevel3 });
    showMsg(els.settingsMsg, '설정이 저장되었습니다.', 'success');
  }

  // ── 공통 유틸 ─────────────────────────────────────────

  function showMsg(el, message, type = 'info') {
    if (!el) return;
    el.textContent = message;
    el.className   = `form-msg form-msg--${type}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
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
    init,
    renderAll,
  };

})();
