// Joy Markdown Studio v3.9.7 문서 템플릿 데이터 및 제어 로직 (templates.js)

const DOCUMENT_TEMPLATES = {
    thesis: `---\ntags: [학술논문, 연구]\n---\n\n# [논문 제목] (Thesis Title)

**저자 (Author):** 홍길동 (Gildong Hong)
**소속 (Affiliation):** 한국대학교 컴퓨터공학과 (Department of Computer Science, Hankuk University)
**날짜 (Date):** 2026년 5월 30일

---

## 1. 초록 (Abstract)
이 논문에서는 ...에 대한 새로운 접근 방식을 제안합니다. 기존 연구들은 ...의 한계를 가지고 있었으나, 제안 모델은 ...을 도입하여 해결합니다. 실험 결과 제안된 방법이 기존 기법 대비 **15% 이상의 성능 향상**을 보였습니다.

> **주요어 (Keywords):** 인공지능, 마크다운 에디터, 지식 그래프, 수식 렌더링

---

## 2. 서론 (Introduction)
최근 ... 분야의 비약적인 발전으로 효율적인 문서 작성 환경에 대한 요구가 증대되고 있습니다. 

### 2.1 연구 배경 (Background)
기존의 도구들은 복잡한 수식과 다이어그램을 실시간으로 작성하는 데 있어 한계가 있었습니다. 특히, 다음과 같은 문제점들이 보고되었습니다:
- $O(N^2)$ 이상의 시간 복잡도를 갖는 비효율적인 렌더링 방식.
- 마인드맵과 흐름도를 수작업으로 동기화해야 하는 번거로움.

---

## 3. 제안 방법 (Proposed Methodology)
본 연구에서는 데이터 흐름을 직관적으로 구조화하기 위해 다음과 같은 수식을 정의하고 활용합니다.

$$
f(x) = \\sigma \\left( \\sum_{i=1}^{n} w_i x_i + b \\right)
$$

여기서 $\\sigma(z)$는 다음과 같은 Sigmoid 활성화 함수를 나타냅니다:

$$
\\sigma(z) = \\frac{1}{1 + e^{-z}}
$$

### 시스템 설계도 (System Architecture)
\`\`\`mermaid
graph TD
    A[사용자 입력] --> B[마크다운 파서]
    B --> C[실시간 프리뷰 렌더러]
    B --> D[지식 그래프 추출기]
    C --> E[수식 & 다이어그램 동적 마운트]
\`\`\`

---

## 4. 실험 및 분석 (Experiments)
제안하는 시스템의 효율성을 검증하기 위해 기존 시스템과의 비교 평가를 진행하였습니다.

| 평가 지표 (Metric) | 기존 시스템 (Baseline) | 제안 시스템 (Proposed) | 개선율 (Improvement) |
| :--- | :---: | :---: | :---: |
| 초기 렌더링 속도 | 350ms | **45ms** | +87% |
| 동기화 지연 시간 | 120ms | **8ms** | +93% |
| 메모리 사용량 | 124MB | **38MB** | +69% |

---

## 5. 결론 (Conclusion)
본 연구에서는 복잡한 문서 구조를 효율적으로 설계할 수 있는 실시간 렌더링 시스템을 제안하였습니다. 향후 연구에서는 클라우드 동기화의 충돌 해결 알고리즘을 한층 더 고도화할 예정입니다.

### 참고문헌 (References)
1. 홍길동, "차세대 웹 기반 마크다운 에디터 설계," 한국컴퓨터학회지, 2025.
2. Doe, J., "Real-time Graph Visualization in Markdown," Journal of Web Engineering, 2026.`,

    report: `---\ntags: [보고서, 업무]\n---\n\n# [레포트/보고서 제목]

**작성자:** [이름/부서]
**작성일:** 2026-05-30
**버전:** v1.0.0

---

## 1. 개요 (Executive Summary)
본 보고서는 최근 진행된 [프로젝트/시장 조사]의 주요 성과와 핵심 지표를 요약하고, 향후 사업 방향을 수립하기 위해 작성되었습니다.

---

## 2. 본론 및 현황 분석 (Main Analysis)
현재 시장 상황과 내부 리소스 배분 상태는 다음과 같습니다.

### 2.1 핵심 성과 지표 (KPIs)
- **사용자 증가율:** 전월 대비 **25% 상승**
- **이탈률 (Churn Rate):** 목표치인 3.5% 이하로 **안정화 (현재 2.8%)**
- **시스템 가동률:** **99.98% 달성** (무중단 배포 적용 완료)

> [!NOTE]
> 2분기 중 출시 예정인 신기능 '문서 템플릿'의 반응에 따라 3분기 목표 매출액을 상향 조정할 예정입니다.

### 2.2 일정 및 마일스톤 (Gantt Chart)
\`\`\`mermaid
gantt
    title 프로젝트 핵심 일정
    dateFormat  YYYY-MM-DD
    section 기획 및 연구
        요구사항 분석           :active, a1, 2026-05-01, 10d
        UI/UX 디자인           :a2, after a1  , 7d
    section 개발 단계
        프론트엔드 컴포넌트     :2026-05-15  , 15d
        백엔드 API 연동         :2026-05-20  , 12d
    section 테스트 및 배포
        QA 및 성능 튜닝        :2026-06-02  , 7d
\`\`\`

---

## 3. 리스크 평가 및 향후 계획 (Risks & Strategy)
1. **인프라 비용 상승 리스크:** 데이터 처리량 급증으로 인한 클라우드 요금 상승 대비 필요.
2. **해외 진출 전략:** 다국어 번역 리소스를 확충하여 글로벌 마켓 대응 속도 강화.

---

## 4. 종합 건의사항 (Recommendations)
- 연구개발 부서의 충원을 적극 권장함.
- 마케팅 채널 다양화를 통한 신규 유입 단가(CAC) 최적화 필요.`,

    wiki: `---\ntags: [지식노트, 위키]\n---\n\n# 📔 [개념/주제 명칭] 지식 노트

**카테고리:** [예: 컴퓨터 과학 / 물리 / 화학]
**작성일:** 2026-05-30
**마지막 수정:** 2026-05-30
**관련 키워드:** #개념정리 #학습노트 #위키

---

## 1. 개념 정의 (Definition)
**[주제 명칭]**이란 ...을 의미합니다. 이는 특히 ... 분야에서 핵심적인 역할을 하며, 기존 방식과의 차이점은 ...에 있습니다.

---

## 2. 핵심 이론 및 수식 (Key Theory & Formulas)
해당 개념을 수학적으로 정립하면 다음과 같은 지배 방정식으로 표현할 수 있습니다.

$$
\\Delta U = Q - W
$$

여기서 각 기호의 정의는 다음과 같습니다:
- $\\Delta U$: 계의 내부에너지 변화량 (Change in Internal Energy)
- $Q$: 계에 흡수된 열량 (Heat added to the system)
- $W$: 계가 외부에 한 일 (Work done by the system)

### 핵심 개념 간의 관계도
\`\`\`mermaid
graph LR
    ConceptA[주제 정의] --> ConceptB(핵심 이론)
    ConceptB --> Formula1[수식 유도]
    ConceptB --> Formula2[실제 적용 예시]
    Formula1 --> Result[성능 검증]
\`\`\`

---

## 3. 실무/실생활 적용 사례 (Applications)
- **사례 A:** ...의 열역학적 분석 시 상태 변화 추적에 사용.
- **사례 B:** 대용량 시스템 분산 캐시 설계 시 일관성 유지 기법으로 응용.

---

## 4. 요약 및 주의 사항 (Summary & Warnings)
> [!WARNING]
> 본 모델은 이상적인 가역 과정을 가정하고 있으므로, 실제 비가역 시스템에 적용할 때는 마찰 및 열 손실 손실 계수($\\eta_{loss}$)를 추가로 고려해야 합니다.

- [x] 기본 공식 암기 및 증명 완료
- [ ] 실제 기출문제/실무 적용 실습 3회 이상 풀이
- [ ] 관련 참고 논문 2편 읽고 추가 링크 연결`,

    todo: `---\ntags: [할일목록, 계획]\n---\n\n# 📅 주간 & 일일 업무 플래너 (TODO)

**날짜:** 2026년 5월 4주차
**주간 목표:** 신규 마크다운 에디터 기능 개발 완료 및 QA 검증

---

## 🎯 이번 주 핵심 목표 (Weekly Key Goals)
- [ ] 에디터 내 문서 템플릿 주입 UI 및 함수 구현 (v3.9.7)
- [ ] 구글 드라이브 동기화 오류 엣지 케이스 완전 방어
- [ ] 윈도우 배포 파일 빌드 및 최종 릴리즈 준비

---

## 📋 요일별 세부 할 일 (Daily Task Checklist)

### 🗓️ 월요일 (Monday)
- [x] 이모지 잘림 버그 해결 상태 확인 및 보정
- [x] backend API 브릿지 에러 500 디버깅 및 고도화
- [ ] 템일릿 아이디에이션 및 디자인 스케치

### 🗓️ 화요일 (Tuesday)
- [ ] 사이드바 템플릿 신규 탭 마크업 추가
- [ ] 9가지 카테고리 템플릿 마크다운 리소스 구축
- [ ] 템플릿 주입 로직 초안 작성

### 🗓️ 수요일 (Wednesday)
- [ ] 덮어쓰기/현재위치삽입 팝업 모달 제작
- [ ] Strict Mode 예외 사항(TypeError) 방어 처리 테스트
- [ ] 다국어 번역 팩에 템플릿 관련 키 추가 및 적용

### 🗓️ 목요일 (Thursday)
- [ ] 전체 모듈 결합 QA 진행
- [ ] 에디터 스크롤 잘림 및 한글 씹힘 현상 추가 확인
- [ ] 배포 번들(\`setup.py\`) 버전 정보 \`3.9.7\`로 업그레이드

### 🗓️ 금요일 (Friday)
- [ ] PyInstaller EXE 빌드 및 구동 속도 검증
- [ ] Git 커밋, 태그 추가(\`v3.9.7\`) 및 원격 리포지토리 푸시
- [ ] 주간 보고서 작성 및 회고

---

## 📝 아이디어 & 백로그 메모 (Idea Scratchpad)
- **개선 아이디어:** 템플릿 종류를 사용자가 직접 커스텀해서 로컬 스토리지에 저장하는 기능은 v4.0.0 마일스톤에 추가하면 좋을 듯!
- **참고사항:** 템플릿 렌더링 시 Lucide 아이콘이 깨지지 않도록 \`lucide.createIcons()\`를 매 렌더링 후 호출해줘야 함.`,

    shopping: `---\ntags: [쇼핑목록, 소비]\n---\n\n# 🛒 스마트 쇼핑 및 예산 플래너

**쇼핑일:** 2026-05-30
**목표 예산:** ₩250,000
**쇼핑 장소:** 이마트 & 온라인 이케아 몰

---

## 🛍️ 카테고리별 쇼핑 목록

### 🥦 신선 식품 & 식료품 (Grocery)
- [x] 닭가슴살 1kg (냉동)
- [x] 유기농 샐러드 팩 3입
- [ ] 아보카도 5과
- [ ] 플레인 요거트 대용량

### 🧴 생활 필수품 (Household Items)
- [x] 친환경 주방세제 리필
- [ ] 3겹 천연펄프 롤화장지 (30롤)

### 🛋️ 리빙 & 인테리어 (Home Decor)
- [ ] 책상 정리용 아크릴 트레이
- [ ] 모니터 받침대 (우드 톤)
- [ ] 스마트 무드등 (IoT 연동)

---

## 📊 예산 산출 및 비용 관리

| 물품명 | 예상 가격 | 실제 구매가 | 상태 | 비고 |
| :--- | :---: | :---: | :---: | :--- |
| 냉동 닭가슴살 | ₩15,000 | **₩13,800** | 구매완료 | 세일 적용 |
| 샐러드 팩 | ₩8,900 | **₩8,900** | 구매완료 | - |
| 화장지 (30롤) | ₩18,900 | - | 예정 | 1+1 행사 대기 |
| IoT 무드등 | ₩45,000 | - | 예정 | 해외직구 비교 |

> **누적 지출 금액:** ₩22,700 (남은 예산: ₩227,300)

---

## 📌 알뜰 쇼핑 팁 (Shopping Notes)
- 대형마트는 **둘째, 넷째 일요일 의무 휴무**이므로 방문 전 반드시 날짜 체크!
- 이마트 앱 쿠폰 다운로드하여 5% 추가 할인 적용하기.`,

    bucket: `---\ntags: [버킷리스트, 목표]\n---\n\n# 🌟 나의 인생 버킷리스트 (Life Bucket List)

> "미루지 않으면 언젠가 반드시 꿈꾸던 순간에 서 있게 된다."

---

## 🏆 핵심 5대 도전 과제 (Top 5 Lifetime Goals)
1. **킬리만자로 정상 정복:** 해발 5,895m 만년설 밟기.
2. **나만의 책 집필 및 출판:** 마크다운 에디터 개발 노하우가 담긴 기술 서적 출간.
3. **독립 장편 영화 제작:** 시나리오 작성부터 연출까지 도전.
4. **유럽 한 달 살기:** 체코 프라하 또는 이탈리아 토스카나 시골 마을.
5. **글로벌 IT 서비스 론칭:** 전 세계 10만 명 이상이 매일 사용하는 웹 앱 배포.

---

## 🗺️ 카테고리별 꿈 목록

### ✈️ 여행 & 탐험 (Travel & Adventure)
- [ ] 오로라 감상하기 (캐나다 옐로나이프)
- [ ] 스위스 인터라켄에서 패러글라이딩 타기
- [x] 제주도 자전거 환상자전거길 종주 완료

### 💻 커리어 & 역량 (Career & Self-Improvement)
- [ ] 오픈소스 프로젝트에 핵심 기여자(Contributor)로 참여하기
- [ ] 영어 회화 중고급 수준 도달 (OPIC AL 획득)
- [ ] 3개 국어 기초 회화 마스터하기 (한/영/일)

### 🏋️ 건강 & 스포츠 (Health & Sports)
- [ ] 마라톤 풀코스(42.195km) 완주
- [ ] 바디프로필 촬영하기 (체지방률 10% 미만 진입)
- [ ] 서핑 스킬 익혀서 발리 파도 타기

---

## 📈 버킷리스트 달성 진행도

\`\`\`mermaid
pie title 버킷리스트 분야별 달성률
    "여행 & 탐험 (완료)" : 1
    "여행 & 탐험 (진행중)" : 3
    "커리어 & 역량 (진행중)" : 4
    "건강 & 스포츠 (진행중)" : 3
\`\`\``,

    travel: `---\ntags: [여행계획, 일정]\n---\n\n# ✈️ [여행지] 3박 4일 상세 여행 계획서

**일정:** 2026-07-15 ~ 2026-07-18
**여행지:** 일본 교토 & 오사카 (Kyoto & Osaka)
**동반 인원:** 나홀로 여행

---

## 🧳 체크리스트 (Packing Checklist)
- [ ] 여권 및 항공권 E-티켓 출력본
- [ ] 엔화 환전 (₩500,000 상당) 및 트래블로그 카드
- [ ] 110V 돼지코 어댑터 & 보조배터리
- [ ] 개인 상비약 (소화제, 대역일반약)
- [ ] 편안한 운동화 (하루 평균 2만 보 이상 도보 예상)

---

## 🗺️ 일자별 전체 동선 (Daily Itinerary)

### 🗓️ 1일차: 교토 역사 정취 느끼기
- **오전:** 간사이 공항 도착 후 하루카 특급열차 타고 교토역으로 이동.
- **오후:** 기요미즈데라(청수사) 관람 후 니년자카/산년자카 전통 거리 산책.
- **저녁:** 기온 거리에서 카모강을 바라보며 규카츠 저녁 식사 및 숙소 체크인.

### 🗓️ 2일차: 자연과 대나무 숲 힐링
- **오전:** 아라시야마 대나무 숲(치쿠린) 아침 일찍 방문하여 한적하게 걷기.
- **오후:** 킨카쿠지(금각사) 관람 후 교토 버스로 가와라마치 중심가 쇼핑.
- **저녁:** 현지 이자카야에서 야키토리와 나마비루 즐기기.

---

## 💰 예상 지출 및 예산 설계

| 항목 | 상세 내용 | 예산 (원) | 결제 상태 |
| :--- | :--- | :---: | :---: |
| 항공권 | 간사이 왕복 항공 | ₩280,000 | 결제완료 |
| 숙소 | 교토 비즈니스 호텔 3박 | ₩180,000 | 결제완료 |
| 교통 | 하루카 편도 + 이코카 충전 | ₩50,000 | 예정 |
| 식비 | 1일 ₩70,000 기준 | ₩280,000 | 예정 |

> **총 예상 경비:** ₩790,000`,

    timetable: `---\ntags: [시간표, 스케줄]\n---\n\n# 🏫 2026학년도 1학기 주간 시간표

**학번:** 202610204
**이름:** 홍길동
**총 이수 학점:** 18학점

---

## 📅 주간 수업 스케줄러

| 시간 (Time) | 월 (Mon) | 화 (Tue) | 수 (Wed) | 목 (Thu) | 금 (Fri) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **09:00 - 10:30** | 알고리즘 설계<br>(공학관 301호) | - | 알고리즘 설계<br>(공학관 301호) | - | - |
| **10:30 - 12:00** | - | 선형대수학<br>(학술관 204호) | - | 선형대수학<br>(학술관 204호) | - |
| **12:00 - 13:00** | 🍱 점심시간 | 🍱 점심시간 | 🍱 점심시간 | 🍱 점심시간 | 🍱 점심시간 |
| **13:00 - 14:30** | 인공지능 개론<br>(IT관 502호) | 데이터베이스<br>(공학관 202호) | 인공지능 개론<br>(IT관 502호) | 데이터베이스<br>(공학관 202호) | - |
| **14:30 - 16:00** | - | - | - | - | 대학 글쓰기<br>(인문관 101호) |
| **16:00 - 17:30** | - | 오픈소스 프로젝트<br>(IT관 104호) | - | - | - |

---

## 📌 과목별 강의 정보 & 교수님 연락처

1. **알고리즘 설계:** 이알고 교수님 (algo@university.ac.kr)
   - 과제 제출 기한: 매주 수요일 수업 전까지 LMS 업로드.
2. **인공지능 개론:** 김지능 교수님 (ai_kim@university.ac.kr)
   - 중간 대체 텀프로젝트 발표 준비 필요 (주제: 마크다운 에디터 추천 알고리즘).
3. **오픈소스 프로젝트:** 최코드 교수님 (oss_choi@university.ac.kr)
   - GitHub Pull Request 2회 이상 머지 미션 부여됨.`,

    memo: `---\ntags: [메모장, 아이디어]\n---\n\n# 📝 아이디어 퀵 메모 (Quick Idea Scratchpad)

**태그:** #생각정리 #아이디어 #스크래치패드
**작성시간:** 2026-05-30 23:00

---

## 💡 오늘의 영감 & 핵심 아이디어
마크다운 에디터의 다음 주요 업그레이드 방향으로 **"오프라인 인공지능 자동완성 기능"** 탑재 검토.
- WebAssembly 기반의 경량 로컬 LLM을 브라우저 스레드에서 백그라운드로 작동시킴.
- 사용자의 프라이버시가 100% 안전하게 로컬 장치에만 보존되는 차별화 포인트 형성.

---

## 📌 빠른 메모 및 스케치 (Quick Notes)
- [ ] setup.py 버전 정보를 v3.9.7로 올리기 전에 PyInstaller 호환성 체크 필수.
- [x] 이모지 마트 잘림 현상이 macOS Retina 디스플레이에서도 안 깨지는지 검증. (성공)
- [ ] 템플릿 삽입 시 발생할 수 있는 스크롤 오동작 디버깅.

> "작은 개선이 반복되면 누구도 따라올 수 없는 거대한 격차가 만들어진다."

---

## 🔗 관련 참고 링크 및 레퍼런스
- CodeMirror 6 State & Transaction 가이드: [공식문서 보기](https://codemirror.net/6/docs/ref/#state)
- Mermaid.js 커스텀 렌더 테마 관련 이슈: [GitHub Issue #4023](https://github.com/mermaid-js/mermaid)`,

    quant: `---\ntags: [투자, 퀀트, 포트폴리오, 자산배분]\n---\n\n# 📈 퀀트 투자 분석 및 자산 배분 플래너 (Quant Portfolio Planner)\n\n**포트폴리오 기준일:** 2026-06-02\n**목표 연수익률 (CAGR):** 15.0% | **최대 허용 낙폭 (MDD):** -15.0%\n\n---\n\n## 📐 1. 자산 배분 수학적 모델 및 켈리 공식 (Kelly Criterion)\n\n최적의 자산 배분 비중과 리스크 대비 베팅 사이즈를 결정하기 위해 **평균-분산 모델** 및 **켈리 공식(Kelly Criterion)**을 적용합니다.\n\n### 켈리 공식에 의한 자산군별 베팅 비율 ($f^*$) 산출:\n\n$$\nf^* = \\\\frac{p \\\\cdot b - q}{b} = \\\\frac{p(b + 1) - 1}{b}\n$$\n\n*   $f^*$: 전체 투자 자금 중 본 자산군에 투입할 최적의 비율\n*   $p$: 투자 성공(상승) 확률 (Win Probability)\n*   $q$: 투자 실패(하락) 확률 ($1 - p$)\n*   $b$: 손익비 (Payoff Ratio = 평균 수익금 / 평균 손실금)\n\n> [!NOTE]\n> 켈리 공식은 기하 기댓값을 최대화하지만, 변동성을 억제하기 위해 실무에서는 **하프 켈리 (Fractional Kelly, $0.5 \\\\cdot f^*$)**를 적용하여 리스크를 보수적으로 제어합니다.\n\n---\n\n## 📊 2. 타겟 포트폴리오 자산 배분 비중\n\n현재 전략에 따른 핵심 자산 비중 구성안입니다.\n\n\`\`\`mermaid\npie title 핵심 자산 포트폴리오 비중\n    \"주식증권 (SPY, QQQ, 개별우량주)\" : 45\n    \"암호화폐 (BTC, ETH, 메이저체인)\" : 25\n    \"원자재 및 금 (GLD, USO)\" : 15\n    \"달러 및 현금자산 (USD)\" : 15\n\`\`\`\n\n---\n\n## ⚙️ 3. 트레이딩 알고리즘 및 진입/탈출 의사결정 나무 (Trading Flow)\n\n주요 기술적 지표(이동평균선, RSI) 및 매크로 이벤트에 근거한 매매 실행 알고리즘입니다.\n\n\`\`\`mermaid\ngraph TD\n    A[시장 가격 스캔] --> B{50일/200일 골든크로스?}\n    B -->|Yes| C{RSI 과매수 영역? RSI > 70}\n    B -->|No| D[대기 및 현금 비중 유지]\n    C -->|Yes| E[추세 추종: 분할 매수 보류]\n    C -->|No| F{정기 리밸런싱 주기 도래?}\n    F -->|Yes| G[목표 비중 초과분 익절 및 재배분]\n    F -->|No| H[켈리 공식에 맞춘 하프 베팅 진입]\n    \n    style H fill:#10b981,stroke:#059669,color:#fff\n    style D fill:#ef4444,stroke:#dc2626,color:#fff\n\`\`\`\n\n---\n\n## 📝 4. 보유 및 관심 투자 자산 일람 (Asset Ledger)\n\n| 자산 구분 | 티커/심볼 | 현재 비중 (%) | 매수 평단가 | 목표 매도가 | 손절 라인 (Stop-Loss) | 투자 상태 |\n| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n| 주식증권 | **QQQ** | 30.0% | $450.00 | $520.00 | $410.00 | 보유 중 |\n| 주식증권 | **TSLA** | 15.0% | $180.00 | $260.00 | $160.00 | 보유 중 |\n| 암호화폐 | **BTC** | 18.0% | $65,000 | $88,000 | $58,000 | 보유 중 |\n| 암호화폐 | **ETH** | 7.0% | $3,200 | $4,500 | $2,800 | 분할 매수 중 |\n| 현금/달러 | **USD** | 15.0% | - | - | - | 대기 자금 |\n\n---\n\n## 🔒 5. 리스크 관리 가이드라인 (Macro & Risk Management)\n\n> [!WARNING]\n> 암호화폐는 변동성이 매우 크므로 단일 종목에 총 자산의 **10% 이상을 배팅하지 않는 것**을 철칙으로 삼습니다. 매주 일요일 저녁 리밸런싱을 시행하여 급격히 변동한 자산 비중을 복원합니다.\n\n- [x] 주요 미연준(FOMC) 금리 발표 일정 캘린더 등록 완료\n- [ ] 미국 CPI/PPI 발표 지표 모니터링\n- [ ] 주간 보유 포트폴리오 리밸런싱 매도/매수 주문 실행 완료`,

    kstock: `---\ntags: [투자, 국장, 매매일지, 오답노트]\n---\n\n# 🇰🇷 한국주식 매매일지 & 시장 분석 다이어리 (K-Stock Trading Diary)\n\n**매매 일자:** 2026-06-02\n**당일 코스피 (KOSPI):** 2,650.50 (▲0.45%) | **코스닥 (KOSDAQ):** 870.20 (▼0.15%)\n**원/달러 환율:** 1,350.00원 | **고객예수금:** ₩15,000,000\n\n---\n\n## 📐 1. 세금 및 거래 수수료 차감 후 순수익률 계산 공식 (KaTeX)\n\n국내 주식 거래 시 발생하는 세금(유관기관 수수료, 증권사 수수료, 농어촌특별세 및 거래세)을 정밀하게 반영한 세후 수익률 공식입니다.\n\n### 세후 순수익률 ($R_{net}$) 산출식:\n\n$$\nR_{net} = \\\\frac{S_{sell} \\\\cdot (1 - \\\\gamma_{fees} - \\\\gamma_{tax}) - B_{buy} \\\\cdot (1 + \\\\gamma_{fees})}{B_{buy}} \\\\times 100 (%)\n$$\n\n*   $B_{buy}$: 총 매수 금액 (매수가 $\\times$ 수량)\n*   $S_{sell}$: 총 매도 금액 (매도가 $\times$ 수량)\n*   $\\gamma_{fees}$: 증권사 + 유관기관 수수료율 (예: $0.015\\\\% \\\\rightarrow 0.00015$)\n*   $\\gamma_{tax}$: 증권거래세 + 농어촌특별세율 (코스피 $0.15\\\\%$, 코스닥 $0.15\\\\% \\\\rightarrow 0.0015$)\n\n---\n\n## ⚙️ 2. 당일 주도 섹터 및 외국인/기관 수급 분석 (Mermaid)\n\n그날의 시장 에너지를 분석하여 강세 테마와 주요 수급 주체의 방향성을 기록합니다.\n\n\`\`\`mermaid\ngraph TD\n    A[코스피/코스닥 당일 거래대금 상위] --> B{수급 주체가 누구인가?}\n    B -->|외국인/기관 양매수| C[수급 우량주 돌파/눌림목 매수 타점 스캔]\n    B -->|개인만 매수| D[테마성 급등주 테마 스크래칭 및 뇌동 매수 금지]\n    C --> E{당일 주도 섹터인가?}\n    E -->|Yes: 반도체/이차전지| F[적극 비중 배팅]\n    E -->|No: 개별 바이오/정치테마| G[단타/스캘핑 타이트한 손절 대응]\n    \n    style F fill:#3b82f6,stroke:#1d4ed8,color:#fff\n    style D fill:#f59e0b,stroke:#d97706,color:#fff\n\`\`\`\n\n---\n\n## 📝 3. 당일 매매 일지 및 거래 내역 (Trading Ledger)\n\n| 종목명 (티커) | 시장 구분 | 매매 구분 | 체결 수량 | 평단가 (원) | 실구매액 (원) | 당일 거래대금 | 주도 테마/매매 근거 |\n| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |\n| **삼성전자** (005930) | KOSPI | 매수 | 100주 | 78,500원 | 7,850,000원 | 8,500억 | 반도체 HBM 공급망 통과 뉴스 수급 유입 |\n| **알테오젠** (196170) | KOSDAQ | 매도 | 20주 | 210,000원 | 4,200,000원 | 4,200억 | 바이오 낙폭과대 반등 구간 분할 익절 완료 |\n| **에코프로** (086520) | KOSDAQ | 관망 | - | - | - | 1,800억 | 이차전지 지지선 테스트 중, 매수 보류 |\n\n---\n\n## 🧠 4. 뇌동매매 방지 오답노트 & 자아성찰 (Trading Review)\n\n> [!CAUTION]
> 장 시작 후 **초반 30분(09:00 ~ 09:30) 이외의 급등주 추격 매수**는 무조건 손실로 이어진다는 것을 명심합니다. 손절라인(-3%) 도달 시 예외 없이 시장가 기계적 대응을 원칙으로 삼습니다.\n\n- [x] 원칙 매매 준수 여부: **90점 (뇌동 매수 없음, 손절 원칙 준수)**\n- [ ] 당일 손실 발생 종목의 차트 캡처 및 지지선 붕괴 원인 분석\n- [ ] 다음 날 장전 미 증시(나스닥/필라델피아 반도체지수) 마감 브리핑 확인 예약\n\n---\n\n## 📅 5. 공모주(IPO) 및 주요 경제 일정 캘린더\n\n- [x] OO솔루션 공모 청약 신청 완료 (청약금 환불일: 6/4)\n- [ ] 금요일 금융통화위원회 기준금리 결정 발표 모니터링`\n};

