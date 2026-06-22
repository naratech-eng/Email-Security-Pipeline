import sys
from pathlib import Path

sys.path.insert(0, "notebooks/M5")

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

Path("models").mkdir(exist_ok=True)

artifact_path = "models/email_linearsvc.joblib"

joblib.dump(pipe, artifact_path)

print(f"\nModel saved to: {artifact_path}")

preds = pipe.predict(ete)

f1 = f1_score(
    ete["label"],
    preds
)

print(f"\nTest F1 Score: {f1:.4f}")