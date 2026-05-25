# 📐 이공계 기하 도형 및 물화 물리 다이어그램 작도 가이드

> **이공계 학술 문서의 시각적 가치 극대화**  
> 본 문서는 Joy Markdown Studio에서 수학 기하 도형, 물리 개념 역학도, 그래프 등을 작성할 때 사용하는 **내장 SVG 벡터 작도법**, **LaTeX 수식 결합법**, 그리고 **외부 전문 도구(GeoGebra, Excalidraw, Draw.io)와의 연동 워크플로우**를 정리한 종합 실무 가이드입니다.

---

## 💡 요약: 어떤 도구를 써야 할까요?

| 용도 | 추천 방식 | 특징 |
| :--- | :--- | :--- |
| **단순 기하 도형 / 그래프** | **내장 SVG 직접 삽입** | 별도 외부 이미지 파일이 필요 없고 고해상도 벡터로 렌더링되며, 텍스트 에디터에서 좌표를 바로 수정 가능 |
| **수식 기호와 결합된 기하 표기** | **LaTeX / KaTeX 기호** | $\triangle ABC$, $\vec{F}$, $\angle\theta$와 같이 텍스트 행간에 조화롭게 삽입 |
| **함수 그래프 및 정밀 기하 작도** | **GeoGebra ➡️ SVG/PNG 내보내기** | 좌표 기하, 2D/3D 함수, 미적분 그래프를 가장 정확하게 그려서 문서에 삽입 |
| **물리 개념 개념도 / 자유물체도** | **Excalidraw ➡️ SVG 내보내기** | 세련된 스케치 스타일로 물리력 지시선, 물체 배치 등을 감성적이고 직관적으로 작도 |
| **회로도 / 실험 장치 블록도** | **Draw.io ➡️ PNG/SVG 내보내기** | 논리 회로, 전기 회로, 실험 장비 블록도를 정밀하게 레이아웃 |

---

## 1. ⚡ 내장 SVG(Inline SVG)를 이용한 작도
마크다운 문서 내에 HTML `<svg>` 태그를 직접 삽입하면 외부 파일 디펜던시 없이 고품질 벡터 그래픽을 그릴 수 있습니다. Joy Markdown Studio의 다크 모드에 어울리는 세련된 네온 및 파스텔톤 컬러셋을 사용하여 작도하는 예제들입니다.

### 📐 예제 1: 수학 - 삼각함수 단원원과 극좌표계
수학에서 자주 사용되는 동경(Radius vector)과 각도 $\theta$를 나타내는 단원원 작도 예제입니다.

```html
<svg width="340" height="340" style="background:#18181b; border:1px solid #27272a; border-radius:12px; display:block; margin:20px auto;">
  <!-- 그리드선 및 좌표축 -->
  <line x1="20" y1="170" x2="320" y2="170" stroke="#3f3f46" stroke-width="1.5" stroke-dasharray="4" />
  <line x1="170" y1="20" x2="170" y2="320" stroke="#3f3f46" stroke-width="1.5" stroke-dasharray="4" />
  <!-- 화살표축 -->
  <path d="M 315,165 L 325,170 L 315,175 Z" fill="#71717a" />
  <path d="M 165,25 L 170,15 L 175,25 Z" fill="#71717a" />
  <text x="325" y="185" fill="#a1a1aa" font-size="11">x</text>
  <text x="180" y="20" fill="#a1a1aa" font-size="11">y</text>
  
  <!-- 원형 (Radius r = 100) -->
  <circle cx="170" cy="170" r="100" fill="none" stroke="#52525b" stroke-width="1.5" />
  
  <!-- 동경 (Line from origin to P) -->
  <line x1="170" y1="170" x2="256.6" y2="120" stroke="#00d2ff" stroke-width="3" stroke-linecap="round" />
  <circle cx="256.6" cy="120" r="5" fill="#00d2ff" />
  
  <!-- 보조선 (P에서 x축으로 내린 수선) -->
  <line x1="256.6" y1="120" x2="256.6" y2="170" stroke="#a855f7" stroke-width="1.5" stroke-dasharray="3" />
  
  <!-- 각도 θ 호(Arc) -->
  <path d="M 210,170 A 40,40 0 0,0 204.6,150" fill="none" stroke="#ff007f" stroke-width="2.5" />
  <text x="215" y="160" fill="#ff007f" font-size="12" font-weight="bold">θ</text>
  
  <!-- 텍스트 라벨 -->
  <text x="155" y="185" fill="#ffffff" font-size="12">O</text>
  <text x="265" y="115" fill="#00d2ff" font-size="12" font-weight="bold">P (cos θ, sin θ)</text>
  <text x="210" y="110" fill="#00d2ff" font-size="11">r = 1</text>
</svg>
```

