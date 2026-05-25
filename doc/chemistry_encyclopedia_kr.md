# 🧪 유기/무기 화학 구조식 대백과사전 (SMILES)

이 백과사전은 인류 화학사에서 가장 중요한 **주요 유기/무기 화학 물질, 일상 속 분자, 의약품, 생화학 물질**을 체계적으로 분류하고, 이를 텍스트 기반의 **SMILES** 기법을 사용하여 2D 벡터 구조식으로 시각화한 최고 수준의 마크다운 화학 도감입니다.

---

## Ⅰ. 기초 무기/유기 화학 물질 (Basic Compounds)

가장 기초적이고 생명 활동 및 산업 화학에 필수적인 분자들입니다.

### 1. 물 (Water) - $H_2O$
```smiles
O
```

### 2. 이산화탄소 (Carbon Dioxide) - $CO_2$
```smiles
O=C=O
```

### 3. 암모니아 (Ammonia) - $NH_3$
```smiles
N
```

### 4. 황산 (Sulfuric Acid) - $H_2SO_4$
```smiles
OS(=O)(=O)O
```

### 5. 메탄 (Methane) - $CH_4$
```smiles
C
```

---

## Ⅱ. 핵심 일상 유기 화합물 (Common Organic Compounds)

생활 속에서 쉽게 접할 수 있는 기능기(Functional Group) 중심의 유기 분자들입니다.

### 6. 에탄올 (Ethanol) - 알코올
```smiles
CCO
```

### 7. 아세트산 (Acetic Acid) - 식초 성분
```smiles
CC(=O)O
```

### 8. 아세톤 (Acetone) - 네일 리무버
```smiles
CC(=O)C
```

### 9. 포름알데히드 (Formaldehyde) - 새집증후군 유발 물질
```smiles
C=O
```

---

## Ⅲ. 아로마틱 고리 및 벤젠계 유도체 (Aromatic Derivatives)

향기가 나거나 안정성이 높아 화학 산업 전반의 뼈대가 되는 공액 고리 화합물들입니다.

### 10. 벤젠 (Benzene) - 아로마틱의 시초
```smiles
c1ccccc1
```

### 11. 톨루엔 (Toluene) - 유기 용제
```smiles
Cc1ccccc1
```

### 12. 페놀 (Phenol) - 석탄산
```smiles
Oc1ccccc1
```

### 13. 아닐린 (Aniline) - 염료 기초 물질
```smiles
Nc1ccccc1
```

### 14. 벤조산 (Benzoic Acid) - 보존제
```smiles
C(=O)(O)c1ccccc1
```

---

## Ⅳ. 생화학 및 신진대사 물질 (Biomolecules)

생명체의 신진대사, 에너지 전달, 생체 조절에 핵심적인 역할을 수행하는 대형 유기 분자들입니다.

### 15. 포도당 (Glucose) - 생물체의 에너지원
```smiles
OCC1OC(O)C(O)C(O)C1O
```

### 16. 글리신 (Glycine) - 가장 단순한 아미노산
```smiles
NCC(=O)O
```

### 17. 알라닌 (Alanine) - 단백질 구성 아미노산
```smiles
CC(N)C(=O)O
```

### 18. 아데노신 삼인산 (ATP) - 생명체의 에너지 화폐
```smiles
C1=NC(=C2C(=N1)N(C=N2)C3C(C(C(O3)COP(=O)(O)OP(=O)(O)OP(=O)(O)O)O)O)N
```

---

## Ⅴ. 유명 약리학 물질 및 신경 전달 물질 (Pharmacological Agents)

인류의 질병 치료에 지대한 공헌을 하거나 중추신경계에 작용하는 약리학적 활성 분자들입니다.

### 19. 아스피린 (Aspirin) - 해열소염진통제
```smiles
CC(=O)Oc1ccccc1C(=O)O
```

### 20. 아세트아미노펜 (Paracetamol / Acetaminophen) - 타이레놀
```smiles
CC(=O)Nc1ccc(O)cc1
```

### 21. 이부프로펜 (Ibuprofen) - 애드빌 성분
```smiles
CC(C)Cc1ccc(cc1)C(C)C(=O)O
```

### 22. 카페인 (Caffeine) - 커피 속 각성 물질
```smiles
CN1C=NC2=C1C(=O)N(C(=O)N2C)C
```

### 23. 니코틴 (Nicotine) - 담배 속 의존성 유발 물질
```smiles
CN1CCCC1c2cccnc2
```

### 24. 페니실린 G (Penicillin G) - 최초의 항생제
```smiles
CC1(C(N2C(S1)C(C2=O)NC(=O)Cc3ccccc3)C(=O)O)C
```

---

## 💡 나만의 SMILES 화학식 그리는 법 요약

새로운 화학 분자식을 직접 구성해 보려면 아래 정규 규칙을 응용하여 마크다운 파일에 적어보세요.

1. **원소 기호**: `C`(탄소), `O`(산소), `N`(질소), `P`(인), `S`(황), `F`(불소), `Cl`(염소) 등.
2. **다중 결합**: `C=C` (이중결합), `C#N` (삼중결합).
3. **고리 형성**: 고리를 이루는 시점과 종점 원소 바로 뒤에 동일한 숫자(예: `1`)를 부여하면 그 둘이 결합선으로 동그랗게 연결됩니다. (예: `c1ccccc1` 벤젠고리)
4. **가지 구조(측쇄)**: 뼈대 결합선에서 옆으로 갈라져 나온 가지는 소괄호 `()`로 묶어 표현합니다. (예: 프로판-2-올은 `CC(O)C`)
