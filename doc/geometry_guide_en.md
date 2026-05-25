# 📐 Science & Engineering Geometry and Physics Diagram Drawing Guide

> **Maximizing the Visual Value of Science and Engineering Academic Documents**  
> This document is a comprehensive practical guide summarizing the **built-in SVG vector drawing method**, the **LaTeX formula combination method**, and the **integration workflow with external professional tools (GeoGebra, Excalidraw, Draw.io)** used when writing mathematical geometric figures, physical concept mechanics diagrams, graphs, etc., in Joy Markdown Studio.

---

## 💡 Summary: Which tool should you use?

| Usage | Recommended Method | Characteristics |
| :--- | :--- | :--- |
| **Simple Geometry / Graphs** | **Direct Inline SVG Insertion** | No separate external image files needed, renders as high-resolution vectors, and coordinates can be directly modified in the text editor. |
| **Geometric Notation Combined with Formulas** | **LaTeX / KaTeX Symbols** | Inserted harmoniously within text line spacing like $\triangle ABC$, $\vec{F}$, $\angle\theta$. |
| **Function Graphs & Precise Geometric Construction** | **GeoGebra ➡️ SVG/PNG Export** | Most accurately draws coordinate geometry, 2D/3D functions, and calculus graphs to insert into documents. |
| **Physics Concept Diagrams / Free-Body Diagrams** | **Excalidraw ➡️ SVG Export** | Artistically and intuitively draws physical force indicator lines, object placements, etc., with a stylish sketchy look. |
| **Circuit Diagrams / Experimental Device Blocks** | **Draw.io ➡️ PNG/SVG Export** | Precisely layouts logic circuits, electrical circuits, and experimental equipment block diagrams. |

---

## 1. ⚡ Drawing Using Inline SVG
Directly inserting HTML `<svg>` tags into a markdown document allows you to draw high-quality vector graphics without external file dependencies. These examples use stylish neon and pastel color sets matching Joy Markdown Studio's dark mode.

### 📐 Example 1: Mathematics - Trigonometric Unit Circle and Polar Coordinate System
An example of drawing a unit circle representing the radius vector and angle $\theta$ often used in mathematics.

```html
<svg width="340" height="340" style="background:#18181b; border:1px solid #27272a; border-radius:12px; display:block; margin:20px auto;">
  <!-- Grid lines and coordinate axes -->
  <line x1="20" y1="170" x2="320" y2="170" stroke="#3f3f46" stroke-width="1.5" stroke-dasharray="4" />
  <line x1="170" y1="20" x2="170" y2="320" stroke="#3f3f46" stroke-width="1.5" stroke-dasharray="4" />
  <!-- Arrowheads -->
  <path d="M 315,165 L 325,170 L 315,175 Z" fill="#71717a" />
  <path d="M 165,25 L 170,15 L 175,25 Z" fill="#71717a" />
  <text x="325" y="185" fill="#a1a1aa" font-size="11">x</text>
  <text x="180" y="20" fill="#a1a1aa" font-size="11">y</text>
  
  <!-- Circle (Radius r = 100) -->
  <circle cx="170" cy="170" r="100" fill="none" stroke="#52525b" stroke-width="1.5" />
  
  <!-- Radius Vector (Line from origin to P) -->
  <line x1="170" y1="170" x2="256.6" y2="120" stroke="#00d2ff" stroke-width="3" stroke-linecap="round" />
  <circle cx="256.6" cy="120" r="5" fill="#00d2ff" />
  
  <!-- Auxiliary Line (Perpendicular from P to x-axis) -->
  <line x1="256.6" y1="120" x2="256.6" y2="170" stroke="#a855f7" stroke-width="1.5" stroke-dasharray="3" />
  
  <!-- Angle θ Arc -->
  <path d="M 210,170 A 40,40 0 0,0 204.6,150" fill="none" stroke="#ff007f" stroke-width="2.5" />
  <text x="215" y="160" fill="#ff007f" font-size="12" font-weight="bold">θ</text>
  
  <!-- Text Labels -->
  <text x="155" y="185" fill="#ffffff" font-size="12">O</text>
  <text x="265" y="115" fill="#00d2ff" font-size="12" font-weight="bold">P (cos θ, sin θ)</text>
  <text x="210" y="110" fill="#00d2ff" font-size="11">r = 1</text>
</svg>
```

> [!NOTE]
> If you copy the above SVG code directly into the editor, the preview shell on the right will instantly render a mathematical drawing where the cyan radius line and pink angle symbol glow brightly on the dark background.

---

### ⚛️ Example 2: Physics - Object on an Inclined Plane and Free-body Diagram
An example of drawing vectors describing a box on an inclined plane, gravitational components, normal force, and friction, which frequently appear in mechanics problems.

