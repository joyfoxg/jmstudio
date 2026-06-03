# 🚀 Joy Markdown Studio (JM-STUDIO) Changelog & Release Notes

This document contains the chronological history of updates, releases, and patch details for **Joy Markdown Studio**.

---

## 💎 Release Overview

| Version | Date | Key Patches & Features | Status |
| :--- | :--- | :--- | :--- |
| **v3.9.27** | 2026-06-03 | Separated My Media accordion, custom icons, read-only preview, and save lock prevention | **Latest Stable** |
| **v3.9.26** | 2026-06-03 | Bi-directional Wiki Links, dual backlinks panel, and Obsidian-compatible Infinite Canvas | Stable |
| **v3.9.25** | 2026-06-02 | Refactored WYSIWYG math blocks via range replacement & custom template engine | Stable |
| **v3.9.24** | 2026-06-02 | Hotfix for KaTeX formula backslash escaping in WYSIWYG rendering | Stable |
| **v3.9.23** | 2026-06-02 | Quant Portfolio and K-Stock Trading Diary Templates Launch | Stable |
| **v3.9.22** | 2026-06-02 | Premium PDF print & preview static pagination engine | Stable |
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

### 🚀 v3.9.27 (2026-06-03) - Separated My Media Accordion, Dedicated Icons, Preview, and Save Lock Prevention [Latest Stable]
*   **Separated My Media Accordion in Sidebar**:
    *   Filtered out media files (images, PDFs, audio, video) from the main "My Library" list and grouped them under a newly introduced "My Media" accordion panel.
    *   Folder hierarchy structure is fully preserved in both lists even when folders contain both markdown and media files.
*   **Dedicated Icons for Media File Types**:
    *   Analyzes file extensions dynamically to map specific icons (images: `image`, videos: `video`, audio: `music`) inside the file tree explorer.
*   **Rich Media Preview & Locked Editor Mode**:
    *   Clicking a media file disables the text editor (transparency 0.5 and pointer-events: none) and automatically displays a rich preview (image viewer, native PDF iframe, HTML5 video/audio player) in the right preview pane.
    *   Fixed a bug where a duplicate `/workspace/` prefix was prepended to absolute/external file paths in the preview pane.
*   **Preventing Binary File Corruption via Save Lock**:
    *   Blocks saving operations (`Ctrl+S` or toolbar save) when a media file is active, alerting the user via Toast, thus preventing writing text data over binary files.

### 🚀 v3.9.26 (2026-06-03) - Wiki Links, Backlinks Panel, and Obsidian-compatible Infinite Canvas Implementation [Stable]
*   **Obsidian-compatible Infinite Canvas Feature**:
    *   D3-Zoom-based infinite panning, mouse/trackpad pinch zoom controls, and a 16px neon grid background.
    *   Real-time drawing and connection drop of bezier line edges between node ports.
    *   Embedded card nodes for markdown files (cached render), images, and PDFs (native iframe) with lazy CodeMirror 6 editor binding.
    *   Canvas-specific keyboard shortcuts for infinite Undo/Redo (`Ctrl+Z`, `Ctrl+Y`) and instant save (`Ctrl+S`).
    *   Edge connection selection highlight and custom HSL color picker (6 colors) with delete toolbar (click detection radius expanded to 28px for optimal hit accuracy).
    *   Replaced default grab cursor with default arrow cursor (`default`) on board, and move cursor (`move`) during card dragging.
    *   Interactive Directory Viewer (Folder Embedding Card): Drag-and-drop folders from sidebar tree, list/grid layout toggle, real-time file search filter, alphabetical sorting (A-Z/Z-A), document creation (`+`), parent folder navigation (`..`), and direct editor navigation.
    *   Save As Dialog Integration: Prompts PyWebView native save dialog to specify custom name and location for new/exported `.canvas` files.
*   **Bi-directional Wiki Links (`[[WikiName]]`) & Real-time Rendering**:
    *   Leverages CodeMirror 6 `ViewPlugin` and `WidgetType` to dynamically parse and render wiki links as clickable, premium purple neon button widgets (`.cm-wiki-link-btn`) in non-active editor lines.
    *   Clicking a wiki button queries the workspace (case-insensitive); if found, it opens the file instantly. If not, it automatically creates a new file `WikiName.md` with default YAML Front Matter (`tags: [위키링크]`) under the workspace root and loads it.
*   **Backend Indexing & backlinks.json Schema**:
    *   Automatically parses link relations upon document saving (`save_file`) to keep the `.jmstudio/backlinks.json` index in sync.
    *   Starts a background daemon thread on startup to auto-rebuild or repair the backlinks index across the entire library.
