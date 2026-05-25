# 🧪 Math & Science Formulas and Special Symbols Guide

This document is a detailed instruction manual for writing formulas and special symbols in **Mathematics (Math), Physics (Physics), and Chemistry (Chemistry)**, which are fully supported by **Antigravity Markdown & Quarto Studio**.

> [!TIP]
> If you activate the **`[🧪 Formula Editor]`** tab in the left sidebar, you can easily insert various special symbols and math templates into the editor with a single click!
> For inserted symbols, regions marked with a question mark (`?`) will automatically place the cursor in a selected state so you can type immediately to replace the value, supporting an intelligent UX.

---

## 1. Formula Input Specification (KaTeX)

The studio uses the LaTeX syntax specification, widely used by researchers around the world, to render formulas in high-quality publication fonts.

* **Inline Formula**: A formula that fits naturally within a sentence using the `$formula$` format.
  * *Example*: Einstein's mass-energy equivalence formula is $E = mc^2$.
* **Block Formula**: A formula displayed in a large, independent paragraph centered on the page using the `$$formula$$` format.
  * *Example*: Euler's identity is expressed as:
  $$ e^{i\pi} + 1 = 0 $$

---

## 2. Calculus & Limits (Calculus & Limits)

These are mathematical expressions that serve as the backbone of engineering and natural sciences.

### A. Limits (Limits)
Renders a limit converging to a critical value using the `\lim_{x \to \infty} f(x)` syntax.

$$ \lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^n = e $$

### B. Derivatives & Partial Derivatives (Derivatives)
These are `\frac{dy}{dx}` (ordinary derivative) and `\frac{\partial y}{\partial x}` (partial derivative) expressions.

$$ \frac{\partial f}{\partial x} = \lim_{h \to 0} \frac{f(x+h, y) - f(x,y)}{h} $$

### C. Integrals (Integrals)
Supports `\int` (integral), `\int_{a}^{b}` (definite integral range), and `\oint` (contour integral).

* Definite Integral Definition:
$$ \int_{a}^{b} x^2 \, dx = \left[ \frac{1}{3}x^3 \right]_{a}^{b} $$

* Gauss's Law (Contour Integral):
$$ \oint_{S} \vec{E} \cdot d\vec{A} = \frac{Q}{\varepsilon_0} $$

---

## 3. Linear Algebra & Matrices (Matrices)

Represents matrices with rows and columns using an alignment box (`\begin{matrix} ... \end{matrix}`). Different keywords are provided depending on the type of border brackets.

### A. Standard Bracketed Matrix (`\begin{bmatrix}`)
$$
\mathbf{A} = \begin{bmatrix}
a_{11} & a_{12} & a_{13} \\
a_{21} & a_{22} & a_{23} \\
a_{31} & a_{32} & a_{33}
\end{bmatrix}
$$

### B. Determinant (`\begin{vmatrix}`)
$$
|A| = \begin{vmatrix}
a & b \\
c & d
\end{vmatrix} = ad - bc
$$

---

## 4. Physics Formulas (Physics Formulas)

### A. Maxwell's Equations (Maxwell's Equations)
These are the four core equations of electromagnetism.

$$
\begin{aligned}
\nabla \cdot \vec{E} &= \frac{\rho}{\varepsilon_0} \quad &&\text{(Gauss's Law)} \\
\nabla \cdot \vec{B} &= 0 \quad &&\text{(Gauss's Law for Magnetism)} \\
\nabla \times \vec{E} &= -\frac{\partial \vec{B}}{\partial t} \quad &&\text{(Faraday's Law)} \\
\nabla \times \vec{B} &= \mu_0\vec{J} + \mu_0\varepsilon_0\frac{\partial \vec{E}}{\partial t} \quad &&\text{(Ampere-Maxwell Law)}
\end{aligned}
$$

### B. Quantum Mechanics Schrödinger Equation (Schrödinger Equation)
$$
i\hbar\frac{\partial}{\partial t}\Psi(\vec{r}, t) = \left[ -\frac{\hbar^2}{2m}\nabla^2 + V(\vec{r}, t) \right] \Psi(\vec{r}, t)
$$

---

## 5. Chemistry & Ions (Chemistry & Ions)

Chemical symbols should be written in **roman font (regular)** rather than italicized (slanted) to meet standard specifications. To achieve this, use the `\text{...}` keyword to render them cleanly.

### A. Molecular Formulas
* **Water Molecule ($H_2O$)**: `$\text{H}_2\text{O}$`
* **Carbon Dioxide ($CO_2$)**: `$\text{CO}_2$`
* **Photosynthesis Equation**:
$$ 6\text{CO}_2 + 6\text{H}_2\text{O} \xrightarrow{\text{light}} \text{C}_6\text{H}_{12}\text{O}_6 + 6\text{O}_2 $$

### B. Ionic Equations
Express ionic symbols using superscript (`^+` / `^-`) on the right.
* **Sodium Ion**: `$\text{Na}^+$`
* **Sulfate Ion**: `$\text{SO}_4^{2-}$`
* **Precipitation Reversible Reaction Example**:
$$ \text{Ag}^+ + \text{Cl}^- \rightleftharpoons \text{AgCl} \downarrow $$

---

## 6. Special Symbols & Geometry (Greek & Geometry)

A map of frequently used Greek letters and mathematical operators.

* **Greek Letters**:
  * Lowercase: $\alpha$ (`\alpha`), $\beta$ (`\beta`), $\gamma$ (`\gamma`), $\theta$ (`\theta`), $\lambda$ (`\lambda`), $\pi$ (`\pi`), $\sigma$ (`\sigma`), $\omega$ (`\omega`)
  * Uppercase: $\Delta$ (`\Delta`), $\Sigma$ (`\Sigma`), $\Omega$ (`\Omega`), $\Phi$ (`\Phi`)
* **Comparison/Algebra Symbols**:
  * Approximation: $\approx$ (`\approx`)
  * Inequality: $\ne$ (`\ne`)
  * Proportionality: $\propto$ (`\propto`)
  * Infinity: $\infty$ (`\infty`)
* **Direction Indicators (Chemistry/Physics Arrows)**:
  * Right: $\to$ (`\to`)
  * Reversible Equilibrium: $\rightleftharpoons$ (`\rightleftharpoons`)
  * Gas Evolution: $\uparrow$ (`\uparrow`)
  * Precipitation: $\downarrow$ (`\downarrow`)

---

Referring to the templates above and using the **`[🧪 Formula Editor]`** panel on the left, feel free to write any highly advanced scientific papers or technical specifications completely in the editor! 🚀
