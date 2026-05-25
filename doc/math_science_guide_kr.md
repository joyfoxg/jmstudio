# 🧪 수학·과학 수식 및 특수기호 가이드

본 문서는 **Antigravity Markdown & Quarto Studio**에서 완벽히 지원하는 **수학(Math), 물리학(Physics), 화학(Chemistry)** 공식과 특수 기호 작성법에 대한 상세 설명서입니다.

> [!TIP]
> 좌측 사이드바의 **`[🧪 수식 입력기]`** 탭을 활성화하면 다양한 특수 기호와 수학 템플릿을 클릭 한 번으로 손쉽게 에디터에 삽입할 수 있습니다!
> 삽입된 기호 중 물음표(`?`)가 표시된 영역은 커서가 자동으로 선택 상태로 들어가 바로 타이핑해서 값을 대체할 수 있는 지능형 UX가 지원됩니다.

---

## 1. 수식 기본 입력 규격 (KaTeX)

스튜디오는 전 세계 연구원들이 널리 사용하는 LaTeX 문법 규격을 차용하여 고품질의 출판용 폰트로 공식을 그립니다.

* **인라인 수식 (Inline)**: 문장 사이에 자연스럽게 들어가는 수식으로 `$수식$` 형식을 사용합니다.
  * *예시*: 아인슈타인의 질량-에너지 등가 공식은 $E = mc^2$ 입니다.
* **블록 수식 (Block)**: 문장 중앙에 독립된 단락으로 크게 표시하는 수식으로 `$$수식$$` 형식을 사용합니다.
  * *예시*: 오일러의 등식은 다음과 같이 표현됩니다:
  $$ e^{i\pi} + 1 = 0 $$

---

## 2. 미적분학 및 극한 (Calculus & Limits)

공학 및 자연과학의 뼈대가 되는 수식 표현입니다.

### A. 극한 (Limits)
`\lim_{x \to \infty} f(x)` 문법을 통해 임계값으로 수렴하는 극한을 렌더링합니다.

$$ \lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^n = e $$

### B. 미분 및 편미분 (Derivatives)
`\frac{dy}{dx}` (일반 미분) 및 `\frac{\partial y}{\partial x}` (편미분) 표현식입니다.

$$ \frac{\partial f}{\partial x} = \lim_{h \to 0} \frac{f(x+h, y) - f(x,y)}{h} $$

### C. 적분 (Integrals)
`\int` (인테그랄), `\int_{a}^{b}` (정적분 범위), `\oint` (선적분)을 지원합니다.

* 정적분 정의식:
$$ \int_{a}^{b} x^2 \, dx = \left[ \frac{1}{3}x^3 \right]_{a}^{b} $$

* 가우스 법칙 (선적분):
$$ \oint_{S} \vec{E} \cdot d\vec{A} = \frac{Q}{\varepsilon_0} $$

---

## 3. 선형 대수학 및 행렬 (Matrices)

행과 열을 가진 매트릭스를 정렬 상자(`\begin{matrix} ... \end{matrix}`)를 통해 표현합니다. 테두리 괄호 종류에 따라 다양한 키워드가 제공됩니다.

### A. 일반 대괄호 행렬 (`\begin{bmatrix}`)
$$
\mathbf{A} = \begin{bmatrix}
a_{11} & a_{12} & a_{13} \\
a_{21} & a_{22} & a_{23} \\
a_{31} & a_{32} & a_{33}
\end{bmatrix}
$$

### B. 행렬식 (Determinant, `\begin{vmatrix}`)
$$
|A| = \begin{vmatrix}
a & b \\
c & d
\end{vmatrix} = ad - bc
$$

---

## 4. 물리학 공식 (Physics Formulas)

### A. 맥스웰 방정식 (Maxwell's Equations)
전자기학의 핵심 방정식 4가지입니다.

$$
\begin{aligned}
\nabla \cdot \vec{E} &= \frac{\rho}{\varepsilon_0} \quad &&\text{(가우스 법칙)} \\
\nabla \cdot \vec{B} &= 0 \quad &&\text{(자기 가우스 법칙)} \\
\nabla \times \vec{E} &= -\frac{\partial \vec{B}}{\partial t} \quad &&\text{(패러데이 법칙)} \\
\nabla \times \vec{B} &= \mu_0\vec{J} + \mu_0\varepsilon_0\frac{\partial \vec{E}}{\partial t} \quad &&\text{(앙페르-맥스웰 법칙)}
\end{aligned}
$$

### B. 양자역학 슈뢰딩거 방정식 (Schrödinger Equation)
$$
i\hbar\frac{\partial}{\partial t}\Psi(\vec{r}, t) = \left[ -\frac{\hbar^2}{2m}\nabla^2 + V(\vec{r}, t) \right] \Psi(\vec{r}, t)
$$

---

## 5. 화학식 및 이온식 (Chemistry & Ions)

화학 기호는 이탤릭체(기울임)가 아닌 **정체(Roman font)**로 써야 규격에 맞습니다. 이를 위해 `\text{...}` 키워드를 씌워서 깨끗하게 렌더링합니다.

### A. 일반 분자식
* **물 분자 ($H_2O$)**: `$\text{H}_2\text{O}$`
* **이산화탄소 ($CO_2$)**: `$\text{CO}_2$`
* **광합성 반응식**:
$$ 6\text{CO}_2 + 6\text{H}_2\text{O} \xrightarrow{\text{light}} \text{C}_6\text{H}_{12}\text{O}_6 + 6\text{O}_2 $$

### B. 이온 반응식
우측 위첨자(`^+` / `^-`)를 활용하여 이온 기호를 표현합니다.
* **나트륨 이온**: `$\text{Na}^+$`
* **황산 이온**: `$\text{SO}_4^{2-}$`
* **앙금 생성 가역 반응 예시**:
$$ \text{Ag}^+ + \text{Cl}^- \rightleftharpoons \text{AgCl} \downarrow $$

---

## 6. 특수기호 및 기하학 (Greek & Geometry)

자주 사용하는 그리스 문자와 수학 연산자 맵입니다.

* **그리스 문자**:
  * 소문자: $\alpha$ (`\alpha`), $\beta$ (`\beta`), $\gamma$ (`\gamma`), $\theta$ (`\theta`), $\lambda$ (`\lambda`), $\pi$ (`\pi`), $\sigma$ (`\sigma`), $\omega$ (`\omega`)
  * 대문자: $\Delta$ (`\Delta`), $\Sigma$ (`\Sigma`), $\Omega$ (`\Omega`), $\Phi$ (`\Phi`)
* **비교/대수 기호**:
  * 근사치: $\approx$ (`\approx`)
  * 다름: $\ne$ (`\ne`)
  * 비례: $\propto$ (`\propto`)
  * 무한대: $\infty$ (`\infty`)
* **방향 지시자 (화학/물리 화살표)**:
  * 오른쪽: $\to$ (`\to`)
  * 가역 평형: $\rightleftharpoons$ (`\rightleftharpoons`)
  * 기체 발생: $\uparrow$ (`\uparrow`)
  * 침전 발생: $\downarrow$ (`\downarrow`)

---

위 양식들을 참고하고 좌측 **`[🧪 수식 입력기]`** 패널을 활용하여 어떠한 고난도 과학 논문이나 설계서도 자유롭고 완벽하게 에디터 안에서 작성해 보세요! 🚀
