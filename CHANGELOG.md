# 🚀 Joy Markdown Studio (JM-STUDIO) Changelog & Release Notes

This document contains the chronological history of updates, releases, and patch details for **Joy Markdown Studio**.

---

## 💎 Release Overview

| Version | Date | Key Patches & Features | Status |
| :--- | :--- | :--- | :--- |
| **v3.9.22** | 2026-06-02 | Premium PDF print & preview static pagination engine | **Latest Stable** |
| **v3.9.21** | 2026-05-31 | Real-time WYSIWYG rendering, CM6 equation enter crash fix | Stable |
| **v3.9.20** | 2026-05-28 | Glassmorphism custom confirm dialog modal, multi-language fixes | Stable |
| **v3.9.19** | 2026-05-25 | Native python packaging (`jmstudio`), socket bind timeout fix | Stable |
| **v3.9.9** | 2026-05-20 | YAML Front Matter tag editor & sidebar hashtag navigator | Stable |
| **v3.9.8** | 2026-05-18 | Asynchronous PyPI upgrade detector & glassmorphism notification | Stable |
| **v3.9.7** | 2026-05-15 | 9 Built-in academic/utility markdown library templates | Stable |
| **v3.9.0 ~ v3.9.6** | 2026-05 | CodeMirror 6 editor, Google Drive sync, offline-first emoji accelerator | Stable |
| **v3.8.0 ~ v3.8.9** | 2026-04 | KaTeX math input helper panel, EE formula library restructuring | Stable |

---

## 📢 Detailed Release History (v3.9.0 ~ Present)

### 🚀 v3.9.22 (2026-06-02) - Premium PDF Printing Layout & Static Page Numbering Engine [Latest Stable]
*   **JavaScript-Based Static Pagination Engine**:
    *   Bypassed a critical Chromium WebView2 printing bug under `@media print` where the state scope of the CSS `counter(page)` breaks, freezing page numbers as `0 / n` or `0 / 0`.
    *   Right before launching the print dialog, the system clones the preview DOM and dynamically measures the height of all children nodes against physical A4세로 pixel ratios (standard 96 DPI A4 height `956px` minus header/footer allocation `90px`, resulting in a pure content limit of `866px`). It slices and wraps them into static page containers (`.print-page-wrapper`).
    *   Directly injects hardcoded, pre-calculated page numbers (e.g., **`1 / 2`**, **`2 / 2`**) into the footer of each wrapper, completely eliminating the WebView counter bug.
*   **Prevented Header/Footer Overlaps & Precise Padding Guard**:
    *   Resolved layout issues where page headers/footers overlapped with body text starting from page 2 due to negative margins and broken print views.
    *   Discarded negative margins entirely. Placed headers fixed at `top: 0` and footers at `bottom: 0`, and dynamically calculated and applied precise safe body padding (`bodyPaddingTopBottom`) to ensure perfect vertical isolation.
*   **Asynchronous Asset Cache-Busting**:
    *   Appended unified version query strings `?v=3.9.22` to all modular JS imports (`translations.js`, `editor.js`, `emoji.js`, `templates.js`) in `index.html`, forcing WebView2 to clear outdated cached scripts and run the latest stable engine.

### 🎨 v3.9.21 (2026-05-31) - Real-Time Advanced Hybrid WYSIWYG Rendering & Stability Hotfixes
*   **Real-Time WYSIWYG Rendering**: Enabled Mermaid diagrams, statistics charts (Chart.js), SMILES chemical formula blocks, 9 template layouts, and GFM Tables to render dynamically and flawlessly inside the WYSIWYG editing window, achieving a 100% visual match with the preview window.
*   **Resolved Equation Enter Crash (JS Error)**: Fixed a strict sorting crash of CodeMirror 6 `RangeSetBuilder` when pressing the Enter key inside LaTeX equations. Implemented single decoration pooling, semantic sorting, and **Overlapping Filtration** steps to guarantee robust, continuous editing stability.
*   **Fixed Fullscreen Capturing & Global Scope Binding**: Exposed fullscreen and zoom helper methods to the `window` global scope so inline `onclick` script logic in custom HTML mindmaps evaluates successfully, and solved the bug where a tiny 13x13px inline arrow icon svg got captured instead of the main chart by implementing `s.closest('button')` filter logic.
*   **Mindmap Scanner Viewport & Empty Line Leak Fixes**: Expanded scanner bounds to the entire document line limits to prevent bottom-area code leaks, and removed the empty line breakout condition so visual HTML mindmaps render correctly even with structural blank lines.

