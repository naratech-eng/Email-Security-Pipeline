# M5-T7 & M5-T8: Deep-Learning Stretch Comparisons (Sanjeewa Narayana)

**Role:** ML Lead | **Depends on:** M5-T2 (email winner), M5-T3 (URL winner), M4-T7 splits

> Optional stretch comparisons for the M5 report. Both run on **GPU (Google Colab)** — CPU
> training is impractical. They answer one question per track: *does a deep model beat the
> classical winner by enough to justify the extra compute?* Replace each `<value>` after the
> GPU run.

## Why these two models
The classical experiments (M5-T2 email, M5-T3 URL) already use **hand-engineered features**
(TF-IDF, URL structure counts). The deep-learning stretch tests the opposite idea — let the
model learn its own representation from **raw input** — on the setting where each architecture
actually fits:

- **Email → DistilBERT (M5-T7):** transformers are state-of-the-art on natural-language text.
- **URLs → character-level CNN (M5-T8):** URLs aren't natural language, but a char-CNN can pick
  up local character patterns (odd tokens, encodings, look-alike domains) directly from the
  raw string.

Both are scored with the **same M5-T1 metric set** on the **same held-out test split**, so they
drop straight into the comparison table next to the classical models. One difference: deep
models skip the classical 5-fold CV (too expensive), so their `cv_f1` cell is left blank.

---

## M5-T7 — DistilBERT fine-tuned on email text

**Notebook:** `notebooks/M5/m5_t7_distilbert.ipynb` · **Bar to beat:** LinearSVC (M5-T2) **F1 = 0.9903**

### Method
1. Same M4-T7 email splits (65,662 train / 16,416 test), `text_clean` column.
2. Tokenize with `distilbert-base-uncased`, truncate to 256 tokens.
3. Fine-tune 2–3 epochs (HuggingFace `Trainer`, lr 2e-5, batch 16).
4. Evaluate on the held-out test split; log a `DistilBERT (fine-tuned)` row (track=`email`).

### Result
| Model | F1 | ROC-AUC | Precision | Recall | Train time |
| --- | --- | --- | --- | --- | --- |
| LinearSVC (M5-T2, classical) | 0.9903 | 0.9991 | 0.9886 | 0.9919 | ~42 s (CPU) |
| **DistilBERT (M5-T7)** | **0.9942** | 0.9997 | 0.9944 | 0.9939 | ~10,830 s (~3 h, GPU) |

**Verdict: DistilBERT wins, but only barely — +0.0039 F1 (0.9942 vs 0.9903).** The classical
model was already near-perfect, leaving almost no headroom. The gain costs **~258× the training
time** (~3 h GPU vs ~42 s CPU) plus heavier transformer inference in production.
**Recommendation: keep LinearSVC** for the email track in M6/M7 — the DistilBERT gain is real but
far too small to justify the compute and deployment complexity.

---

## M5-T8 — Character-level CNN on raw URLs

**Notebook:** `notebooks/M5/m5_t8_url_cnn.ipynb` · **Bar to beat:** Random Forest (M5-T3) **F1 = 0.866**

### Method
1. Same M4-T7 URL splits (512,895 train / 128,224 test) — the raw `url` string only, **no**
   engineered features.
2. Build a character vocabulary from the training URLs; encode each URL to a fixed 200-char
   integer sequence (index 0 = pad/unknown).
3. Model: `Embedding → parallel Conv1D (widths 3/4/5) → GlobalMaxPool → Dense → sigmoid`, with
   `class_weight` for the ~2:1 imbalance.
4. Train ~5 epochs; evaluate on test; log a `Char-CNN (raw URLs)` row (track=`url`).

### Result
| Model | F1 | ROC-AUC | Precision | Recall | Train time |
| --- | --- | --- | --- | --- | --- |
| Random Forest (M5-T3, engineered) | 0.8660 | 0.9648 | 0.8755 | 0.8567 | ~96 s |
| **Char-CNN (M5-T8)** | **0.9739** | 0.9976 | 0.9709 | 0.9770 | ~642 s (~11 min, GPU) |

**Verdict: the char-CNN decisively beats the engineered-feature model — +0.108 F1 (0.974 vs
0.866)** and +0.033 ROC-AUC. Learning directly from raw URL characters captures obfuscation
patterns the 11 hand-crafted features miss, so the engineered features were leaving real signal
on the table. Cost is modest (~11 min GPU vs ~96 s CPU). **Recommendation: adopt the Char-CNN as
the URL model for M6**, keeping Random Forest as a lightweight CPU fallback.

---

## How this feeds M5-T5
Both rows are in `results/m5_results.csv` alongside the classical models. The two tracks land on
**opposite verdicts**, which is the interesting finding:

- **URL track → the deep model changes the decision.** Char-CNN (F1 0.974) clearly beats Random
  Forest (0.866) at modest cost — worth adopting for M6.
- **Email track → the deep model does not change the decision.** DistilBERT (0.9942) edges
  LinearSVC (0.9903) by 0.4% but at ~258× the cost — keep the classical model.

The lesson: deep learning pays off where the engineered features are weak (raw, adversarial URL
strings) and is not worth it where a cheap linear model already saturates the task (TF-IDF email
text). M5-T5 should record both deep rows but recommend **Char-CNN (URL)** and **LinearSVC
(email)** as the deployment models.
