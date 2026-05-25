# 🧪 Chemical Formula (SMILES) Visualization Guide

In AG Studio, you can easily render high-resolution 2D vector chemical structures using only text, thanks to the **SMILES (Simplified Molecular-Input Line-Entry System)** standard chemical structure notation!

Simply specify the code block language as `smiles` and enter the molecular formula string, and it will be automatically visualized as a beautiful chemical structure model.

---

## ☕ 1. Caffeic acid
SMILES: `OC(=O)/C=C/c1ccc(O)c(O)c1`

```smiles
OC(=O)/C=C/c1ccc(O)c(O)c1
```

---

## 🍇 2. Gallic acid
SMILES: `OC(=O)c1cc(O)c(O)c(O)c1`

```smiles
OC(=O)c1cc(O)c(O)c(O)c1
```

---

## 🌿 3. Cinnamic acid
SMILES: `OC(=O)/C=C/c1ccccc1`

```smiles
OC(=O)/C=C/c1ccccc1
```

---

## 💎 4. Benzene ring
SMILES: `c1ccccc1`

```smiles
c1ccccc1
```

---

## 💡 SMILES Notation Quick Tip
SMILES is a global chemistry standard that represents chemical structures as one-dimensional strings using element and bond symbols.
- **Element Symbols**: `C` (Carbon), `O` (Oxygen), `N` (Nitrogen), `H` (Hydrogen - usually omitted and automatically rendered as skeletal lines)
- **Single Bond**: No symbol (e.g., `CC` is ethane)
- **Double Bond**: `=` (e.g., `C=C` is ethylene)
- **Triple Bond**: `#` (e.g., `C#C` is acetylene)
- **Ring Structure**: Formed by attaching numbers after the starting and ending elements (e.g., benzene is `c1ccccc1`)
- **Branch Structure**: Represented with parentheses `()`
