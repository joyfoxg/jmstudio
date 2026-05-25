# 🧪 Joy Markdown Studio v3.61 🌟

> **수학, 물리학, 화학을 아우르는 최상의 이공계 연구 및 학술용 마크다운 편집·시각화 스튜디오**  
> Python (`PyWebView` + `Bottle`)과 모던 Vanilla CSS/JS로 직조된 프리미엄 데스크톱 마크다운 크리에이터 앱입니다.

---

## 📸 Overview
**Joy Markdown Studio**는 단순한 문서 뷰어를 넘어, 이공계 연구자 및 학생들의 생산성을 극대화하기 위해 설계된 학술 친화형 마크다운 편집기입니다. 복잡한 수식 기호 입력 지원, 화학명 검색을 통한 2D 분자 구조식 자동 생성, 실시간 다이어그램(Mermaid) 렌더링, 독립형 고품격 HTML 내보내기 등 최상급 기능을 유려한 글래스모피즘(Glassmorphism) UI와 함께 제공합니다.

---

## ✨ Key Features (핵심 기능)

### 1. 📐 이공계 전용 학술 수식 도우미 (KaTeX Integration)
* **실시간 수식 렌더링**: 빠르고 정확한 KaTeX 엔진을 탑재하여 인라인 수식(`$...$`)과 블록 수식(`$$...$$`)을 끊김 없이 렌더링합니다.
* **3대 이공계 탭형 도우미 패널**: 
  * **수학(📐)**: 분수, 루트, 미적분, 극한, 그리스 문자, 주요 기호 원클릭 삽입.
  * **물리(⚛️)**: 쿨롱 법칙, 만유인력, 슈뢰딩거 방정식, 로런츠 힘 등 필수 공식 제공.
  * **화학/생명(🧪)**: 아레니우스 식, 이상기체 상태방정식, 반응 화살표, DNA 염기쌍, 깁스 자유 에너지 템플릿 지원.
* **스마트 커서 및 와일드카드**: 수식 템플릿 삽입 시 편집할 부분(`?`)을 마우스 드래그 상태로 자동 포커싱하여 타이핑 동선을 최소화합니다.

### 2. 🧬 PubChem 실시간 화학 분자 구조식 시각화
* **PubChem API 연동**: 한글 및 영어 화합물 이름(예: `아스피린`, `caffeine`, `캡사이신`) 검색 시 미국 국립의학도서관(NLM) PubChem 데이터베이스에서 실시간으로 분자 데이터 및 SMILES 코드를 가져옵니다.
* **2D 분자 구조 프리뷰**: 검색된 화합물의 2D 벡터 구조식을 패널 내부에서 실시간 그래픽으로 보여줍니다.
* **Smiles 코드 드로어**: 에디터에 ````smiles ```` 코드 블록으로 삽입 시, 메인 프리뷰 영역에서 자동으로 아름다운 화학 골격 모형 구조로 시각화합니다.
* **한국어-영어 매핑 내장**: 한글 화합물 명칭 검색 시 내장 매핑 테이블을 통해 지능적으로 영문 API 쿼리로 우회 탐색합니다.

### 3. 📊 다이내믹 다이어그램 (Mermaid.js)
* 플로우차트(Flowchart), 시퀀스 다이어그램(Sequence), 간트 차트(Gantt), 마인드맵(Mindmap) 등을 마크다운 텍스트 코드로 즉시 시각화합니다.
* **Mermaid 전체 화면 및 줌 모드**: 렌더링된 다이어그램을 더블 클릭하거나 아이콘을 눌러 고해상도 전체 화면 모달로 띄워 정밀 관측할 수 있습니다.

### 4. 🗂️ 똑똑하고 안전한 서재(Library) 파일 관리
* **트리형 탐색기**: 워크스페이스 내 폴더 및 파일 구조를 미려한 디자인으로 보여줍니다.
* **사용자 데이터 보호(안전 언레지스터)**: 문서 삭제 시 물리적인 디스크 파일을 영구 삭제하지 않고, 서재 DB(`md_viewer_config.json`)에서만 제외하여 연구 소스코드 및 문서 유실을 원천 차단합니다.
* **드래그 앤 드롭 지원**: 윈도우 탐색기에서 마크다운 파일(`.md`, `.qmd`, `.txt`)을 앱 화면에 드롭하면 가상 가이드라인과 함께 즉시 불러옵니다.