*   **Dual Backlinks Navigator Panels**:
    *   **Left Sidebar**: Injected a `#backlinks-sidebar-accordion` section below the file tree to list all incoming links mentioning the active note.
    *   **Right Preview Panel**: Injected a card grid (`.backlinks-footer`, `.backlink-card`) at the very bottom of the markdown preview content for seamless, relational navigation.
*   **Knowledge Graph (Force Graph) Category Node Icons**:
    *   Upgraded the force graph visualization engine to draw unique emoji icons inside each document node based on the document type (categorized into 11 categories: Academic, Chemistry, Stock, Project, Diary, Schedule, Wiki, etc.).
    *   Renders a custom emoji at the center of each node with a semi-transparent circular background and neon-glowing outer rings, improving both readability and aesthetic visual design.
    *   Improved geometric scaling logic so that node boundaries and emoji sizes scale proportionally with 2D Canvas zoom-in/out levels.
*   **Resolved Undo/Redo Runtime Error**:
    *   Fixed the JS TypeError (`window.undoManager.undo is not a function`) that occurred when clicking the undo/redo toolbar buttons.
    *   Remapped the operations directly to official CodeMirror 6 commands (`undo(view)` / `redo(view)`) and established a backward-compatible mock object wrapper.
*   **Premium CSS Styles Integration**:
    *   Removed invalid inline hover styles from DOM templates and defined unified class styling for `.cm-wiki-link-btn`, `.backlinks-footer`, `.backlink-card`, and `.sidebar-backlink-item` with clean hover transitions, HSL values, and glowing borders compatible with both dark and light modes.

### 🚀 v3.9.25 (2026-06-02) - WYSIWYG Multiline Math Refactoring & Custom Templates Plugin [Stable]
*   **WYSIWYG Multiline Math Block Refactoring**:
    *   Redesigned multiline math (`$$`) and charts (````) rendering architecture to utilize a unified `Decoration.replace` range instead of buggy `display: none !important;` line decorations.
    *   This eliminates viewport sync glitches and scroll layout rendering bugs across all browsers in the hybrid WYSIWYG mode.
*   **KOSPI Trading Diary Template Repair**:
    *   Repaired broken `\times` mathematical multiplication escape sequence (previously corrupted into tabs) within `한국주식_매매일지_템플릿.md`.
*   **Custom User Templates & RSS Subscriptions Integration**:
    *   Introduced an elegant, modular plugin architecture dynamically injecting glassmorphic template saving and RSS repository synchronization dialogs.
    *   Directly binds `ExtendedMdViewerApi` to cleanly expose backend database syncing and caching capabilities, entirely leaving the original templates asset unmodified.

### 🚀 v3.9.24 (2026-06-02) - WYSIWYG Mode KaTeX Backslash Escaping Hotfix [Stable]
*   **WYSIWYG Editor KaTeX Formula Rendering Hotfix**:
    *   Corrected the backslash double-escaping bug (`\\` -> `\`) inside KaTeX math blocks for both the Quantitative Portfolio and K-Stock Trading Diary templates in `templates.js`.
    *   This hotfix resolves the duplicate backslash display issue in the WYSIWYG editor, guaranteeing math equations render identically in both live preview and WYSIWYG modes with pristine KaTeX typesetting.

### 🚀 v3.9.23 (2026-06-02) - Quantitative Portfolio & K-Stock Trading Diary Templates Launch [Stable]
*   **Quant Portfolio & Asset Allocation Planner Template**:
    *   Features a math-backed **Kelly Criterion ($f^*$) KaTeX formula model** calculating optimal risk-adjusted allocation size.
    *   Natively embeds a **Mermaid Pie Chart** dynamically visualizing equity, cryptocurrency, commodities, and fiat ratios.
    *   Constructs a **Mermaid Trading Flowchart** mapping logical rule-based SMA crossovers and RSI oversold buy/wait decisions alongside comprehensive asset grids.
*   **Korean Stock Trading Diary (K-Stock) Template**:
    *   Natively embeds the **K-Stock Net Yield ($R_{net}$) KaTeX formula model** strictly deducting local trading taxes (securities transaction tax & agricultural special tax) and brokerage commissions.
    *   Provides trading flow diagrams monitoring active market sectors, domestic sugyup (forex/institutional net buys), cash reserves, and **anti-FOMO rule-based trading reviews**.
*   **Integrated Sidebar Card Selection & Localization Mapping**:
    *   Embedded two new styling cards `quant` (icon: `line-chart`) and `kstock` (icon: `trending-up`) in the template helper sidebar.
    *   Updated translation schemas in `translations.js` to intelligently auto-generate localized default files in Split View.

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