> [!NOTE]
> 위의 SVG 코드를 에디터에 그대로 붙여넣으면, 우측 미리보기 셸에서 즉시 어두운 배경 위에 사이안(Cyan) 색상의 동경선과 핑크색 각도 기호가 선명하게 빛나는 수학 작도 화면이 렌더링됩니다.

---

### ⚛️ 예제 2: 물리학 - 빗면 위의 물체와 자유물체도(Free-body Diagram)
역학 문제에서 단골로 등장하는 빗면 위의 상자, 중력 분력, 수직항력, 마찰력을 묘사한 벡터 작도 예제입니다.

```html
<svg width="400" height="240" style="background:#18181b; border:1px solid #27272a; border-radius:12px; display:block; margin:20px auto;">
  <!-- 빗면 (삼각형) -->
  <polygon points="50,200 350,200 350,70" fill="none" stroke="#71717a" stroke-width="3" />
  <!-- 각도 표시 -->
  <path d="M 80,200 A 30,30 0 0,0 76.5,187" fill="none" stroke="#ff007f" stroke-width="2" />
  <text x="88" y="195" fill="#ff007f" font-size="12">θ</text>

  <!-- 경사면 각도 계산용 회전 그룹 (경사각: -23.4도) -->
  <g transform="translate(180, 147.5) rotate(-23.4)">
    <!-- 물체 (상자) -->
    <rect x="-30" y="-30" width="60" height="30" fill="rgba(0, 210, 255, 0.15)" stroke="#00d2ff" stroke-width="2.5" rx="3" />
    
    <!-- 중력 벡터 (mg - 수직 아래 방향) -->
    <!-- 회전된 좌표계에서 수직 아래는 rotate(23.4) 기준 방향입니다 -->
    <!-- 여기서는 정밀 표현을 위해 변환을 적용하지 않은 절대 중력 벡터를 아래에 별도 배치하거나 g 밖에서 선언하는 것이 수월할 수 있으나, 변환 내에서 역회전으로 표현해 봅니다. -->
    <line x1="0" y1="-15" x2="39.6" y2="78" stroke="#ef4444" stroke-width="2.5" stroke-dasharray="1" /> <!-- 연장선 -->
    <line x1="0" y1="-15" x2="23.8" y2="40.8" stroke="#ef4444" stroke-width="3" marker-end="url(#arrow-red)" />
    
    <!-- 수직항력 벡터 (N - 빗면에 수직한 위 방향) -->
    <line x1="0" y1="-15" x2="0" y2="-75" stroke="#22c55e" stroke-width="3" />
    <polygon points="0,-75 -4,-67 4,-67" fill="#22c55e" />
    
    <!-- 마찰력 벡터 (f - 빗면과 평행한 위 방향) -->
    <line x1="-15" y1="0" x2="-65" y2="0" stroke="#eab308" stroke-width="3" />
    <polygon points="-65,0 -57,-4 -57,4" fill="#eab308" />
    
    <!-- 벡터 라벨 -->
    <text x="-5" y="-80" fill="#22c55e" font-size="11" font-weight="bold">N (수직항력)</text>
    <text x="-95" y="5" fill="#eab308" font-size="11" font-weight="bold">f (마찰력)</text>
    <text x="30" y="30" fill="#ef4444" font-size="11" font-weight="bold">F_g = mg</text>
  </g>
</svg>
```

---

## 2. ⚛️ LaTeX / KaTeX 수식 블록 내 기하 표기법
순수 텍스트 행간에 기하 구조를 논할 때는 별도의 그림 없이 수학적 기호만으로 명확히 표현할 수 있습니다.

* **자주 쓰이는 기하학적 매크로 표:**
  * **삼각형**: `$\triangle ABC$` $\rightarrow$ $\triangle ABC$
  * **각도**: `$\angle \theta$` $\rightarrow$ $\angle \theta$
  * **수직**: `$L_1 \perp L_2$` $\rightarrow$ $L_1 \perp L_2$
  * **평행**: `$L_1 \parallel L_2$` $\rightarrow$ $L_1 \parallel L_2$
  * **선분**: `$\overline{AB}$` $\rightarrow$ $\overline{AB}$
  * **호 (Arc)**: `$\widehat{AB}$` $\rightarrow$ $\widehat{AB}$
  * **벡터**: `$\vec{F}$` 또는 `$\overrightarrow{AB}$` $\rightarrow$ $\vec{F}$ / $\overrightarrow{AB}$

