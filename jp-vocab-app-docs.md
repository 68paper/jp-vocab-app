# 일본어 단어 학습 웹앱 기술 문서

---

## 1. 앱 개요 (README)

### 소개
여행 준비를 위한 개인용 일본어 단어 학습 웹앱.
모바일 환경에서 주로 사용하며, 카드 플립 방식으로 단어를 학습한다.
PWA(Progressive Web App)로 제작되어 홈 화면에 추가하면 앱처럼 사용 가능하다.

### 주요 기능
- 카테고리별 단어 관리
- 카드 플립 방식의 단어 학습 (일본어 → 한글 뜻)
- 한자 위에 후리가나(히라가나) 표시
- 오답 노트 자동 관리 및 반복 학습
- 깃허브 스타일 잔디 캘린더로 학습 기록 시각화
- 단어 하나씩 입력 및 CSV 대량 업로드 지원
- JSON 백업 및 복원
- PWA 지원 (오프라인 동작, 홈 화면 추가)

### 배포
- GitHub Pages: `https://사용자명.github.io/jp-vocab-app`

---

## 2. 기술 스펙 문서

### 기술 스택
| 항목 | 내용 |
|------|------|
| 언어 | HTML / CSS / Vanilla JS |
| 아키텍처 | SPA (Single Page Application) |
| 데이터 저장 | localStorage |
| 배포 | GitHub Pages |
| PWA | manifest.json + Service Worker |

### 파일 구조
```
jp-vocab-app/
│
├── index.html              # 앱 진입점, 탭 구조 뼈대
├── manifest.json           # PWA 설정
├── service-worker.js       # 오프라인 캐싱
├── icon.png                # 앱 아이콘
│
├── css/
│   ├── main.css            # 공통 스타일, 탭 네비게이션
│   ├── card.css            # 카드 플립 애니메이션
│   └── calendar.css        # 잔디 캘린더
│
└── js/
    ├── storage.js          # localStorage 읽기/쓰기 전담
    ├── data.js             # 단어/카테고리 데이터 CRUD
    ├── quiz.js             # 학습 로직 (오답 알고리즘, 단어 선택)
    ├── card.js             # 카드 플립 UI 렌더링
    ├── calendar.js         # 잔디 캘린더 UI 렌더링
    ├── settings.js         # 설정/단어 관리 UI
    ├── csv.js              # CSV 파싱 및 내보내기
    └── app.js              # 탭 전환, 앱 초기화 메인
```

### 각 파일 역할

| 파일 | 역할 |
|------|------|
| `index.html` | 앱 뼈대. 탭 네비게이션과 각 탭 콘텐츠 div 포함 |
| `manifest.json` | PWA 이름, 아이콘, 테마 색상 설정 |
| `service-worker.js` | 정적 파일 캐싱, 오프라인 동작 지원 |
| `css/main.css` | 전체 레이아웃, 탭 네비게이션, 공통 컴포넌트 |
| `css/card.css` | 카드 플립 3D 애니메이션 |
| `css/calendar.css` | 잔디 캘린더 그리드 및 색상 |
| `js/storage.js` | localStorage key 관리, get/set/clear 함수 |
| `js/data.js` | 단어 추가/수정/삭제, 카테고리 CRUD, storage.js 호출 |
| `js/quiz.js` | 하루 단어 선택 로직, 오답 알고리즘, 학습 결과 저장 |
| `js/card.js` | 카드 UI 렌더링, 플립 이벤트, 맞음/틀림 버튼 처리 |
| `js/calendar.js` | 잔디 캘린더 렌더링, 날짜별 학습량 색상 계산 |
| `js/settings.js` | 설정 UI, 단어 입력 폼, 카테고리 관리 UI |
| `js/csv.js` | CSV 파싱(업로드), CSV/JSON 내보내기 |
| `js/app.js` | 탭 전환 제어, 앱 초기화, 모듈 연결 |

