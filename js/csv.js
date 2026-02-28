/**
 * csv.js
 * CSV 파싱(업로드) 및 CSV/JSON 내보내기 모듈
 * data.js, storage.js에 의존한다.
 *
 * ── CSV 형식 예시 ────────────────────────────────────────
 *
 * 일본어,후리가나,한글뜻,카테고리
 * 食べる,たべる,먹다,식당
 * 飲む,のむ,마시다,식당
 * メニュー,,메뉴,식당
 * 電車,でんしゃ,전철,교통
 * 駅,えき,역,교통
 * タクシー,,택시,교통
 * ホテル,,호텔,숙소
 * 部屋,へや,방,숙소
 * チェックイン,,체크인,숙소
 * いくらですか,,얼마예요?,쇼핑
 * 安い,やすい,싸다,쇼핑
 * 高い,たかい,비싸다,쇼핑
 * 助けてください,たすけてください,도와주세요,긴급상황
 * 病院,びょういん,병원,긴급상황
 *
 * ── 작성 규칙 ────────────────────────────────────────────
 *
 * 1. 첫 번째 행은 반드시 헤더: 일본어,후리가나,한글뜻,카테고리
 * 2. 후리가나가 없는 경우 빈 칸으로 두면 됨 (예: メニュー,,메뉴,식당)
 * 3. 카테고리가 존재하지 않으면 자동으로 새 카테고리 생성
 * 4. 쉼표가 포함된 값은 쌍따옴표로 감쌀 것 (예: "네, 알겠습니다")
 * 5. 파일 인코딩은 UTF-8 권장 (엑셀 저장 시 'CSV UTF-8'로 저장)
 *
 * ── JSON 백업 형식 예시 ──────────────────────────────────
 *
 * {
 *   "words": [
 *     {
 *       "id": "abc-123",
 *       "japanese": "食べる",
 *       "furigana": "たべる",
 *       "korean": "먹다",
 *       "categoryId": "cat-001",
 *       "wrongCount": 2,
 *       "correctStreak": 0,
 *       "createdAt": "2024-03-01"
 *     }
 *   ],
 *   "categories": [
 *     {
 *       "id": "cat-001",
 *       "name": "식당",
 *       "isDefault": true,
 *       "createdAt": "2024-03-01"
 *     }
 *   ],
 *   "studyLog": {
 *     "2024-03-01": { "count": 10, "categoryId": "cat-001" },
 *     "2024-03-02": { "count": 25, "categoryId": "all" }
 *   },
 *   "settings": {
 *     "dailyGoal": 10,
 *     "grassLevel1": 10,
 *     "grassLevel2": 20,
 *     "grassLevel3": 30,
 *     "graduationStreak": 3
 *   },
 *   "exportedAt": "2024-03-02T12:00:00.000Z"
 * }
 */