---

## 3. 🌐 외부 전문 저작 도구 활용 워크플로우

가장 빠르고 전문적인 시각화가 필요한 경우, 무료 웹 기반 도구에서 도해를 완성한 후 마크다운에 연동하는 기법을 권장합니다.

### 1) GeoGebra (지오지브라) — 수학 그래프/기하 작도 최적화
지오지브라는 수학 함수 그리기, 기하학적 대칭/교점 찾기 등에 최적화되어 있습니다.

1. **지오지브라 기하창**([geogebra.org/geometry](https://www.geogebra.org/geometry))에 접속합니다.
2. 원하는 도형을 작도하거나 입력창에 수식(예: `f(x) = sin(x) + 0.5x`)을 입력합니다.
3. 우측 상단 메뉴에서 **[내보내기] ➡️ [이미지 (.png 또는 .svg)]**를 선택합니다.
   * *Tip: 해상도가 깨지지 않는 선명한 삽입을 위해 **SVG 포맷**을 강력 추천합니다.*
4. 프로젝트 폴더 하위에 `images/` 폴더를 생성하고 이미지를 저장합니다 (예: `images/sine_graph.svg`).
5. 마크다운 에디터에 아래 링크 형식으로 삽입합니다:
   ```markdown
   ![삼각함수 그래프](images/sine_graph.svg)
   ```

### 2) Excalidraw (엑스칼리드로우) — 세련된 손그림 물리 개념도
칠판에 크레파스로 그린 듯한 트렌디하고 감성적인 다이어그램을 손쉽게 그릴 수 있는 도구입니다.

1. [excalidraw.com](https://excalidraw.com)에 접속합니다.
2. 사각형, 원, 자유곡선 및 텍스트 도구를 활용하여 실험 개요도나 힘의 작용점을 작도합니다.
3. 좌측 상단의 **[Export image]** 메뉴를 선택합니다.
4. 옵션 설정:
   * **Format**: `SVG` (백그라운드 다크 테마 전환 시 텍스트나 투명도가 부드럽게 조정됨)
   * **Theme**: `Dark` (Joy Markdown Studio의 기본 다크 모드와 일치시키려면 다크 테마 출력을 권장)
5. 파일을 `images/physical_diagram.svg`로 저장 후 마크다운에 삽입합니다:
   ```markdown
   ![실험 개요도](images/physical_diagram.svg)
   ```

### 3) Draw.io — 전기 회로도 및 장치 아키텍처
기호 규격이 엄격한 전기 회로도, 화학 실험 파이프라인 흐름도 등을 격자망 위에 칼같이 매핑할 수 있는 툴입니다.

1. [app.diagrams.net](https://app.diagrams.net)에 접속합니다.
2. 좌측 라이브러리 검색창에 `circuit` 등을 입력하여 전기 회로 소자(저항, 커패시터, 전원 등)를 불러옵니다.
3. 소자들을 배치하고 화살표로 결선하여 회로도를 완성합니다.
4. **[파일] ➡️ [내보내기] ➡️ [PNG...]** 또는 **[SVG...]**를 클릭합니다.
   * *Tip: 내보낼 때 `배경 투명화(Transparent)` 옵션을 체크하면 앱의 다크 모드/라이트 모드 배경에 상관없이 경계선이 깔끔하게 녹아듭니다.*
5. 이미지 폴더에 저장 후 링크합니다:
   ```markdown
   ![RCL 직렬 회로도](images/rcl_circuit.png)
   ```

---

## 🔒 팁: 디렉터리 경로 관리 시 유의사항
* 외부 이미지 삽입 시 상대 경로(`images/photo.png`)를 사용하면, 현재 작성 중인 마크다운 파일의 위치를 기준으로 폴더가 탐색됩니다.
* 다른 컴퓨터나 시스템에서도 이미지가 깨지지 않고 보이도록 하기 위해, 프로젝트 workspace 루트 폴더 하위에 **`images/`** 디렉터리를 하나 개설한 후 관련 드로잉 파일들을 그곳에 몰아서 보관하는 구조를 가장 권장합니다.