```html
<svg width="400" height="240" style="background:#18181b; border:1px solid #27272a; border-radius:12px; display:block; margin:20px auto;">
  <!-- Inclined Plane (Triangle) -->
  <polygon points="50,200 350,200 350,70" fill="none" stroke="#71717a" stroke-width="3" />
  <!-- Angle Notation -->
  <path d="M 80,200 A 30,30 0 0,0 76.5,187" fill="none" stroke="#ff007f" stroke-width="2" />
  <text x="88" y="195" fill="#ff007f" font-size="12">θ</text>

  <!-- Rotation Group for Inclined Angle Calculation (Angle: -23.4 degrees) -->
  <g transform="translate(180, 147.5) rotate(-23.4)">
    <!-- Object (Box) -->
    <rect x="-30" y="-30" width="60" height="30" fill="rgba(0, 210, 255, 0.15)" stroke="#00d2ff" stroke-width="2.5" rx="3" />
    
    <!-- Gravity Vector (mg - Vertical Downward) -->
    <line x1="0" y1="-15" x2="39.6" y2="78" stroke="#ef4444" stroke-width="2.5" stroke-dasharray="1" /> <!-- Extension Line -->
    <line x1="0" y1="-15" x2="23.8" y2="40.8" stroke="#ef4444" stroke-width="3" marker-end="url(#arrow-red)" />
    
    <!-- Normal Force Vector (N - Perpendicular Upward from Incline) -->
    <line x1="0" y1="-15" x2="0" y2="-75" stroke="#22c55e" stroke-width="3" />
    <polygon points="0,-75 -4,-67 4,-67" fill="#22c55e" />
    
    <!-- Friction Vector (f - Parallel Upward along Incline) -->
    <line x1="-15" y1="0" x2="-65" y2="0" stroke="#eab308" stroke-width="3" />
    <polygon points="-65,0 -57,-4 -57,4" fill="#eab308" />
    
    <!-- Vector Labels -->
    <text x="-5" y="-80" fill="#22c55e" font-size="11" font-weight="bold">N (Normal Force)</text>
    <text x="-95" y="5" fill="#eab308" font-size="11" font-weight="bold">f (Friction)</text>
    <text x="30" y="30" fill="#ef4444" font-size="11" font-weight="bold">F_g = mg</text>
  </g>
</svg>
```

---

## 2. ⚛️ Geometric Notation within LaTeX / KaTeX Formula Blocks
When discussing geometric structures within pure text spacing, you can express them clearly using only mathematical symbols without separate drawings.

* **Frequently Used Geometric Macro Table:**
  * **Triangle**: `$\triangle ABC$` $\rightarrow$ $\triangle ABC$
  * **Angle**: `$\angle \theta$` $\rightarrow$ $\angle \angle \theta$
  * **Perpendicular**: `$L_1 \perp L_2$` $\rightarrow$ $L_1 \perp L_2$
  * **Parallel**: `$L_1 \parallel L_2$` $\rightarrow$ $L_1 \parallel L_2$
  * **Segment**: `$\overline{AB}$` $\rightarrow$ $\overline{AB}$
  * **Arc**: `$\widehat{AB}$` $\rightarrow$ $\widehat{AB}$
  * **Vector**: `$\vec{F}$` or `$\overrightarrow{AB}$` $\rightarrow$ $\vec{F}$ / $\overrightarrow{AB}$

---

## 3. 🌐 External Professional Authoring Tool Workflow

If you need the fastest and most professional visualization, we recommend drawing diagrams using free web-based tools and linking them to markdown.

### 1) GeoGebra — Optimizing Math Graphs/Geometry Drawings
GeoGebra is optimized for drawing mathematical functions, finding geometric symmetry/intersections, etc.

1. Access the **GeoGebra Geometry** page ([geogebra.org/geometry](https://www.geogebra.org/geometry)).
2. Construct the desired shapes or enter formulas (e.g., `f(x) = sin(x) + 0.5x`) in the input box.
3. Select **[Export] ➡️ [Image (.png or .svg)]** from the top right menu.
   * *Tip: We highly recommend the **SVG format** for clear insertion without pixelation.*
4. Create an `images/` folder under your project folder and save the image there (e.g., `images/sine_graph.svg`).
5. Insert it in the markdown editor in the following link format:
   ```markdown
   ![Trigonometric Graph](images/sine_graph.svg)
   ```

### 2) Excalidraw — Stylish Sketchy Physics Concept Diagrams
A tool that lets you easily draw trendy, sketchy diagrams as if drawn with crayon on a blackboard.

1. Access [excalidraw.com](https://excalidraw.com).
2. Draw experiment outlines or force acting points using rectangles, circles, free-form curves, and text tools.
3. Select the **[Export image]** menu in the top left.
4. Option settings:
   * **Format**: `SVG` (adjusts text or transparency smoothly when transitioning back to a dark background theme)
   * **Theme**: `Dark` (we recommend exporting in dark theme to match Joy Markdown Studio's default dark mode)
5. Save the file as `images/physical_diagram.svg` and insert it into markdown:
   ```markdown
   ![Experiment Outline](images/physical_diagram.svg)
   ```

### 3) Draw.io — Electrical Circuits and Device Architecture
A tool to map electrical circuit diagrams, chemical experiment pipeline flows, etc., with strict symbol specifications onto a grid.

1. Access [app.diagrams.net](https://app.diagrams.net).
2. Enter `circuit` in the left library search box to load electrical circuit elements (resistors, capacitors, power sources, etc.).
3. Arrange and wire the elements with arrows to complete the circuit diagram.
4. Click **[File] ➡️ [Export as] ➡️ [PNG...]** or **[SVG...]**.
   * *Tip: Checking the `Transparent` background option when exporting allows the borders to blend cleanly regardless of the app's dark/light background mode.*
5. Save the file in the image folder and link it:
   ```markdown
   ![RCL Series Circuit Diagram](images/rcl_circuit.png)
   ```

---

## 🔒 Tip: Precautionary Guidelines for Directory Path Management
* When inserting external images, using relative paths (`images/photo.png`) resolves files relative to the current markdown file's location.
* To make sure images are not broken when viewed on other computers or systems, we recommend creating an **`images/`** directory at the project workspace root and storing all drawing files there.
