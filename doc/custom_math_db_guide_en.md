# 🧪 Joy Markdown Studio - Custom Math/Formulas Database Guide

Joy Markdown Studio provides a **Custom External Database feature** that allows you to register your own equations, physics formulas, and chemistry reaction equations, enabling you to insert and search them instantly with a single click from the editor sidebar.

Follow this guide to create and register your own `math_db.json` file.

---

## 📁 1. File Name and Placement Path

At startup, the application automatically detects and loads a custom database file if it exists in the designated location.

* **File Name**: Must be named exactly **`math_db.json`**.
* **Placement Path**:
  * **When using the compiled standalone executable (`JoyMarkdownStudio.exe`)**: Place the file in the **same directory (folder)** as the executable `.exe` file.
  * **When running from source code/development environment (`python main.py` etc.)**: Place the file in the **project root directory** (directly under the project folder).

> [!NOTE]
> If an external `math_db.json` file is found in the executable path, the application overrides the internal default math database and switches the sidebar helper to display your custom database.

---

## 📊 2. JSON Data Structure (Schema)

The `math_db.json` file consists of a JSON array of objects formatted as follows:

```json
[
  {
    "category": "category_code_en",
    "name": "Name of the formula/equation",
    "latex": "LaTeX formula code content",
    "keywords": ["keyword1", "keyword2", "keyword3"]
  }
]
```

### 🔑 Detailed Field Descriptions
1. **`category` (Required)**: Determines which category tab the formula belongs to in the sidebar.
   * Built-in Category Codes: `math` (Mathematics), `physics` (Physics), `bio` (Biology/Chemistry), `cs` (Computer Science), `ee` (Electrical Engineering)
   * *Note*: You can use any custom category code (in English), and it will automatically create and categorize them under that tab.
2. **`name` (Required)**: The display name of the formula shown in the sidebar list and mouse-over tooltips.
3. **`latex` (Required)**: The actual **LaTeX formatted formula** to be inserted into the editor. (See Section 3 for crucial formatting rules)
4. **`keywords` (Required)**: An array of words matched when searching in the sidebar search box. Supports both English (case-insensitive) and Korean keywords.

---

## ⚠️ 3. Important LaTeX Formatting Rule in JSON (Backslash Escaping)

In the JSON file specification, the **backslash (`\`)** is treated as an escape character.
Therefore, any backslash (`\`) used in LaTeX syntax must be written as a **double backslash (`\\`)** to be parsed and rendered correctly in the editor.

### 💡 Escaping Examples
* **Standard LaTeX**: `\int_{a}^{b} f(x) \, dx`
* **JSON Value**: `\\int_{a}^{b} f(x) \\, dx` (all backslashes are replaced by `\\`)

* **Standard LaTeX**: `\frac{1}{2}`
* **JSON Value**: `\\frac{1}{2}`

---

## 📝 4. Comprehensive Example (`math_db.json` Template)

You can copy the template below, paste it into a text editor (like Notepad or VS Code), add your own formulas, and save it as `math_db.json`.

```json
[
  {
    "category": "math",
    "name": "Pythagorean Theorem",
    "latex": "a^2 + b^2 = c^2",
    "keywords": ["pythagorean", "triangle", "geometry", "right-angle"]
  },
  {
    "category": "physics",
    "name": "Einstein's Mass-Energy Equivalence",
    "latex": "E = mc^2",
    "keywords": ["einstein", "relativity", "energy", "mass", "gravity"]
  },
  {
    "category": "bio",
    "name": "Photosynthesis Chemical Equation",
    "latex": "6CO_2 + 6H_2O + \\text{Light Energy} \\rightarrow C_6H_{12}O_6 + 6O_2",
    "keywords": ["photosynthesis", "chemical", "reaction", "plants"]
  },
  {
    "category": "cs",
    "name": "Softmax Function",
    "latex": "\\sigma(\\mathbf{z})_i = \\frac{e^{z_i}}{\\sum_{j=1}^K e^{z_j}}",
    "keywords": ["softmax", "ai", "deep-learning", "activation", "neural-network"]
  }
]
```

---

## 🔁 5. Verification and Loading Steps

1. Place your newly created `math_db.json` in the executable folder.
2. Launch (or restart) **Joy Markdown Studio**.
3. Select the **"Formula Input"** tab in the left sidebar.
4. Verify that the categories and formula list have switched to your custom defined file contents.
5. Type search queries (e.g., "photosynthesis" or "pythagorean") in the search box to check if the filtering works.

---

## 🔄 6. Built-in Database Override and Merge Guide

### ⚠️ Internal Database Override Behavior
* While the default built-in database file (`math_db.json`) is packaged inside the executable `.exe` file at compile time, placing an **external `math_db.json` in the executable path will completely override the internal database**. Only the formulas in the external file will be loaded.
* However, basic mathematical symbol buttons (like Greek letters, integration symbol, fraction, etc.) hardcoded in the HTML layout will remain untouched.

### 💡 How to Keep Both Built-in Formulas and Custom Formulas (Merging)
If you want to keep the 180+ built-in advanced academic formulas and simply append your own custom formulas, you can merge them by copying the default file:

1. Copy the default database file from the repository at [frontend/static/data/math_db.json](file:///e:/jm_studio/frontend/static/data/math_db.json).
2. Save (paste) it as `math_db.json` in the same folder where your compiled executable (`.exe`) is located.
3. Open this external `math_db.json` with a text editor.
4. Scroll to the bottom of the file, locate the closing bracket (`]`), add a **comma (`,`)** after the last curly brace (`}`), and paste your custom formula objects.
   ```json
       // (Example of the end of the last built-in formula)
       "keywords": ["nyquist", "sampling", "rate", "frequency", "나퀴스트", "샘플링"]
     }, // <--- Add a comma here!
     { // <--- Start writing your own custom formulas
       "category": "math",
       "name": "My Custom Formula",
       "latex": "y = ax + b",
       "keywords": ["linear-equation", "slope"]
     }
   ]
   ```
5. Save the file and start the program. Both the built-in formulas and your new custom equations will be loaded and searchable.
