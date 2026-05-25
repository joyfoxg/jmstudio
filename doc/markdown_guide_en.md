# 🎨 Antigravity Markdown Comprehensive Guide

This document is a markdown syntax manual fully supported by **Antigravity Markdown & Quarto Studio**. 
Try modifying the syntax in the editor on the left, and check the results using the real-time renderer and fullscreen mode (`double-click`) on the right!

---

## 1. Text Styling

This is the most basic text emphasis notation.

* **Bold**: `**text**` or `__text__` -> **Emphasize important content**
* *Italic*: `*text*` or `_text_` -> *Soft italicized emphasis*
* ~~Strikethrough~~: `~~text~~` -> ~~This content has been modified.~~
* `Inline Code`: `` `code` `` -> Used for representing variable names like `currentFilePath` or functions like `saveActiveFile()`

---

## 2. Headers

These headers establish the structure of the document. When you write a header, a real-time outline is automatically generated in the **TOC (Table of Contents) panel** on the right, allowing you to easily jump to different sections.

# Level 1 Header (H1) - `# H1`
## Level 2 Header (H2) - `## H2`
### Level 3 Header (H3) - `### H3`
#### Level 4 Header (H4) - `#### H4`

---

## 3. Lists & Blockquotes

### Unordered List
* Item 1 (using `*`, `-`, or `+`)
  * Sub-item 1.1 (indented with 2 spaces)
  * Sub-item 1.2
* Item 2

### Ordered List
1. First task (input `1. `)
2. Second task
3. Third task

### Blockquotes
> **This is a blockquote box.**
> Used when quoting important maxims or reference materials, and can span multiple lines.
> >> Nested blockquotes are also cleanly supported!

---

## 4. Premium Callouts

This studio supports both the **Quarto Standard Specification** and the **GitHub Alert Standard Specification**. It renders important summaries, warnings, tips, etc., to stand out visually.

### A. Quarto Standard Specification Callouts
::: {.callout-note}
**Note Callout**
This is a callout box providing general guidance information.
:::

::: {.callout-tip}
**Tip Callout**
**Double-click the preview panel on the right** of this studio to enter a gorgeous **document fullscreen mode**!
:::

::: {.callout-warning}
**Warning Callout**
To prevent backend port duplicate conflicts, you must terminate any existing open viewer windows before running the app.
:::

::: {.callout-important}
**Important / Caution Callout**
Important requirements or critical rules that must not be missed are visualized in red.
:::

### B. GitHub Alert Specification Callouts
> [!NOTE]
> GitHub-style highly legible alert boxes are also rendered beautifully within the studio.

> [!WARNING]
> Syntactical typos can cause rendering issues, so be careful with spacing!

---

## 5. Tables

You can create tables to show complex specifications or comparison information at a glance.

| Feature Classification | Markdown Studio | General Notepad | Remarks |
| :--- | :---: | :---: | :--- |
| **Real-time Preview** | Supported (300ms debounce) | Unsupported | Lag-free high-performance rendering |
| **LaTeX Math Formula** | Fully Supported (KaTeX) | Unsupported | Expresses scientific formulas |
| **Mermaid Charts** | Fully Supported (F11/Fullscreen) | Unsupported | Large blueprint original viewer supported |
| **Undo** | Fully Supported (Ctrl+Z) | Basic Support | Restores even auto-completed brackets |

---

## 6. Math Formulas and LaTeX Equations (KaTeX)

This feature is for writing mathematical formulas in technical and academic documents. The lightweight KaTeX engine renders equations in real time at ultra-high speed.

### Inline Math
To insert equations within a sentence, use the `$formula$` format. 
For example, the Pythagorean theorem is $a^2 + b^2 = c^2$, and the area of a circle formula is $A = \pi r^2$.

### Block Math
To highlight equations in a centered, large format, use the `$$formula$$` format.

$$
f(x) = \int_{-\infty}^{\infty} \hat{f}(\xi)\,e^{2\pi i \xi x}\,d\xi
$$

$$
\sigma = \sqrt{\frac{1}{N}\sum_{i=1}^{N}(x_i - \mu)^2}
$$

---

## 7. Syntax Highlighting (PrismJS Syntax Highlighting)

Highlights programming code syntax with signature theme colors for each language. A convenient **`[Copy]`** button is also provided when hovering over the top right of the code box.

```python
# Python Example
def save_active_file(filepath, content):
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
```

```javascript
// JavaScript Example
function toggleDocumentFullscreen() {
    const pane = document.getElementById('preview-pane');
    if (!document.fullscreenElement) {
        pane.requestFullscreen().then(() => {
            showToast("Document fullscreen mode active");
        });
    } else {
        document.exitFullscreen();
    }
}
```

---

## 8. Links & Images

* **External Link**: [Go to Google Homepage](https://google.com)
* **Local Image**: Relative path images inside the workspace are exposed normally without breakage via the backend proxy server.
  `![Description](images/logo.png)`

---

Feel free to write your own cool technical specifications using this document as a template! 🚀
