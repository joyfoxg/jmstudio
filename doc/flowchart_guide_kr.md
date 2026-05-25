# 📊 Mermaid 플로우차트(Flowchart) 상세 가이드

플로우차트(Flowchart)는 업무 흐름도, 시스템 데이터 흐름, 비즈니스 로직 설계 등 소프트웨어 엔지니어링에서 **가장 널리 쓰이는 시각화 다이어그램**입니다.
본 가이드는 다양한 플로우차트의 레이아웃 방향, 노드 도형(Shape), 연결선 종류, 스타일 기법을 종합하여 설명합니다.

> [!TIP]
> 대형 플로우차트의 경우, 글씨가 작아 보인다면 마우스를 올린 후 **`[🔍 원본 크기]`** 토글을 클릭하여 가로 스크롤로 읽거나 **`[🖥️ 전체화면]`**을 클릭하여 큰 화면으로 볼 수 있습니다.

---

## 1. 레이아웃 방향 (Directions)

플로우차트가 펼쳐지는 기준 방향을 코드 첫 줄에 선언할 수 있습니다.

* **`TB` (Top to Bottom)** 또는 **`TD` (Top Down)**: 위에서 아래로 흐름 (기본값)
* **`BT` (Bottom to Top)**: 아래에서 위로 흐름
* **`LR` (Left to Right)**: 왼쪽에서 오른쪽으로 흐름 (가로로 긴 설계에 추천)
* **`RL` (Right to Left)**: 오른쪽에서 왼쪽으로 흐름

### A. 가로형 레이아웃 예시 (`LR`)
```{mermaid}
flowchart LR
    A[시작] --> B{데이터 검사}
    B -- 통과 --> C[DB 저장]
    B -- 실패 --> D[에러 페이지]
```

### B. 세로형 레이아웃 예시 (`TB`)
```{mermaid}
flowchart TB
    Start[기획서 수립] --> Design[화면 UI 설계]
    Design --> Develop[백엔드/프론트 개발]
    Develop --> QA[품질 검증 테스트]
    QA --> Release[프로덕션 배포]
```

---

## 2. 노드 도형 스타일 (Node Shapes)

노드를 감싸는 괄호 종류에 따라 사각형, 원형, 마름모, 실린더 등 다양한 특수 기호를 묘사할 수 있습니다.

| 도형 형태 | 문법 구조 | 실제 렌더링 예시 | 용도 |
| :--- | :--- | :---: | :--- |
| **기본 사각형** | `id[텍스트]` | `A[사각형]` | 일반적인 처리 단계 |
| **둥근 모서리 사각형** | `id(텍스트)` | `B(둥근 사각형)` | 시작점 및 끝점 |
| **스타디움형 (타원)** | `id([텍스트])` | `C([타원형])` | 시작/종료 캡슐 |
| **서브루틴 양방향 바** | `id[[텍스트]]` | `D[[서브루틴]]` | 다른 정의된 별도 모듈 |
| **원기둥 (데이터베이스)** | `id[(텍스트)]` | `E[(데이터베이스)]` | 데이터 스토리지, RDBMS |
| **원형 (Circle)** | `id((텍스트))` | `F((원형))` | 시작 플래그, 연결자 |
| **깃발 모양** | `id>텍스트]` | `G>깃발형]` | 이벤트, 비대칭 정보 |
| **마름모 (의사 결정)** | `id{텍스트}` | `H{의사결정}` | 조건문, 분기 처리 |

```{mermaid}
flowchart LR
    node1([원형 캡슐]) --> node2[[서브 루틴]]
    node2 --> node3[(Oracle DB)]
    node3 --> node4{분기 검사}
    node4 -- YES --> node5((성공))
    node4 -- NO --> node6>에러 발생]
```

---

## 3. 연결선과 라벨 스타일 (Lines & Labels)

노드 간을 이어주는 링크 스타일 및 링크 위에 올릴 글씨(라벨)를 풍부하게 작성할 수 있습니다.

* **일반 화살표**: `-->`
* **링크 위 텍스트 라벨**: `-->|라벨|` 또는 `-- 라벨 -->`
* **화살표 없는 선**: `---`
* **점선 화살표**: `-.->` 또는 `-. 라벨 .->`
* **굵은 화살표**: `==>` 또는 `== 라벨 ==>`
* **다중 화살표**: `<-->`

```{mermaid}
flowchart LR
    A[사용자] ==>|강력한 호출| B[백엔드 API]
    B ---|순수한 물리 선| C[하드웨어 센서]
    B -.->|비동기 점선 이벤트| D[푸시 알림 서버]
    B <-->|양방향 동기화| E[Redis 세션 캐시]
```

---

## 4. 서브그래프 그룹화 (Subgraphs)

큰 흐름 속에서 논리적 구역(예: 클라이언트단, 백엔드단, 외부 인프라단)을 상자 형태로 묶어서 표현합니다.

```{mermaid}
flowchart TB
    subgraph Client [사용자 브라우저]
        UI[에디터 UI] -->|Ctrl+S| SaveHandler[저장 핸들러]
    end

    subgraph Server [Bottle 파이썬 서버]
        SaveHandler -->|POST /save| Route[라우팅 함수]
        Route -->|데이터 가공| SaveApi[MdViewerApi.save_file]
    end

    subgraph Storage [로컬 디스크 저장소]
        SaveApi -->|Write to Disk| Disk[OS 파일 시스템]
    end
    
    %% 서브그래프 스타일 커스터마이징
    style Client fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#ffffff
    style Server fill:#0b132b,stroke:#10b981,stroke-width:2px,color:#ffffff
    style Storage fill:#1c1d22,stroke:#f59e0b,stroke-width:2px,color:#ffffff
```

---

## 5. 노드 스타일 및 하이라이트 (Custom Styling)

특정 노드의 배경색, 테두리 색상, 두께를 개별 지정하여 중요한 핫스팟 노드를 강조합니다.

* **스타일 지정 문법**: `style [노드ID] fill:[배경색],stroke:[테두리색],stroke-width:[두께],color:[글씨색]`
* **CSS 컬러 코드**(예: `#ff0000`, `rgb(...)`) 및 **영문 컬러명** 모두 지원합니다.

```{mermaid}
flowchart LR
    Normal["일반 노드"] --> Target["★ 핵심 강조 노드 ★"]
    Target --> Complete["최종 완료"]
    
    %% 노드 스타일 커스텀
    style Target fill:#ff4757,stroke:#ff6b81,stroke-width:3px,color:#ffffff,stroke-dasharray: 5 5
    style Complete fill:#2ed573,stroke:#2bcbba,stroke-width:2px,color:#ffffff
```

---

플로우차트는 시스템의 설계 변경이 발생했을 때 유지보수 비용을 엄청나게 절감해 줍니다. 
위 양식을 활용하여 나만의 고유한 파이프라인이나 로직 흐름도를 미려하게 디자인해 보세요! 🚀
