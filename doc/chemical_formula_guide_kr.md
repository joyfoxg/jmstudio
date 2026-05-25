# 🧪 화학 분자식 (SMILES) 시각화 가이드

AG Studio에서는 **SMILES (Simplified Molecular-Input Line-Entry System)** 표준 화학 구조식 표기법을 통해 고해상도 벡터 2D 화학 구조식을 텍스트만으로 간단하게 렌더링할 수 있습니다!

코드 블록의 언어를 `smiles`로 지정하고 분자식 문자열을 입력하면 자동으로 아름다운 화학 구조 모형으로 시각화됩니다.

---

## ☕ 1. 카페산 (Caffeic acid)
SMILES: `OC(=O)/C=C/c1ccc(O)c(O)c1`

```smiles
OC(=O)/C=C/c1ccc(O)c(O)c1
```

---

## 🍇 2. 갈산 (Gallic acid)
SMILES: `OC(=O)c1cc(O)c(O)c(O)c1`

```smiles
OC(=O)c1cc(O)c(O)c(O)c1
```

---

## 🌿 3. 신남산 (Cinnamic acid)
SMILES: `OC(=O)/C=C/c1ccccc1`

```smiles
OC(=O)/C=C/c1ccccc1
```

---

## 💎 4. 벤젠 고리 (Benzene ring)
SMILES: `c1ccccc1`

```smiles
c1ccccc1
```

---

## 💡 SMILES 표기법 Quick Tip
SMILES는 원소 기호와 결합 기호를 이용해 화학 구조를 1차원 문자열로 표현하는 세계적인 화학 표준입니다.
- **원소 기호**: `C`(탄소), `O`(산소), `N`(질소), `H`(수소 - 보통 생략되어 골격선으로 자동 렌더링됨)
- **단일 결합**: 기호 없음 (예: `CC`는 에탄)
- **이중 결합**: `=` (예: `C=C`는 에틸렌)
- **삼중 결합**: `#` (예: `C#C`는 아세틸렌)
- **고리(Ring) 구조**: 시작과 끝 원소 뒤에 번호를 붙여 고리 형성 (예: 벤젠은 `c1ccccc1`)
- **가지(Branch) 구조**: 소괄호 `()`로 표현