### 5. 🚀 모던 디자인 & 반응형 UI
* **글래스모피즘 & 네온 테마**: 다크 모드(기본)와 라이트 모드 간의 부드러운 전환을 지원하며, 눈이 편안한 색상 팔레트와 악센트 발광 효과를 적용했습니다.
* **슬라이딩 숨김 패널**: 좌측 익스플로러와 우측 TOC(목차) 패널을 화면 가장자리로 깔끔하게 슬라이딩 접기/펴기 할 수 있어 문서 작성 공간을 극대화합니다.
* **동기화 스크롤(Sync Scroll)**: 에디터 영역과 미리보기 영역의 스크롤 위치를 고도로 동기화하여 긴 문서 검토를 돕습니다.

### 6. 🌐 독립형 Standalone HTML 익스포트
* 편집 중인 마크다운을 외부에 공유할 수 있도록 완벽한 단독 실행형 HTML로 내보냅니다.
* 내보낸 파일은 인터넷 연결만 있으면 별도의 뷰어 없이도 KaTeX 수식, Prism 구문 강조, Mermaid 다이어그램, Smiles 분자 모델이 미려하게 보존되어 정상 렌더링됩니다.

### 7. 🖨️ 프리미엄 무설치 PDF 인쇄 지원
* **미리보기 화면만 맞춤 인쇄**: PDF 인쇄 버튼을 클릭하면 불필요한 에디터 텍스트 영역, 사이드바, 헤더 등의 UI가 자동으로 제거되고 **오직 실시간 미리보기 화면의 아름다운 마크다운 결과물만 A4 규격에 깔끔하게 맞추어 PDF로 출력**됩니다.
* **지능적 잉크 절약 및 테마 전환**: 다크 모드(Dark Mode) 상태에서 인쇄를 진행하더라도, 잉크/토너 낭비를 방지하고 종이에서의 가독성을 극대화하기 위해 **일시적으로 화이트/고대비 테마로 자동 리렌더링되어 출력**되며, 인쇄 다이얼로그가 종료되는 즉시 다시 원래의 세련된 다크 모드로 감쪽같이 자동 복원됩니다.

### 8. 🌐 외부 모바일 기기 접속 및 보안 암호 보호 (v3.61 New)
* **모바일 및 태블릿 원격 접속**: 앱 실행 시 동일한 와이파이/네트워크 내의 다른 PC나 모바일 기기에서 웹 브라우저를 통해 접속할 수 있도록 멀티 네트워킹을 지원합니다. 콘솔창에 제공되는 **Network Access URL(예: `http://192.168.x.x:58220`)**을 입력해 즉시 무선으로 서재를 볼 수 있습니다.
* **접속 보안 비밀번호 설정**: 헤더 우측 상단의 **설정 아이콘(⚙️)**을 통해 웹 접속 시 요구할 암호를 설정할 수 있습니다. 암호 설정 시 외부 접속 시에는 매끄럽고 강력한 **보안 접속 비밀번호 입력 화면(Lock Screen)**이 활성화됩니다.
* **커스텀 포트 및 호스트 바인딩**: 접속 호스트(Bind IP: `0.0.0.0` 또는 `127.0.0.1`)와 웹 서비스 포트 번호를 설정 화면에서 쉽게 변경할 수 있으며 설정은 안전하게 영구 저장됩니다.

### 9. 🌐 한/영 UI 다국어 토글 지원 (v3.61 New)
* **실시간 UI 다국어 번역**: 헤더 영역의 **KR/EN** 토글 버튼을 통해 애플리케이션의 모든 UI(사이드바 탭, 헤더 버튼, 라벨, 플레이스홀더, 툴팁 및 알림/경고창)를 한국어와 영어 간에 즉시 전환할 수 있습니다.
* **설정 영구 저장**: 사용자가 선택한 언어 설정은 로컬 브라우저의 `localStorage` 및 `md_viewer_config.json` 설정 파일에 실시간 저장되어, 앱 재시작 시에도 마지막 설정 상태가 자동으로 완벽하게 복원됩니다.

---

## 🛠️ System Architecture

Joy Markdown Studio는 파이썬 백엔드 데스크톱 셸과 모던 웹 프론트엔드가 하이브리드로 결합된 강력한 구조를 취하고 있습니다.