const CSV = (() => {

  // ── CSV 파싱 ──────────────────────────────────────────

  /**
   * CSV 문자열을 행 배열로 파싱
   * 쌍따옴표로 감싼 필드, 쉼표 포함 필드 처리
   */
  function parseCSVString(text) {
    const lines = text.trim().split(/\r?\n/);
    return lines.map(line => {
      const fields = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          fields.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      fields.push(current.trim());
      return fields;
    });
  }

  /**
   * CSV 파일을 읽어서 단어 배열로 변환
   * 헤더: 일본어,후리가나,한글뜻,카테고리
   * @param {File} file
   * @returns {Promise<{ ok: boolean, rows?: Array, error?: string }>}
   */
  function parseCSVFile(file) {
    return new Promise((resolve) => {
      if (!file || !file.name.endsWith('.csv')) {
        return resolve({ ok: false, error: 'CSV 파일만 업로드 가능합니다.' });
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const allRows = parseCSVString(text);

          if (allRows.length < 2) {
            return resolve({ ok: false, error: '데이터가 없습니다. 헤더 포함 2행 이상 필요합니다.' });
          }

          // 헤더 검증
          const header = allRows[0].map(h => h.replace(/^["']|["']$/g, '').trim());
          const requiredHeaders = ['일본어', '한글뜻', '카테고리'];
          const missingHeaders = requiredHeaders.filter(h => !header.includes(h));
          if (missingHeaders.length > 0) {
            return resolve({
              ok: false,
              error: `헤더가 올바르지 않습니다. 필수 항목: ${missingHeaders.join(', ')}`,
            });
          }

          // 컬럼 인덱스
          const idx = {
            japanese:     header.indexOf('일본어'),
            furigana:     header.indexOf('후리가나'),
            korean:       header.indexOf('한글뜻'),
            categoryName: header.indexOf('카테고리'),
          };

          const rows = [];
          const errors = [];

          allRows.slice(1).forEach((cols, i) => {
            const lineNum = i + 2;
            // 빈 행 스킵
            if (cols.every(c => !c)) return;

            const japanese = (cols[idx.japanese] || '').trim();
            const korean   = (cols[idx.korean]   || '').trim();
            const categoryName = (cols[idx.categoryName] || '').trim();

            if (!japanese) {
              errors.push(`${lineNum}행: 일본어가 비어있습니다.`);
              return;
            }
            if (!korean) {
              errors.push(`${lineNum}행: 한글뜻이 비어있습니다.`);
              return;
            }
            if (!categoryName) {
              errors.push(`${lineNum}행: 카테고리가 비어있습니다.`);
              return;
            }

            rows.push({
              japanese,
              furigana:     idx.furigana !== -1 ? (cols[idx.furigana] || '').trim() : '',
              korean,
              categoryName,
            });
          });

          resolve({ ok: true, rows, errors });
        } catch (err) {
          resolve({ ok: false, error: `파싱 오류: ${err.message}` });
        }
      };

      reader.onerror = () => resolve({ ok: false, error: '파일을 읽을 수 없습니다.' });
      reader.readAsText(file, 'UTF-8');
    });
  }

  // ── CSV 내보내기 ──────────────────────────────────────

  /**
   * 값을 CSV 필드로 안전하게 이스케이프
   */
  function escapeField(value) {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * 단어 배열을 CSV 문자열로 변환
   */
  function wordsToCSV(words) {
    const categories = Data.getCategories();
    const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

    const header = ['일본어', '후리가나', '한글뜻', '카테고리'];
    const rows = words.map(w => [
      w.japanese,
      w.furigana || '',
      w.korean,
      categoryMap[w.categoryId] || '',
    ]);

    return [header, ...rows]
      .map(row => row.map(escapeField).join(','))
      .join('\r\n');
  }

  /**
   * 단어 전체를 CSV 파일로 다운로드
   */
  function exportWordsAsCSV() {
    const words = Data.getWords();
    if (words.length === 0) {
      alert('내보낼 단어가 없습니다.');
      return;
    }
    const csvString = wordsToCSV(words);
    downloadFile(csvString, `vocab_${getDateString()}.csv`, 'text/csv;charset=utf-8;');
  }

  // ── JSON 내보내기 / 가져오기 ──────────────────────────

  /**
   * 전체 앱 데이터를 JSON 파일로 다운로드 (백업)
   */
  function exportAllAsJSON() {
    const data = Storage.exportAll();
    const jsonString = JSON.stringify(data, null, 2);
    downloadFile(jsonString, `vocab_backup_${getDateString()}.json`, 'application/json');
  }

  /**
   * JSON 파일을 읽어서 앱 데이터 복원
   * @param {File} file
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  function importFromJSON(file) {
    return new Promise((resolve) => {
      if (!file || !file.name.endsWith('.json')) {
        return resolve({ ok: false, error: 'JSON 파일만 가져올 수 있습니다.' });
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          const success = Storage.importAll(data);
          if (success) {
            resolve({ ok: true });
          } else {
            resolve({ ok: false, error: '데이터 복원에 실패했습니다.' });
          }
        } catch (err) {
          resolve({ ok: false, error: `JSON 파싱 오류: ${err.message}` });
        }
      };

      reader.onerror = () => resolve({ ok: false, error: '파일을 읽을 수 없습니다.' });
      reader.readAsText(file, 'UTF-8');
    });
  }

  // ── 공통 유틸 ─────────────────────────────────────────

  function getDateString() {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }

  /**
   * 브라우저에서 파일 다운로드 트리거
   */
  function downloadFile(content, filename, mimeType) {
    const BOM = mimeType.includes('csv') ? '\uFEFF' : ''; // CSV UTF-8 BOM (엑셀 호환)
    const blob = new Blob([BOM + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── public API ────────────────────────────────────────

  return {
    parseCSVFile,
    exportWordsAsCSV,
    exportAllAsJSON,
    importFromJSON,
  };

})();