### ⚙️ v3.9.20 (2026-05-28) - Multi-Language Fixes & Custom Confirm Dialog Modal
*   **Fixed Library Document Exclude JS ReferenceError**: Fixed a critical frontend JS bug where excluding a file from the library tree threw an undefined variable ReferenceError.
*   **Toolbar UI Multi-Language Polishing**: Standardized labels, tooltips, and confirmation dialog texts for bold, italic, emoji, undo, and save actions across Korean and English locales.
*   **Glassmorphism Custom Confirm Dialog**: Replaced the native browser `confirm()` modal with a custom, glowing neon-style semi-transparent glassmorphism modal matching the app's dark visual theme.
*   **TOC Immediate Sync on Document Removal**: Configured the right Table of Contents (TOC) panel to instantly reset and auto-hide when the active document is deleted or excluded from the library.

### 📦 v3.9.19 (2026-05-25) - Native Python Packaging Porting & Backend Socket Timeout Fix
*   **Restructured Code into a Formal Python Package (`jmstudio`)**: Reorganized the codebase into modular package files, complying with official PEP standards for distributions.
*   **Socket Bind Waiting Delay Calibration**: Added a micro socket listener binding delay during startup to prevent GUI launcher socket connection errors in low-spec environments.

### 🏷️ v3.9.9 (2026-05-20) - YAML Front Matter Hashtag Editor & Sidebar Tag Browser
*   **Toolbar Tag Editor Modal**: Added a top toolbar shortcut button to edit active document YAML Front Matter `tags` metadata within a clean grid modal.
*   **Sidebar Hashtag Navigator**: Added a dedicated Hashtag tab in the sidebar to scan, group, and display unique tags across all workspace files, allowing users to search and launch documents in one click.
*   **Auto-Hide Front Matter in Preview**: Sliced out the YAML Front Matter block (`---` to `---`) from the preview display area for clean reading.

### ☁️ v3.9.8 (2026-05-18) - PyPI Asynchronous Latest Version Detection
*   **Asynchronous Version Checker**: Queries the PyPI database (`https://pypi.org/pypi/joy-markdown-studio/json`) in the background on startup, utilizing a 2-second timeout to check for the latest package version without blocking the UI.
*   **Upgrade Notification Modal**: Triggers a gorgeous glassmorphism modal greeting the user after splash fading if a newer stable release is detected on PyPI, offering one-click `pip install --upgrade` copying.

### 📝 v3.9.7 (2026-05-15) - Document Template Helper (9 Templates) and Smart Insertion
*   **9 Built-in Standard Templates**: Embedded 9 templates including Academic Thesis, University Report, Knowledge Note (Wiki), Task Checklist (TODO), Weekly Timetable, and Idea Quick Memo.
*   **Integrated Selector UI**: Added a `Create from Template` shortcut button right inside the local file explorer header, dynamically toggling a compact grid list.
*   **Split-View Auto-Open**: Prefills context-aware localized filenames and opens the created file in Split View automatically for instant writing.

### 🐛 v3.9.6 (2026-05-10) - External Absolute Path Pathnormalization Fixes
*   **Fixed External Absolute Path Loading Crash**: Fixed a critical frontend TypeError where opening a file located outside the active workspace directory (with paths like `C:/...`) triggered a crash due to Falsy `workspaceRoot` replacements.
*   **API Bridge Reliability Improvements**: Resolved the backend bottleneck where browsing via external web browsers caused an `AttributeError: Window object has no attribute js_api` error at the Bottle API endpoint.