```{mermaid}
graph TD
    subgraph backend ["Python Backend"]
        A[jmstudio.py Main Entry] --> B[PyWebView Shell]
        A --> C[Bottle Local Server]
        A --> D[Pillow Icon Builder]
    end
    
    subgraph frontend ["UI / Front-end (Local Server & API Bridge)"]
        B <-->|JS API Bridge| E[HTML/Vanilla CSS/JS Client]
        C -->|Serves Resources & Workspace Files| E
        E --> F[Marked.js Markdown Parser]
        E --> G[Prism.js Syntax Highlighter]
        E --> H[KaTeX Math Engine]
        E --> I[SmilesDrawer Molecular Graphics]
        E --> J[Mermaid.js Diagrammer]
    end
    
    subgraph cloud ["Cloud APIs"]
        E -->|GET API Request| K[PubChem PUG REST API]
    end
```

---

## 📂 Project Structure

```
e:\jm_studio\
├── jmstudio.py                  # 메인 실행 파일 (백엔드 서버 및 GUI 셸, 프론트 HTML 소스 포함)
├── compile.bat                  # Windows 단독 실행 파일(.exe) 자동 컴파일용 배치 스크립트 (가상환경 지원)
├── compile.sh                   # macOS 단독 실행 앱(.app) 자동 컴파일용 쉘 스크립트 (가상환경 지원)
├── git_push.bat                 # 원격 깃허브 저장소(jmstudio) 자동 push 배치 스크립트
├── .gitignore                   # 불필요한 빌드 부산물, 임시 캐시 및 설정 제외를 위한 규칙 파일
├── md_viewer_config.json        # 서재 파일 목록, 최근 본 파일, 테마 등 유저 설정 상태 저장 DB
├── app_icon.png                 # 스튜디오 런처 로고 이미지
├── app_icon.ico                 # 윈도우 OS 창 프레임 및 시스템 트레이 바인딩용 다중 사이즈 아이콘
├── document.md                  # 샘플 마크다운 임시 저장소
├── README_kr.md                 # 한국어 도움말 문서 (신규)
├── doc/                         # 학술 및 렌더링 내장 가이드 문서 백업 폴더 (신규)
│   ├── chemical_formula_guide_kr.md
│   ├── chemical_formula_guide_en.md
│   ├── chemistry_encyclopedia_kr.md
│   ├── chemistry_encyclopedia_en.md
│   ├── computer_science_guide_kr.md
│   ├── computer_science_guide_en.md
│   ├── math_science_guide_kr.md
│   ├── math_science_guide_en.md
│   ├── geometry_guide_kr.md
│   ├── geometry_guide_en.md
│   ├── markdown_guide_kr.md
│   ├── markdown_guide_en.md
│   ├── mermaid_guide_kr.md
│   ├── mermaid_guide_en.md
│   ├── flowchart_guide_kr.md
│   └── flowchart_guide_en.md
│
└── [학술 및 렌더링 내장 가이드 문서 (영문판)]
    ├── chemical_formula_guide.md # 화학 분자식 (SMILES) 렌더링 및 사용 가이드 (영문)
    ├── chemistry_encyclopedia.md # 주요 화합물의 백과사전식 SMILES 데이터베이스 (영문)
    ├── computer_science_guide.md # 전산/컴퓨터 공학용 마크다운, 다이어그램, 복잡도 수식 가이드 (영문)
    ├── math_science_guide.md     # KaTeX 수식 및 수학/물리/화학 기호 작성 안내서 (영문)
    ├── geometry_guide.md         # 이공계 기하 도형 및 물리 다이어그램 작도 가이드 (영문)
    ├── markdown_guide.md         # 기본적인 마크다운 문법 및 스타일 가이드 (영문)
    ├── mermaid_guide.md          # Mermaid 다이어그램 및 시각화 작성 안내서 (영문)
    └── flowchart_guide.md        # 순서도 및 차트 작성 세부 가이드 (영문)
```

---

## 🚀 Getting Started (시작하기)

### 📋 요구 사항 (Prerequisites)
이 프로그램을 실행하거나 독립 패키지로 빌드하기 위해서는 아래의 환경이 권장됩니다.
* **Python**: Python 3.10 이상 (Windows 빌드 스크립트는 기본적으로 `C:\Python\Python313\python.exe` 및 시스템 PATH의 `python` 명령어를 감지합니다.)
* **의존성 라이브러리**:
  * `pywebview`: 데스크톱 앱 GUI 프레임 윈도우 생성
  * `bottle`: 로컬 경량 웹 서버 구동 및 리소스 라우팅
  * `Pillow` (PIL): PNG 앱 아이콘을 다중 해상도 Windows `.ico` 포맷으로 자동 변환
  * `pyinstaller`: 독립형 단일 실행기 컴파일 (빌드 시 필수)

