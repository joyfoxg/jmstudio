# 🧜‍♀️ Mermaid Comprehensive Diagram Guide

This document is a **comprehensive Mermaid diagram manual** supporting real-time rendering in **Antigravity Markdown & Quarto Studio**. 
Refer to the various diagram syntaxes to write magnificent technical design specifications!

> [!TIP]
> To comply with the Quarto specification standard, using the ` ```{mermaid} ` format at the start of a code block will allow the studio to correct it in real time and draw it perfectly on the screen!
> Hovering over the diagram card area activates the **`[🔍 Original Size]`** toggle and **`[🖥️ Fullscreen]`** feature.

---

## 1. Sequence Diagram

A diagram that visualizes the message flow and sequence of interactions between system entities.

```{mermaid}
sequenceDiagram
    autonumber
    actor User as User (Browser)
    participant Web as Bottle Web Server
    participant API as pywebview Backend
    participant Disk as Local File System

    User->>Web: / Route Web Resource Request
    Web-->>User: Return index.html (Frontend)
    User->>API: Save text changes (save_file)
    API->>Disk: Execute utf-8 encoded file write
    Disk-->>API: Write complete callback
    API-->>User: {"status": "success"} JSON response
    Note over User, API: Toast notification on screen: "Saved successfully!"
```

---

## 2. Gantt Chart

Projects schedule and timeline management, beautifully visualizing parallel/sequential progress between tasks.

```{mermaid}
gantt
    title Antigravity Studio Development Project Roadmap
    dateFormat  YYYY-MM-DD
    section Design and Planning
    UI/UX Premium Layout Design       :active, p1, 2026-05-10, 4d
    Stand-alone Viewer Architecture Setup :after p1, 3d
    section Core Feature Implementation
    Bottle Server and File CRUD Interface :active, d1, 2026-05-14, 2026-05-16
    Mermaid Class Corrector Integration :crit, d2, 2026-05-16, 1d
    section Convenience Feature Enhancement
    Original Size & F11 Fullscreen Viewer Addition :active, h1, 2026-05-17, 1d
    Global Ctrl+S & Undo/Redo Engine Linkage :active, h2, 2026-05-17, 1d
```

---

## 3. Class Diagram

Models class structure, attributes, inheritance, and association relationships in object-oriented programming.

```{mermaid}
classDiagram
    class UndoManager {
        +Object textarea
        +Array history
        +Number currentIndex
        +Number maxHistory
        +Boolean isUndoRedoAction
        +saveState()
        +undo() Boolean
        +redo() Boolean
        +restoreState()
    }
    
    class WebViewerApp {
        +String active_workspace
        +Number PORT
        +run_server()
        +list_files() Array
        +read_file(path) String
        +save_file(path, content)
    }

    class DocumentPreview {
        +HTMLElement container
        +HTMLElement previewPane
        +triggerLiveRender()
        +toggleDocumentFullscreen()
    }

    WebViewerApp --> DocumentPreview : Rendering Bridge
    DocumentPreview *-- UndoManager : State Snapshot Management
```

---

## 4. State Diagram

Describes state transitions and flows of a system or object over time.

```{mermaid}
stateDiagram-v2
    [*] --> Idle : Launch App
    Idle --> Loading : Double-Click File
    Loading --> Editing : Load Success
    Loading --> ErrorState : File Read Failure
    
    ErrorState --> Idle : Close or Retry
    
    state Editing {
        [*] --> TextModified : Typing Input
        TextModified --> DebounceWaiting : Wait 300ms Debounce
        DebounceWaiting --> Rendered : KaTeX/Mermaid Parsing Complete
        Rendered --> [*] : Save / Idle
    }
    
    Editing --> FullscreenMode : F11 / Double-Click
    FullscreenMode --> Editing : Esc / Double-Click
    Editing --> [*] : Terminate App
```

---

## 5. ER Diagram

Defines structural connectivity and 1:N, N:M relationships between database tables.

```{mermaid}
erDiagram
    WORKSPACE ||--o{ DOCUMENT : "contains"
    DOCUMENT ||--o{ BACKUP_HISTORY : "tracks"
    WORKSPACE {
        string folder_path PK
        string theme_setting
        string last_active_file
    }
    DOCUMENT {
        string relative_path PK
        string file_name
        number file_size
        date last_modified
    }
    BACKUP_HISTORY {
        number version_id PK
        string file_content
        date snapshot_time
    }
```

---

## 6. Pie Chart

Renders ratio, contribution, and market share data with intuitive slice graphics in a circular chart.

```{mermaid}
pie title Resource Allocation in Document Editor Development
    "UI Styling & CSS Enhancement" : 25
    "Mermaid & LaTeX Parsing Tuning" : 30
    "Undo/Redo & Shortcut Interaction" : 25
    "Bottle Backend Proxy Server Integration" : 20
```

---

Mermaid syntax helps you create clean, precise graphics with just a few lines of text. 
Feel free to adapt the skeleton of each chart format and actively apply it to your project analysis and design documents! 🎨
