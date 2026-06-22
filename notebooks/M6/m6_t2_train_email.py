"""M6-T2: Train and serialize the email LinearSVC classifier.

Trains on the frozen M4-T7 email splits via the shared M5 harness and saves the
full pipeline (TF-IDF vectorizer + LinearSVC) as a single joblib artifact.

Run from anywhere:
    python notebooks/M6/m6_t2_train_email.py
"""
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "notebooks" / "M5"))

from m5_harness import load_email, email_pipeline

from sklearn.svm import LinearSVC
from sklearn.metrics import f1_score
import joblib

print("Loading frozen email datasets...")

etr, ete = load_email()

print(f"Train rows: {len(etr):,}")
print(f"Test rows : {len(ete):,}")

print("\nBuilding pipeline...")

pipe = email_pipeline(
    LinearSVC(random_state=42)
)

print("\nTraining LinearSVC...")

pipe.fit(etr, etr["label"])

models_dir = REPO_ROOT / "models"
models_dir.mkdir(exist_ok=True)

artifact_path = models_dir / "email_linearsvc.joblib"

joblib.dump(pipe, artifact_path)

print(f"\nModel saved to: {artifact_path}")

preds = pipe.predict(ete)

f1 = f1_score(
    ete["label"],
    preds
)

print(f"\nTest F1 Score: {f1:.4f}")
