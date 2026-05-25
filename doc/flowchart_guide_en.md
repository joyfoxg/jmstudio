# 📊 Mermaid Flowchart Detailed Guide

A flowchart is the **most widely used visualization diagram** in software engineering for business process diagrams, system data flows, business logic design, etc.
This guide comprehensively describes the layout directions, node shapes, connector lines, and styling techniques of various flowcharts.

> [!TIP]
> For large flowcharts, if the text appears small, hover over the diagram and click the **`[🔍 Original Size]`** toggle to scroll horizontally, or click **`[🖥️ Fullscreen]`** to view it on a larger screen.

---

## 1. Directions

You can declare the default direction in which the flowchart expands in the first line of the code block.

* **`TB` (Top to Bottom)** or **`TD` (Top Down)**: Flows from top to bottom (default)
* **`BT` (Bottom to Top)**: Flows from bottom to top
* **`LR` (Left to Right)**: Flows from left to right (recommended for horizontally long layouts)
* **`RL` (Right to Left)**: Flows from right to left

### A. Horizontal Layout Example (`LR`)
```{mermaid}
flowchart LR
    A[Start] --> B{Data Validation}
    B -- Pass --> C[Save DB]
    B -- Fail --> D[Error Page]
```

### B. Vertical Layout Example (`TB`)
```{mermaid}
flowchart TB
    Start[Draft Plan] --> Design[UI/UX Design]
    Design --> Develop[Backend/Frontend Dev]
    Develop --> QA[Quality Assurance Test]
    QA --> Release[Production Release]
```

---

## 2. Node Shapes

Depending on the type of brackets enclosing a node, you can describe various shapes such as rectangles, circles, diamonds, and cylinders.

| Shape | Syntax Structure | Rendered Example | Usage |
| :--- | :--- | :---: | :--- |
| **Default Rectangle** | `id[text]` | `A[Rectangle]` | General processing steps |
| **Round Edged Rectangle** | `id(text)` | `B(Round Rectangle)` | Start and end points |
| **Stadium (Oval)** | `id([text])` | `C([Oval])` | Start/end capsules |
| **Subroutine** | `id[[text]]` | `D[[Subroutine]]` | Separately defined modules |
| **Cylinder (Database)** | `id[(text)]` | `E[(Database)]` | Data storage, RDBMS |
| **Circle** | `id((text))` | `F((Circle))` | Start flag, connector |
| **Asymmetric (Flag)** | `id>text]` | `G>Flag]` | Events, asymmetric info |
| **Diamond (Decision)** | `id{text}` | `H{Decision}` | Conditionals, branching |

```{mermaid}
flowchart LR
    node1([Oval Capsule]) --> node2[[Subroutine]]
    node2 --> node3[(Oracle DB)]
    node3 --> node4{Branch Validation}
    node4 -- YES --> node5((Success))
    node4 -- NO --> node6>Error Occurred]
```

---

## 3. Lines & Labels

You can write rich link styles connecting nodes and text labels placed on the links.

* **Default Arrow**: `-->`
* **Text Label on Link**: `-->|Label|` or `-- Label -->`
* **Line without Arrow**: `---`
* **Dotted Arrow**: `-.->` or `-. Label .->`
* **Thick Arrow**: `==>` or `== Label ==>`
* **Bidirectional Arrow**: `<-->`

```{mermaid}
flowchart LR
    A[User] ==>|Heavy Call| B[Backend API]
    B ---|Pure Physical Line| C[Hardware Sensor]
    B -.->|Async Dotted Event| D[Push Notification Server]
    B <-->|Bidirectional Sync| E[Redis Session Cache]
```

---

## 4. Subgraphs

Groups logical areas (e.g., client side, backend side, external infrastructure) into box structures within a larger flow.

```{mermaid}
flowchart TB
    subgraph Client [User Browser]
        UI[Editor UI] -->|Ctrl+S| SaveHandler[Save Handler]
    end

    subgraph Server [Bottle Python Server]
        SaveHandler -->|POST /save| Route[Routing Function]
        Route -->|Data Processing| SaveApi[MdViewerApi.save_file]
    end

    subgraph Storage [Local Disk Storage]
        SaveApi -->|Write to Disk| Disk[OS File System]
    end
    
    %% Subgraph style customization
    style Client fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#ffffff
    style Server fill:#0b132b,stroke:#10b981,stroke-width:2px,color:#ffffff
    style Storage fill:#1c1d22,stroke:#f59e0b,stroke-width:2px,color:#ffffff
```

---

## 5. Custom Styling

Highlight important hotspot nodes by individually specifying background color, border color, and thickness of specific nodes.

* **Style Syntax**: `style [nodeID] fill:[bgColor],stroke:[borderColor],stroke-width:[thickness],color:[textColor]`
* Supports both **CSS color codes** (e.g., `#ff0000`, `rgb(...)`) and **English color names**.

```{mermaid}
flowchart LR
    Normal["Normal Node"] --> Target["★ Core Highlight Node ★"]
    Target --> Complete["Final Completion"]
    
    %% Node style custom
    style Target fill:#ff4757,stroke:#ff6b81,stroke-width:3px,color:#ffffff,stroke-dasharray: 5 5
    style Complete fill:#2ed573,stroke:#2bcbba,stroke-width:2px,color:#ffffff
```

---

Flowcharts significantly reduce maintenance costs when design changes occur in a system. 
Use the templates above to design your own beautiful pipelines or logic flowcharts! 🚀
