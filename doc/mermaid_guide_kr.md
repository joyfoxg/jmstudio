# 🧜‍♀️ Mermaid 종합 다이어그램 가이드

본 문서는 **Antigravity Markdown & Quarto Studio**에서 실시간 렌더링을 지원하는 **Mermaid 다이어그램 종합 설명서**입니다.
다양한 다이어그램 문법을 참조하여 화려한 기술 설계서를 작성해 보세요!

> [!TIP]
> Quarto 규격 표준을 준수하기 위해 코드 블록 시작 시 ` ```{mermaid} ` 형식을 사용하시면 스튜디오가 실시간으로 보정하여 완벽하게 화면에 그려냅니다!
> 다이어그램 카드 영역에 마우스를 올리면 **`[🔍 원본 크기]`** 토글과 **`[🖥️ 전체화면]`** 기능이 활성화됩니다.

---

## 1. 시퀀스 다이어그램 (Sequence Diagram)

시스템 객체 간의 주고받는 메시지 흐름과 상호작용 순서를 시각화하는 다이어그램입니다.

```{mermaid}
sequenceDiagram
    autonumber
    actor User as 사용자 (브라우저)
    participant Web as Bottle 웹서버
    participant API as pywebview 백엔드
    participant Disk as 로컬 파일 시스템

    User->>Web: / Route 웹 리소스 요청
    Web-->>User: index.html (프론트엔드) 반환
    User->>API: 텍스트 변경 사항 저장 (save_file)
    API->>Disk: utf-8 인코딩 파일 쓰기 실행
    Disk-->>API: 쓰기 완료 콜백
    API-->>User: {"status": "success"} JSON 응답
    Note over User, API: 화면에 "성공적으로 저장되었습니다" 토스트 알림!
```

---

## 2. 간트 차트 (Gantt Chart)

프로젝트 일정과 타임라인 관리, 작업 간 병렬/순차 진행 과정을 아름답게 시각화합니다.

```{mermaid}
gantt
    title Antigravity Studio 개발 프로젝트 로드맵
    dateFormat  YYYY-MM-DD
    section 디자인 및 기획
    UI/UX 프리미엄 레이아웃 설계       :active, p1, 2026-05-10, 4d
    단독형 뷰어 아키텍처 수립          :after p1, 3d
    section 핵심 기능 구현
    Bottle 서버 및 파일 CRUD 인터페이스 :active, d1, 2026-05-14, 2026-05-16
    Mermaid 클래서 보정기 도입          :crit, d2, 2026-05-16, 1d
    section 편의 기능 고도화
    원본 크기 & F11 전체화면 뷰어 추가   :active, h1, 2026-05-17, 1d
    글로벌 Ctrl+S 및 Undo/Redo 엔진 연동:active, h2, 2026-05-17, 1d
```

---

## 3. 클래스 다이어그램 (Class Diagram)

객체 지향 프로그래밍의 클래스 구조와 속성, 상속 및 연관 관계를 모델링합니다.

```{mermaid}
classDiagram
    class UndoManager {
        +Object textarea
        +Array history
        +Number currentIndex
        +Number maxHistory
        +Boolean isUndoRedoAction
        +saveState()
        +undo() Boolean
        +redo() Boolean
        +restoreState()
    }
    
    class WebViewerApp {
        +String active_workspace
        +Number PORT
        +run_server()
        +list_files() Array
        +read_file(path) String
        +save_file(path, content)
    }

    class DocumentPreview {
        +HTMLElement container
        +HTMLElement previewPane
        +triggerLiveRender()
        +toggleDocumentFullscreen()
    }

    WebViewerApp --> DocumentPreview : 렌더링 브릿지
    DocumentPreview *-- UndoManager : 상태 스냅샷 관리
```

---

## 4. 상태 다이어그램 (State Diagram)

시스템이나 객체의 시간에 따른 상태 변화와 천이 흐름을 묘사합니다.

```{mermaid}
stateDiagram-v2
    [*] --> Idle : 앱 실행
    Idle --> Loading : 파일 더블클릭
    Loading --> Editing : 로드 성공
    Loading --> ErrorState : 파일 읽기 실패
    
    ErrorState --> Idle : 닫기 또는 재시도
    
    state Editing {
        [*] --> TextModified : 타이핑 입력
        TextModified --> DebounceWaiting : 300ms 디바운스 대기
        DebounceWaiting --> Rendered : KaTeX/Mermaid 파싱 완료
        Rendered --> [*] : 저장 / 대기
    }
    
    Editing --> FullscreenMode : F11 / 더블클릭
    FullscreenMode --> Editing : Esc / 더블클릭
    Editing --> [*] : 앱 종료
```

---

## 5. ER 다이어그램 (Entity Relationship Diagram)

데이터베이스 테이블 간의 구조적 결합도와 1:N, N:M 관계를 정의합니다.

```{mermaid}
erDiagram
    WORKSPACE ||--o{ DOCUMENT : "contains"
    DOCUMENT ||--o{ BACKUP_HISTORY : "tracks"
    WORKSPACE {
        string folder_path PK
        string theme_setting
        string last_active_file
    }
    DOCUMENT {
        string relative_path PK
        string file_name
        number file_size
        date last_modified
    }
    BACKUP_HISTORY {
        number version_id PK
        string file_content
        date snapshot_time
    }
```

---

## 6. 원형 파이 차트 (Pie Chart)

비율과 기여도, 점유율 데이터를 직관적인 슬라이스 그래픽으로 원형 시각화합니다.

```{mermaid}
pie title 문서 편집기 개발 리소스 사용 비중
    "UI 스타일링 및 CSS 고도화" : 25
    "Mermaid 및 LaTeX 파싱 튜닝" : 30
    "Undo/Redo 및 단축키 인터랙션" : 25
    "Bottle 백엔드 프록시 서버 연동" : 20
```

---

Mermaid 문법은 텍스트 몇 줄만으로 복잡하고 깨끗한 그래픽을 오차 없이 완벽하게 작성할 수 있도록 돕습니다. 
각 차트 형식의 뼈대를 가져와 여러분의 프로젝트 분석 설계서에 적극적으로 적용해 보세요! 🎨