let activeTemplateId = null;

function t(key) {
    const lang = window.currentLang || 'ko';
    const trans = window.translations || (typeof translations !== 'undefined' ? translations : null);
    if (trans && trans[lang] && trans[lang][key]) {
        return trans[lang][key];
    }
    if (trans && trans["en"] && trans["en"][key]) {
        return trans["en"][key];
    }
    return key;
}

function renderTemplates() {
    const container = document.getElementById('sidebar-templates-list');
    if (!container) return;
    
    const templateCards = [
        { id: 'thesis', icon: 'graduation-cap', bg: 'rgba(236, 72, 153, 0.1)', border: '#ec4899' },
        { id: 'report', icon: 'file-text', bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6' },
        { id: 'wiki', icon: 'book-open', bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981' },
        { id: 'todo', icon: 'check-square', bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b' },
        { id: 'shopping', icon: 'shopping-cart', bg: 'rgba(99, 102, 241, 0.1)', border: '#6366f1' },
        { id: 'bucket', icon: 'heart', bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444' },
        { id: 'travel', icon: 'map', bg: 'rgba(14, 165, 233, 0.1)', border: '#0ea5e9' },
        { id: 'timetable', icon: 'calendar', bg: 'rgba(139, 92, 246, 0.1)', border: '#8b5cf6' },
        { id: 'memo', icon: 'sticky-note', bg: 'rgba(20, 184, 166, 0.1)', border: '#14b8a6' },
        { id: 'quant', icon: 'line-chart', bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981' },
        { id: 'kstock', icon: 'trending-up', bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444' }
    ];
    
    container.innerHTML = templateCards.map(c => `
        <div class="template-card" onclick="insertTemplate('${c.id}')" style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-left: 3px solid ${c.border}; border-radius: 6px; cursor: pointer; transition: all 0.2s ease-in-out; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">
            <div class="template-card-icon" style="width: 30px; height: 30px; border-radius: 50%; background: ${c.bg}; border: 1px solid ${c.border}40; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: ${c.border};">
                <i data-lucide="${c.icon}" style="width: 14px; height: 14px;"></i>
            </div>
            <div style="display: flex; flex-direction: column; gap: 2px; text-align: left; overflow: hidden; flex: 1;">
                <span style="font-size: 0.78em; font-weight: 600; color: var(--text-main); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${t('template_' + c.id + '_title')}</span>
                <span style="font-size: 0.66em; color: var(--text-muted); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${t('template_' + c.id + '_desc')}</span>
            </div>
        </div>
    `).join('');
    
    // Add CSS styling dynamically on load if not present
    if (!document.getElementById('template-card-styles')) {
        const style = document.createElement('style');
        style.id = 'template-card-styles';
        style.innerHTML = `
            .template-card:hover {
                background: rgba(255, 255, 255, 0.05) !important;
                border-color: rgba(255, 255, 255, 0.2) !important;
                transform: translateY(-1px);
                box-shadow: 0 4px 10px rgba(0,0,0,0.15);
            }
            .template-card:active {
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);
    }
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

// 템플릿 클릭 시 새 문서 이름 입력 모달을 즉시 오픈
function insertTemplate(type) {
    window.selectedTemplateId = type;
    if (typeof window.openCreateModal === 'function') {
        window.openCreateModal('file_template');
    }
}

// 템플릿 선택기 토글 기능
function toggleTemplateSelector(forceState) {
    const treeContainer = document.getElementById('file-tree-container');
    const templateSelector = document.getElementById('sidebar-template-selector');
    const createBtn = document.getElementById('template-create-btn');
    
    if (!treeContainer || !templateSelector) return;
    
    const isCurrentlyVisible = templateSelector.style.display !== 'none';
    const show = (forceState !== undefined) ? forceState : !isCurrentlyVisible;
    
    if (show) {
        treeContainer.style.display = 'none';
        templateSelector.style.display = 'flex';
        if (createBtn) createBtn.classList.add('active');
        
        // 템플릿 목록 렌더링 작동
        renderTemplates();
    } else {
        templateSelector.style.display = 'none';
        treeContainer.style.display = 'flex';
        if (createBtn) createBtn.classList.remove('active');
    }
}

function closeTemplateConfirmModal() {
    const modal = document.getElementById('template-confirm-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    activeTemplateId = null;
}

function applyTemplate(mode) {
    if (!activeTemplateId) return;
    const content = DOCUMENT_TEMPLATES[activeTemplateId];
    if (!content) return;
    
    if (mode === 'overwrite') {
        if (typeof window.setEditorContent === 'function') {
            window.setEditorContent(content);
        }
    } else if (mode === 'insert') {
        const view = window.cmEditor;
        if (!view) {
            const textarea = document.getElementById('editor');
            if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;
                const before = text.substring(0, start);
                const after = text.substring(end);
                textarea.value = before + "\n\n" + content + "\n\n" + after;
                textarea.focus();
                textarea.selectionStart = textarea.selectionEnd = start + content.length + 4;
                if (typeof window.handleEditorInput === 'function') {
                    window.handleEditorInput();
                }
            }
        } else {
            const state = view.state;
            const ranges = state.selection.ranges;
            if (ranges.length > 0) {
                const range = ranges[0];
                const from = range.from;
                const to = range.to;
                view.dispatch({
                    changes: { from, to, insert: "\n\n" + content + "\n\n" },
                    selection: { anchor: from + content.length + 4 }
                });
            }
        }
    }
    
    closeTemplateConfirmModal();
    if (typeof window.showToast === 'function') {
        window.showToast(t('toast_default'));
    }
    if (typeof window.setViewMode === 'function') {
        window.setViewMode('split');
    }
}

// 윈도우 스코프 바인딩
window.insertTemplate = insertTemplate;
window.applyTemplate = applyTemplate;
window.closeTemplateConfirmModal = closeTemplateConfirmModal;
window.renderTemplates = renderTemplates;
window.toggleTemplateSelector = toggleTemplateSelector;
window.DOCUMENT_TEMPLATES = DOCUMENT_TEMPLATES;