### 💻 설치 및 실행 (Installation & Run)

#### 방법 1: 일반 시스템 환경에서 실행 및 빌드 라이브러리 설치
1. **필수 라이브러리 설치**:
   ```bash
   pip install pywebview bottle Pillow
   # 빌드 작업까지 병행하는 경우
   pip install pyinstaller
   ```

2. **애플리케이션 실행**:
   ```bash
   python jmstudio.py
   ```

#### 방법 2: 가상환경(venv)을 생성하여 독립적으로 실행 (권장)
로컬 가상환경을 사용하면 시스템 환경 오염 없이 안전하게 테스트하고, `compile.bat`/`compile.sh` 스크립트를 통한 독립 빌드 시에도 가상환경 내 패키지를 활용하므로 더욱 깔끔합니다.

1. **가상환경 생성 및 활성화**:
   * **Windows (PowerShell)**:
     ```powershell
     python -m venv .venv
     .venv\Scripts\activate
     ```
   * **macOS / Linux (Terminal)**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

2. **가상환경 의존성 설치 및 실행**:
   ```bash
   pip install --upgrade pip
   pip install pywebview bottle Pillow pyinstaller
   python jmstudio.py
   ```
   * *참고: 앱 실행 시 프로젝트 루트에 `app_icon.png`가 있으면 Windows GUI 바인딩용 다중 해상도 `app_icon.ico` 파일이 자동 생성됩니다.*


### 📦 단독 실행 파일로 배포하기 (Compilation)
외부 다른 PC에서 별도의 Python이나 라이브러리를 설치하지 않고 **Joy Markdown Studio**를 즉시 실행할 수 있는 독립 패키지(실행 파일)로 컴파일하는 방법입니다.

> [!TIP]
> **가상환경(.venv) 자동 감지 지원**
> * 빌드 스크립트는 프로젝트 루트 폴더에 `.venv` 가상환경이 존재할 경우, 시스템 글로벌 Python 대신 가상환경 내의 Python 실행 파일(`.venv/Scripts/python.exe` 또는 `.venv/bin/python`)을 **우선적으로 감지하여 빌드에 사용**합니다.
> * 이를 통해 시스템 환경 오염 없이 독립적인 종속성 하에서 깔끔한 빌드가 가능합니다.

