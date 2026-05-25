# 🎨 Antigravity Markdown 종합 가이드

본 문서는 **Antigravity Markdown & Quarto Studio**에서 완벽하게 지원하는 마크다운(Markdown) 문법 설명서입니다. 
좌측의 편집기에서 문법을 수정해보고, 우측 실시간 렌더러와 전체화면 모드(`더블클릭`)를 활용하여 그 결과를 확인해보세요!

---

## 1. 텍스트 스타일링 (Text Styling)

가장 기초적인 텍스트 강조 표현입니다.

* **굵은 글씨 (Bold)**: `**텍스트**` 또는 `__텍스트__` -> **중요한 내용 강조**
* *기울임 (Italic)*: `*텍스트*` 또는 `_텍스트_` -> *부드러운 기울임 강조*
* ~~취소선 (Strikethrough)~~: `~~텍스트~~` -> ~~이 내용은 수정되었습니다.~~
* `인라인 코드 (Inline Code)`: `` `code` `` -> 변수명 `currentFilePath` 또는 함수 `saveActiveFile()` 표현 시 사용

---

## 2. 제목 및 헤더 구조 (Headers)

문서의 구조를 잡는 헤더입니다. 헤더를 작성하면 우측의 **TOC(목차) 패널**에 실시간 아웃라인이 자동 생성되어 편리하게 점프할 수 있습니다.

# 1단계 제목 (H1) - `# H1`
## 2단계 제목 (H2) - `## H2`
### 3단계 제목 (H3) - `### H3`
#### 4단계 제목 (H4) - `#### H4`

---

## 3. 리스트 및 인용구 (Lists & Blockquotes)

### 정렬되지 않은 목록 (Unordered List)
* 아이템 1 (`*` 또는 `-` 또는 `+` 사용)
  * 서브 아이템 1.1 (앞에 스페이스 2칸 들여쓰기)
  * 서브 아이템 1.2
* 아이템 2

### 정렬된 목록 (Ordered List)
1. 첫 번째 작업 (`1. ` 입력)
2. 두 번째 작업
3. 세 번째 작업

### 인용구 (Blockquotes)
> **이것은 인용 상자입니다.**
> 중요한 격언이나 참고 자료를 인용할 때 사용하며, 여러 줄에 걸쳐서 표현할 수 있습니다.
>> 중첩 인용도 깔끔하게 지원됩니다!

---

## 4. 초강력 콜아웃 상자 (Premium Callouts)

본 스튜디오는 **Quarto 표준 규격**과 **GitHub Alert 표준 규격**을 모두 지원합니다. 중요한 요약, 경고, 팁 등을 시각적으로 돋보이게 렌더링합니다.

### A. Quarto 표준 규격 콜아웃
::: {.callout-note}
**안내 (Note Callout)**
이것은 일반적인 안내 정보를 제공하는 콜아웃 상자입니다.
:::

::: {.callout-tip}
**유용한 팁 (Tip Callout)**
이 스튜디오의 **우측 미리보기 판넬을 더블클릭**하면 거대하고 아름다운 **문서 전체화면 모드**로 진입합니다!
:::

::: {.callout-warning}
**경고 (Warning Callout)**
백엔드 포트 중복 충돌을 방지하려면 기존에 켜진 뷰어 창을 먼저 종료한 뒤 앱을 실행해야 합니다.
:::

::: {.callout-important}
**중요 (Important / Caution Callout)**
중요한 요구사항이나 놓쳐서는 안 될 핵심 규칙은 빨간색으로 시각화됩니다.
:::

### B. GitHub alert 규격 콜아웃
> [!NOTE]
> 깃허브 스타일의 가독성 높은 알림 상자 규격도 스튜디오 내에서 미려하게 표현됩니다.

> [!WARNING]
> 문법 오타가 있을 경우 렌더링에 문제가 생길 수 있으니 띄어쓰기에 주의하세요!

---

## 5. 표 (Tables)

복잡한 사양이나 비교 정보를 한눈에 보여주는 테이블을 생성할 수 있습니다.

| 기능 분류 | 마크다운 스튜디오 | 일반 메모장 | 비고 |
| :--- | :---: | :---: | :--- |
| **실시간 미리보기** | 지원 (300ms 디바운스) | 미지원 | 렉 없는 고성능 렌더링 |
| **LaTeX 수식** | 완벽 지원 (KaTeX) | 미지원 | 이공계 수식 표현 가능 |
| **Mermaid 차트** | 완벽 지원 (F11/전체화면) | 미지원 | 대형 설계도 원본 뷰어 지원 |
| **되돌리기 (Undo)** | 완벽 지원 (Ctrl+Z) | 기본 지원 | 자동완성 괄호까지 복구 |

---

## 6. 수학 공식 및 LaTeX 수식 (KaTeX)

이공계 기술 문서나 논문 작성을 위한 수식 표현 기능입니다. 경량 KaTeX 엔진이 실시간 초고속으로 수식을 그려냅니다.

### 인라인 수식 (Inline Math)
문장 안에 수식을 넣으려면 `$수식$` 형태를 사용합니다. 
예를 들어, 피타고라스 정리 법칙은 $a^2 + b^2 = c^2$ 이며, 원의 넓이 공식은 $A = \pi r^2$ 입니다.

### 블록 수식 (Block Math)
공식을 중앙 정렬하여 거대하게 부각할 때는 `$$수식$$` 형태를 활용합니다.

$$
f(x) = \int_{-\infty}^{\infty} \hat{f}(\xi)\,e^{2\pi i \xi x}\,d\xi
$$

$$
\sigma = \sqrt{\frac{1}{N}\sum_{i=1}^{N}(x_i - \mu)^2}
$$

---

## 7. 코드 하이라이팅 (PrismJS Syntax Highlighting)

프로그래밍 코드를 각 언어별 시그니처 테마 색상으로 문법 강조합니다. 코드박스 우측 상단에 마우스를 올리면 간편한 **`[복사]`** 버튼도 제공됩니다.

```python
# 파이썬 예제
def save_active_file(filepath, content):
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
```

```javascript
// 자바스크립트 예제
function toggleDocumentFullscreen() {
    const pane = document.getElementById('preview-pane');
    if (!document.fullscreenElement) {
        pane.requestFullscreen().then(() => {
            showToast("문서 전체화면 모드 작동 중");
        });
    } else {
        document.exitFullscreen();
    }
}
```

---

## 8. 링크 및 이미지 (Links & Images)

* **외부 링크**: [구글 홈페이지로 이동](https://google.com)
* **로컬 이미지**: 워크스페이스 내부의 상대 경로 이미지는 백엔드 프록시 서버를 통해 깨짐 없이 정상 노출됩니다.
  `![설명](images/logo.png)`

---

이 문서를 템플릿 삼아 나만의 멋진 기술 설계서를 자유롭게 작성해 보세요! 🚀