### 🎨 v3.9.5 (2026-05-08) - Emoji Grid Layout Optimization & Category Tab Fix
*   **Expanded Dropdown Container**: Fixed the layout issue where the 10th column in the 10-column layout got truncated by expanding the dropdown menu width to `398px`.
*   **Fine-Tuned Emoji Bounding**: Adjusted emoji rendering size to `22px` and button bounding grid boxes to `34px` for elegant, spacing-preserving alignments.

### 🛠️ v3.9.4 (2026-05-05) - Standalone Build Debug Tool Deactivation & Performance
*   **Deactivated Developer Tools**: Completely disabled the Chromium Developer Tools debug flag in the main webview shell setup for secure production release.
*   **Hardware Acceleration Validation**: Stabilized the background offline emoji server and 3D GPU layers for uninterrupted runtime under PyInstaller compression.

### 😃 v3.9.3 (2026-05-03) - Emoji Picker Performance Boost & Offline Local Serving
*   **Local Emoji Dataset Integration**: Embedded the 430KB `emoji-data.json` directly as a local server asset, enabling instant emoji picker loading in fully offline environments.
*   **Zero-Lag Click via Background Pre-rendering**: Pre-renders the emoji picker in the background shortly after the application starts, yielding a **0ms response** upon click.
*   **GPU 3D Accelerated Containment Scrolling**: Enforced CSS `contain: content/paint` alongside `will-change: transform` to isolate repainting and deliver silky-smooth 60fps+ scrolling.

### 🎨 v3.9.2 (2026-05-01) - UI & Editor Font Customization Lancement
*   **Custom UI & Preview Fonts**: Enabled changing the typography of the entire application interface and preview area (including `Inter`, `Outfit`, and academic `Lora`).
*   **Monospaced Coding Fonts**: Integrated popular monospaced coding fonts (`Fira Code`, `JetBrains Mono`, `D2Coding`) alongside a font size range slider (12px to 24px), applying CSS adjustments dynamically.

### ☁️ v3.9.1 (2026-04-28) - Google Drive Sync Engine & Remote Library Integration
*   **Zero-Configuration OAuth Login**: Embedded application credentials directly into the client. General users can authenticate immediately through their default web browser without setting up keys.
*   **App-Specific File Scope**: Operates strictly within the secure `drive.file` scope, managing only files created by Joy Markdown Studio for bulletproof account privacy.
*   **Mtime-based Collision Resolution**: Compares modified time differences between local and cloud databases, presenting a smart choice dialog if conflict occurs.
*   **Remote File Browser**: Scans cloud backups directly from the local explorer tree and imports remote notes wirelessly in one click.

### 💎 v3.9.0 (2026-04-20) - CodeMirror 6 Editor Core Major Integration
*   **High-Speed Editor Engine**: Replaced the classic HTML `<textarea>` with the high-performance **CodeMirror 6** editing engine.
*   **Coding Assist Packs**: Packed with auto-close brackets, robust undo/redo history, multi-cursor support, and real-time syntax highlighting for inline/block math (`$...$`) and chemical SMILES codes.

---

## 🏛️ Previous Milestone Archive (v3.8.0 ~ v3.8.9)
*   **KaTeX Math Engine Upgrade v0.17.0 (v3.8.9)**: Restored mathematical previews for previously non-rendering items (`\sout`, `\overbracket`), added actuarial angles, and resolved limits overlapping issues for `\mathclap`.
*   **Electrical & Electronics (EE) Subtab Revamp (v3.8.8)**: Restructured EE formulas into 6 distinct sub-disciplines with a clean grid, and resolved LaTeX escaping layout bugs in preview tooltips.
*   **PubChem Real-Time Molecular Structure Integration (v3.8.0)**: Built NLM PubChem API queries mapping Korean/English chemical terms to real-time 2D graphics and SMILES block injections.

---
*This changelog is strictly updated and structured to trace the official updates of Joy Markdown Studio.* 🚀
