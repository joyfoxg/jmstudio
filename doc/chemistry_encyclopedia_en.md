# 🧪 Organic/Inorganic Chemical Structure Encyclopedia (SMILES)

This encyclopedia is a high-quality markdown chemical directory that systematically classifies the most important **organic/inorganic chemical substances, everyday molecules, medicines, and biochemicals** in human chemical history, and visualizes them as 2D vector structural formulas using text-based **SMILES** notation.

---

## Ⅰ. Basic Inorganic/Organic Chemical Compounds (Basic Compounds)

These are the most fundamental molecules essential for life activities and industrial chemistry.

### 1. Water - $H_2O$
```smiles
O
```

### 2. Carbon Dioxide - $CO_2$
```smiles
O=C=O
```

### 3. Ammonia - $NH_3$
```smiles
N
```

### 4. Sulfuric Acid - $H_2SO_4$
```smiles
OS(=O)(=O)O
```

### 5. Methane - $CH_4$
```smiles
C
```

---

## Ⅱ. Key Everyday Organic Compounds (Common Organic Compounds)

These are organic molecules centered around functional groups commonly encountered in daily life.

### 6. Ethanol - Alcohol
```smiles
CCO
```

### 7. Acetic Acid - Component of Vinegar
```smiles
CC(=O)O
```

### 8. Acetone - Nail Polish Remover
```smiles
CC(=O)C
```

### 9. Formaldehyde - Substance Causing Sick Building Syndrome
```smiles
C=O
```

---

## Ⅲ. Aromatic Rings and Benzene Derivatives (Aromatic Derivatives)

These are conjugated ring compounds that are fragrant or highly stable, serving as the backbone of the chemical industry.

### 10. Benzene - The Origin of Aromatics
```smiles
c1ccccc1
```

### 11. Toluene - Organic Solvent
```smiles
Cc1ccccc1
```

### 12. Phenol - Carbolic Acid
```smiles
Oc1ccccc1
```

### 13. Aniline - Basic Material for Dyes
```smiles
Nc1ccccc1
```

### 14. Benzoic Acid - Preservative
```smiles
C(=O)(O)c1ccccc1
```

---

## Ⅳ. Biochemicals and Metabolites (Biomolecules)

These are large organic molecules that play key roles in the metabolism, energy transfer, and biological regulation of living organisms.

### 15. Glucose - Energy Source of Living Organisms
```smiles
OCC1OC(O)C(O)C(O)C1O
```

### 16. Glycine - The Simplest Amino Acid
```smiles
NCC(=O)O
```

### 17. Alanine - Protein-Constituent Amino Acid
```smiles
CC(N)C(=O)O
```

### 18. Adenosine Triphosphate (ATP) - Energy Currency of Living Organisms
```smiles
C1=NC(=C2C(=N1)N(C=N2)C3C(C(C(O3)COP(=O)(O)OP(=O)(O)OP(=O)(O)O)O)O)N
```

---

## Ⅴ. Famous Pharmacological Agents and Neurotransmitters (Pharmacological Agents)

These are pharmacologically active molecules that have made significant contributions to curing human diseases or act on the central nervous system.

### 19. Aspirin - Antipyretic, Anti-inflammatory, and Analgesic
```smiles
CC(=O)Oc1ccccc1C(=O)O
```

### 20. Paracetamol / Acetaminophen - Tylenol
```smiles
CC(=O)Nc1ccc(O)cc1
```

### 21. Ibuprofen - Component of Advil
```smiles
CC(C)Cc1ccc(cc1)C(C)C(=O)O
```

### 22. Caffeine - Alertness-Inducing Substance in Coffee
```smiles
CN1C=NC2=C1C(=O)N(C(=O)N2C)C
```

### 23. Nicotine - Dependency-Inducing Substance in Tobacco
```smiles
CN1CCCC1c2cccnc2
```

### 24. Penicillin G - The First Antibiotic
```smiles
CC1(C(N2C(S1)C(C2=O)NC(=O)Cc3ccccc3)C(=O)O)C
```

---

## 💡 How to Draw Your Own SMILES Formula Summary

If you want to construct a new chemical molecular formula yourself, apply the standard rules below and write them in your markdown file.

1. **Element Symbols**: `C` (Carbon), `O` (Oxygen), `N` (Nitrogen), `P` (Phosphorus), `S` (Sulfur), `F` (Fluorine), `Cl` (Chlorine), etc.
2. **Multiple Bonds**: `C=C` (double bond), `C#N` (triple bond).
3. **Ring Formation**: Assign the same number (e.g., `1`) immediately after the starting and ending elements of the ring, and they will be connected circularly by a bond line (e.g., `c1ccccc1` benzene ring).
4. **Branch Structure (Side Chain)**: Branches extending sideways from the backbone bond line are represented by enclosing them in parentheses `()` (e.g., propan-2-ol is `CC(O)C`).
