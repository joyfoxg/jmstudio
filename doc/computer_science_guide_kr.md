# 💻 전산 및 컴퓨터 과학 (Computer Science) 마크다운 활용 가이드

Joy Markdown Studio는 프로그래밍 소스 코드 강조, 시스템 아키텍처 다이어그램 설계, 알고리즘 시간 복잡도(Big-O) 수식 기술 등 컴퓨터 과학 및 IT 실무 분야에 필요한 최고의 마크다운 렌더링 스펙을 지원합니다.

본 가이드를 통해 전산 분야에서 자주 활용되는 마크다운 기법들을 직접 편집하고 감상해 보세요!

---

## ⌨️ 1. 단축키 및 인라인 코드 표현
컴퓨터 공학 문서에서는 설정값, 명령어, 단축키를 명확히 구분해야 합니다.

* **인라인 코드**: 텍스트 사이에 기입하는 단일 백틱(`` ` ``)을 사용합니다.
  * 예: 로컬 저장소를 초기화하려면 `git init` 명령어를 입력하세요. `main()` 함수는 프로그램의 시작점입니다.
* **키보드 단축키**: HTML `<kbd>` 태그를 이용해 실제 키보드 단추 모양을 연출합니다.
  * 예: 문서를 저장하려면 <kbd>Ctrl</kbd> + <kbd>S</kbd>를 누르시고, 되돌리려면 <kbd>Ctrl</kbd> + <kbd>Z</kbd>를 누르세요.

---

## 📐 2. 알고리즘 및 인공지능 수학 공식 (KaTeX)
컴퓨터 과학의 시간 복잡도 표현(Big-O), 확률론, 인공지능 신경망 수식 작성을 지원합니다.

### A. 알고리즘 시간 복잡도 (Big-O Notation)
* 퀵 정렬(Quick Sort)의 평균 시간 복잡도: $\mathcal{O}(N \log N)$
* 행렬 곱셈 알고리즘의 시간 복잡도: $\mathcal{O}(N^3)$

### B. 인공지능 활성화 함수 (Neural Network Activation)
시그모이드(Sigmoid) 함수 식은 다음과 같이 정의됩니다:

$$\sigma(z) = \frac{1}{1 + e^{-z}}$$

---

## 💻 3. 프로그래밍 소스 코드 강조 (Syntax Highlighting)
코드 블록 언어 지정 시 키워드, 함수, 인수가 문맥에 맞게 구문 강조됩니다.

```python
def fibonacci(n):
    """피보나치 수열을 제너레이터 형태로 생성합니다."""
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

# 10번째 항까지 출력
for num in fibonacci(10):
    print(num, end=" ")
```

```sql
-- 데이터베이스 사용자 정보 조회 쿼리
SELECT user_id, username, email, created_at 
FROM users 
WHERE status = 'ACTIVE' 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 📊 4. 시스템 설계 및 아키텍처 다이어그램 (Mermaid)

텍스트로 작성하면 그래픽으로 자동 드로잉되며, 더블 클릭하면 **전체화면 줌**을 통해 거대한 설계도도 고해상도로 볼 수 있습니다!

### A. 데이터베이스 설계 (Entity Relationship Diagram - ERD)
데이터베이스의 테이블 구조와 기본키(PK)/외래키(FK) 릴레이션을 직관적으로 매핑합니다.

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER {
        string id PK
        string name
        string email
    }
    ORDER {
        int id PK
        string customer_id FK
        date order_date
    }
    LINE-ITEM {
        int id PK
        int order_id FK
        string product_name
        int quantity
        float price
    }
```

### B. 클라이언트-서버 API 요청 (Sequence Diagram)
웹/앱 서비스에서 발생하는 비동기 API 트랜잭션 흐름을 시각화합니다.

```mermaid
sequenceDiagram
    autonumber
    actor Client as 웹 브라우저
    participant Proxy as 리버스 프록시 (Nginx)
    participant Server as Bottle 서버 (Python)
    participant DB as 설정 DB (SQLite)

    Client->>Proxy: GET /workspace/document.md
    Proxy->>Server: 요청 포워딩
    Server->>DB: 사용자 서재 파일 조회
    DB-->>Server: 파일 물리 경로 반환
    Server-->>Proxy: HTML 및 마크다운 리소스 전송
    Proxy-->>Client: 200 OK 렌더링 완료
```

### C. 형상 관리 흐름 (Git Graph)
개발팀의 브랜치 병합 및 배포 히스토리를 깃 그래프로 모델링합니다.

```mermaid
gitGraph
    commit id: "Initial Commit"
    commit id: "Set App Name"
    branch develop
    checkout develop
    commit id: "Add Library Tree"
    commit id: "Add KaTeX Panel"
    checkout main
    merge develop tag: "v3.0-stable"
    checkout develop
    branch feature-smiles
    checkout feature-smiles
    commit id: "PubChem API search"
    commit id: "Vector 2D preview"
    checkout develop
    merge feature-smiles
    checkout main
    merge develop tag: "v3.5-release"
```

---

## 💾 5. 데이터베이스 트랜잭션 흐름 & 챠트 시각화 예제

데이터베이스 동기화, 이중화 아키텍처 흐름 및 운영 통계 챠트를 마크다운 상에서 작성하는 예제입니다.

### A. 데이터베이스 트랜잭션 & 실시간 복제(Replication) 흐름도
사용자 요청에 따른 마스터 DB 기록, WAL(Write Ahead Log) 저장, 슬레이브 DB 복제 및 Redis 캐시 갱신 등의 마이크로서비스 흐름을 시각화합니다.

```mermaid
flowchart TD
    classDef database fill:#1a1c23,stroke:#45f3ff,stroke-width:2px,color:#fff;
    classDef server fill:#14161e,stroke:#ad5389,stroke-width:2px,color:#fff;
    classDef process fill:#0d0e12,stroke:#50fa7b,stroke-width:1px,color:#fff;
    
    User([사용자 요청]) -->|1. 주문 생성 API| API[API 웹 서버]:::server
    API -->|2. 트랜잭션 시작| Tx[Transaction Manager]:::process
    
    subgraph Primary Database [메인 쓰기용 데이터베이스]
        Tx -->|3. 주문 레코드 쓰기| MasterDB[(Master DB)]:::database
        MasterDB -->|4. 로그 기록| WAL{Write Ahead Log}:::process
    end
    
    Tx -->|5. 커밋 여부 확인| Commit{성공 여부}:::process
    Commit -->|성공| Success[성공 완료]:::process
    Commit -->|실패| Rollback[Rollback 실행]:::process
    
    subgraph Read Replicas [읽기 전용 데이터베이스 복제]
        WAL -->|6. 비동기식 CDC 복제| SlaveDB[(Slave DB)]:::database
    end
    
    Success -->|7. 캐시 갱신| Cache[(Redis Cache)]:::database
    Cache -.->|데이터 캐시 조회| API
    SlaveDB -.->|조회용 쿼리 처리| API
```

### B. 데이터베이스 스토리지 공간 배분 (원형 챠트 - Pie Chart)
DB 테이블 용량 할당 및 보존율을 한눈에 표시하는 챠트입니다.

```mermaid
pie title 데이터베이스 테이블별 용량 점유율 (%)
    "결제 및 주문 이력 (Transaction)" : 45.8
    "애플리케이션 접속 로그 (Audit Log)" : 28.2
    "사용자 프로필 데이터 (Customer)" : 12.5
    "첨부파일 바이너리 경로 (S3 Path)" : 10.0
    "시스템 설정 및 공통 코드 (Common)" : 3.5
```

### C. 데이터베이스 마이그레이션 일정 (간트 챠트 - Gantt Chart)
전산 프로젝트 일정 관리에 필수적인 간트 챠트도 손쉽게 작성 가능합니다.

```mermaid
gantt
    title 데이터베이스 클라우드 이관 프로젝트 일정
    dateFormat  YYYY-MM-DD
    section 요구사항 분석
        DB 스키마 구조 분석      :active, des1, 2026-05-01, 2026-05-05
        이관 전략 및 시나리오 수립 : des2, 2026-05-06, 2026-05-08
    section 데이터 이관 개발
        CDC 동기화 파이프라인 설계 : des3, 2026-05-09, 2026-05-15
        데이터 정합성 검증 코드 작성: des4, 2026-05-16, 2026-05-20
    section 실환경 마이그레이션
        Staging 모의 훈련 테스트  :active, des5, 2026-05-21, 2026-05-25
        Production DB 최종 이관  : des6, 2026-05-26, 2026-05-28
```

---

## 📝 6. 협업 및 태스크 관리 (Task List)
프로젝트 기능 개발 현황이나 요구사항 대조표로 활용됩니다.

- [x] **스프린트 1**: 마크다운 기본 파서 기능 개발
- [x] **스프린트 2**: KaTeX 수식 및 이공계 수식 도우미 연동
- [x] **스프린트 3**: PubChem OpenAPI 연동 및 2D Smiles 뷰어 탑재
- [ ] **스프린트 4**: 마크다운 PDF 변환 엔진 추가 설계
- [ ] **스프린트 5**: 다중 워크스페이스 동시 활성화 지원

---
**Joy Markdown Studio**는 전산 및 컴퓨터 공학 연구 문서를 쉽고 아름답게 관리할 수 있도록 끊임없이 진화하고 있습니다! 💻🚀