### 스크립트 로드 순서
```html
<script src="js/storage.js"></script>   <!-- 1. 가장 먼저 -->
<script src="js/data.js"></script>      <!-- 2. storage 의존 -->
<script src="js/csv.js"></script>       <!-- 3. data 의존 -->
<script src="js/quiz.js"></script>      <!-- 3. data 의존 -->
<script src="js/settings.js"></script>  <!-- 4. data + csv 의존 -->
<script src="js/card.js"></script>      <!-- 4. quiz 의존 -->
<script src="js/calendar.js"></script>  <!-- 4. data 의존 -->
<script src="js/app.js"></script>       <!-- 5. 가장 마지막 -->
```

---

## 3. 데이터 구조 문서

### localStorage 키 목록
| 키 | 설명 |
|-----|------|
| `vocab_words` | 전체 단어 배열 |
| `vocab_categories` | 카테고리 배열 |
| `vocab_study_log` | 날짜별 학습 기록 |
| `vocab_settings` | 앱 설정값 |

### 단어 (Word)
```json
{
  "id": "uuid-string",
  "japanese": "食べる",
  "furigana": "たべる",
  "korean": "먹다",
  "categoryId": "category-uuid",
  "wrongCount": 0,
  "correctStreak": 0,
  "createdAt": "2024-01-01"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 고유 ID (UUID) |
| `japanese` | string | 일본어 단어 |
| `furigana` | string | 후리가나 (히라가나) |
| `korean` | string | 한글 뜻 |
| `categoryId` | string | 소속 카테고리 ID |
| `wrongCount` | number | 누적 오답 횟수 |
| `correctStreak` | number | 연속 정답 횟수 (오답 졸업 판단용) |
| `createdAt` | string | 등록일 (YYYY-MM-DD) |

### 카테고리 (Category)
```json
{
  "id": "uuid-string",
  "name": "식당",
  "isDefault": true,
  "createdAt": "2024-01-01"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 고유 ID (UUID) |
| `name` | string | 카테고리 이름 |
| `isDefault` | boolean | 기본 제공 카테고리 여부 |
| `createdAt` | string | 생성일 (YYYY-MM-DD) |

### 기본 제공 카테고리
- 식당, 교통, 쇼핑, 숙소, 긴급상황

### 학습 기록 (Study Log)
```json
{
  "2024-01-01": {
    "count": 10,
    "categoryId": "category-uuid"
  },
  "2024-01-02": {
    "count": 25,
    "categoryId": "all"
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| 날짜 (key) | string | YYYY-MM-DD 형식 |
| `count` | number | 해당 날 학습한 단어 수 |
| `categoryId` | string | 학습한 카테고리 ID (`"all"` 이면 전체 혼합) |

### 설정 (Settings)
```json
{
  "dailyGoal": 10,
  "grassLevel1": 10,
  "grassLevel2": 20,
  "grassLevel3": 30,
  "graduationStreak": 3
}
```

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `dailyGoal` | number | 10 | 하루 학습 목표 단어 수 |
| `grassLevel1` | number | 10 | 잔디 연한 색 기준 |
| `grassLevel2` | number | 20 | 잔디 중간 색 기준 |
| `grassLevel3` | number | 30 | 잔디 진한 색 기준 |
| `graduationStreak` | number | 3 | 오답 졸업 연속 정답 횟수 |

### CSV 형식
```csv
일본어,후리가나,한글뜻,카테고리
食べる,たべる,먹다,식당
電車,でんしゃ,전철,교통
ありがとう,,고마워,기타
```
- 후리가나가 없는 경우 빈 칸으로 두면 됨
- 카테고리가 존재하지 않으면 자동 생성
- 헤더 행은 필수

---

## 4. 기능 명세 문서

### 탭 구성
| 탭 | 아이콘 | 설명 |
|----|--------|------|
| 홈 | 🏠 | 카테고리 선택 화면 |
| 학습 | 📖 | 오늘의 카드 학습 |
| 기록 | 📅 | 잔디 캘린더 |
| 설정 | ⚙️ | 단어 관리 + 설정 |

### 탭 1. 홈 (카테고리 선택)
- 상단 고정: "전체 혼합 🔀", "오답노트 ⚠️"
- 그 아래: 사용자 카테고리 목록
- 각 카테고리 카드에 표시: 카테고리 이름, 단어 수, 오늘 학습 완료 여부 (✅)
- 카테고리 선택 시 학습 탭으로 이동하며 해당 카테고리로 학습 시작

### 탭 2. 학습 (카드 플립)
- 상단: 진행률 표시 (예: 3 / 10)
- 중앙: 카드
  - 앞면: 일본어 + 후리가나 (`<ruby>` 태그 사용)
  - 뒷면: 한글 뜻
  - 터치/클릭으로 플립
- 하단: 맞음 ✅ / 틀림 ❌ 버튼 (뒤집힌 후 활성화)
- 학습 완료 시 결과 화면 (맞은 수 / 틀린 수) 표시

### 탭 3. 기록 (잔디 캘린더)
- 깃허브 스타일 연간 캘린더
- 날짜 셀 색상 기준 (설정에서 조정 가능)

| 학습량 | 색상 |
|--------|------|
| 0개 | 빈 칸 (회색 테두리) |
| 1-19개 | 연한 초록 |
| 20-29개 | 중간 초록 |
| 30개 이상 | 진한 초록 |

- 날짜 셀 터치 시 해당 날 학습 카테고리, 단어 수 툴팁 표시

### 탭 4. 설정

**단어 관리**
- 단어 하나씩 입력 폼 (일본어 / 후리가나 / 한글 뜻 / 카테고리 선택)
- CSV 파일 업로드로 대량 등록
- 등록된 단어 목록 보기 / 수정 / 삭제
- 카테고리 생성 / 삭제

**백업 & 복원**
- JSON 내보내기 (전체 앱 데이터 백업)
- JSON 가져오기 (백업 데이터 복원)
- CSV 내보내기 (단어장만, 엑셀/구글 시트 편집용)

**학습 설정**
- 하루 학습 단어 수 (기본 10)
- 오답 졸업 연속 정답 횟수 (기본 3)
- 잔디 기준 수치 조정
  - 기본(연한 색): 기본 10
  - 놀람(중간 색): 기본 20
  - 최고(진한 색): 기본 30

### 학습 로직 상세

**하루 단어 선택 알고리즘**
1. 오답 단어 중 `wrongCount` 높은 순으로 최대 8개 선택
2. 나머지를 새 단어로 채워 총 `dailyGoal`개 구성 (새 단어 최소 2개 보장)
3. "전체 혼합" 선택 시 모든 카테고리에서 위 로직 적용
4. "오답노트" 선택 시 오답 단어만으로 구성

**오답 처리**
- 틀리면: `wrongCount += 1`, `correctStreak = 0`
- 맞으면: `correctStreak += 1`
- `correctStreak >= graduationStreak` 이면 오답 졸업 (`wrongCount = 0`, `correctStreak = 0`)

**오답노트 카테고리 조건**
- `wrongCount >= 1` 인 단어 전체

---

## 5. 배포 가이드

### GitHub Pages 배포 절차
1. GitHub에서 새 저장소 생성 (`jp-vocab-app`)
2. 로컬에서 파일 작성 후 push
```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/사용자명/jp-vocab-app.git
git push -u origin main
```
3. 저장소 Settings → Pages → Branch: `main` / `/ (root)` 선택 → Save
4. 배포 완료: `https://사용자명.github.io/jp-vocab-app`

### PWA 홈 화면 추가 (모바일)
- **iOS Safari**: 공유 버튼 → "홈 화면에 추가"
- **Android Chrome**: 주소창 우측 메뉴 → "앱 설치" 또는 "홈 화면에 추가"

### 오프라인 동작
- Service Worker가 정적 파일(HTML, CSS, JS)을 캐싱
- 오프라인 상태에서도 앱 실행 및 학습 가능
- 데이터는 localStorage에 저장되므로 네트워크 불필요