#### 🪟 Windows 환경에서 빌드 (.exe)
1. **원클릭 컴파일 스크립트 실행**:
   * 폴더 내에 생성된 [compile.bat](file:///e:/jm_studio/compile.bat) 파일을 **더블 클릭**하여 실행하거나 터미널 환경에 맞춰 다음 명령을 수행합니다.
     * **PowerShell (기본 터미널)**:
       ```powershell
       .\compile.bat
       ```
     * **Command Prompt (CMD)**:
       ```cmd
       compile.bat
       ```
   * 이 스크립트는 내부적으로 가상환경(존재 시) 혹은 시스템 Python의 `PyInstaller`를 자동 설치/업데이트한 뒤 `jmstudio.py`를 버전이 포함된 단일 EXE 파일(`JoyMarkdownStudio-vX.XX.exe`)로 빌드합니다.

2. **실행 파일 복사 및 배포**:
   * 컴파일이 성공적으로 종료되면 `.\dist\` 폴더가 생성됩니다.
   * `dist` 폴더 안에 빌드된 **`JoyMarkdownStudio-vX.XX.exe`** 파일만 복사하여 다른 Windows PC로 가져가면 더블클릭만으로 언제 어디서든 바로 구동됩니다.
   * *참고: 무겁고 복잡한 디펜던시가 단일 실행 파일에 정밀 압축되어 담기므로, 최초 기동 시 압축 해제를 위해 약간의 로딩(3~5초)이 필요할 수 있습니다.*

#### 🍎 macOS 환경에서 빌드 (.app)
> [!IMPORTANT]
> PyInstaller는 크로스 컴파일(Cross-compilation)을 지원하지 않습니다. macOS 용 앱 패키지를 만들려면 **반드시 macOS 컴퓨터 환경에서 빌드를 수행**해야 합니다. (Windows에서는 Mac 용 실행 파일을 만들 수 없습니다.)

1. **Mac 터미널에서 컴파일 스크립트 실행**:
   * 소스코드 폴더를 Mac PC로 복사한 후, Mac 터미널을 열고 해당 폴더로 이동합니다.
   * 아래 명령어를 차례로 입력하여 빌드 스크립트 [compile.sh](file:///e:/jm_studio/compile.sh)에 실행 권한을 부여하고 실행합니다:
     ```bash
     chmod +x compile.sh
     ./compile.sh
     ```
   * 스크립트가 가상환경(존재 시) 혹은 macOS 시스템 Python을 사용해 필요한 라이브러리를 설치한 뒤, `dist/` 폴더 내에 단독 실행 가능한 macOS 앱 번들인 **`JoyMarkdownStudio-vX.XX.app`** 폴더를 생성합니다.

2. **앱 패키지 배포**:
   * 생성된 `JoyMarkdownStudio-vX.XX.app` 폴더를 **우클릭하여 압축(Zip)**한 후 배포합니다.
   * *참고: Apple Developer 계정으로 정식 서명된 앱이 아니므로, 다른 Mac 기기에서 처음 실행할 때는 **마우스 우클릭 -> 열기(Open)**를 선택하고 열기 버튼을 클릭하여 Gatekeeper 보안 경고를 우회해 주어야 구동됩니다.*

---

## 💡 주요 마크다운 활용 팁

### 🧪 1. 화학 분자식 그리기
코드 블록에 `smiles` 지정 후 SMILES 분자 문자열을 적어주기만 하면 시각화가 완료됩니다.
```markdown
```smiles
OC(=O)/C=C/c1ccc(O)c(O)c1
```
```
*실시간 미리보기 화면에서 위 코드는 아름다운 **카페산 (Caffeic acid)** 분자 구조로 변환됩니다.*

### 📐 2. 수식 입력하기
이공계 필수 수식은 단락 수식(`$$`) 또는 인라인 수식(`$`) 형태로 직접 기입하거나 좌측 수식 도우미 탭에서 클릭 한 번으로 간편하게 완성하십시오.
```markdown
질량과 에너지는 등가성을 가지며 아래의 공식으로 표현됩니다: $E = mc^2$

$$i\hbar\frac{\partial}{\partial t}\Psi = \hat{H}\Psi$$
```

### 📊 3. 다이어그램 삽입하기
`mermaid` 지시자를 통해 비즈니스 흐름도나 아키텍처 다이어그램을 쉽게 삽입할 수 있습니다.
```markdown
```mermaid
graph LR
    A[아이디어] --> B(수식 검증)
    B --> C{화학식 탐색}
    C -->|성공| D[문서 완성]
    C -->|실패| B
```
```

---

## ⚙️ Configuration (설정 관리)
프로그램 실행 경로에 생성되는 `md_viewer_config.json`을 통해 프로그램의 상태가 영구 보존됩니다.
```json
{
    "theme": "dark",
    "last_file": "chemical_formula_guide.md",
    "last_workspace": "e:\\jm_studio",
    "port": 58220,
    "bind_ip": "0.0.0.0",
    "access_password": "your_secure_password",
    "added_documents": [
        "chemical_formula_guide.md",
        "chemistry_encyclopedia.md",
        "document.md",
        "flowchart_guide.md",
        "markdown_guide.md",
        "math_science_guide.md",
        "mermaid_guide.md"
    ]
}
```
* **theme**: `dark` 또는 `light`
* **last_file**: 최종 작업 중이던 마크다운 파일 경로 (자동 복원)
* **last_workspace**: 앱 기동 시 지정된 최신 물리적 서재 디렉터리 경로
* **port**: 외부 접속 서비스 포트 번호 (기본값: `58220`)
* **bind_ip**: 호스트 바인딩 주소 (`0.0.0.0`: 모든 접속 허용, `127.0.0.1`: 로컬 호스트만 허용)
* **access_password**: 외부 웹 브라우저에서 접속 시 입력해야 할 보안 비밀번호 (공백 시 로그인 없음)
* **added_documents**: 사용자의 소중한 서재 데이터베이스 리스트

---

## 🔒 Security & Optimization
* **보안 경로 검사**: `serve_workspace_file` 라우터에 물리 경로 유효성 검사를 탑재하여 지정된 Active Workspace의 외부 시스템 파일로의 불법 접근(Directory Traversal 공격)을 완벽하게 예방합니다.
* **디바운스 실시간 렌더링**: 에디터에 타이핑 시 Mermaid와 KaTeX의 불필요한 연속 렌더링으로 인한 화면 버벅임을 방지하기 위해 지능적인 디바운스 타이머가 적용되어 쾌적한 실시간 반응성을 자랑합니다.

---
**Joy Markdown Studio**와 함께 스마트하고 매끄러운 연구 및 문서 작성 여정을 시작해 보세요! 🚀
