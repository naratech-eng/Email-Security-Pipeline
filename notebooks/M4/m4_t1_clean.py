from pathlib import Path

import pandas as pd


# Milestone 4 - Task 1: Clean the phishing email dataset
# - Load raw combined dataset
# - Remove duplicate email bodies
# - Check class balance (0 = legitimate, 1 = phishing)
# - Save cleaned dataset for downstream modeling


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    input_path = project_root / "data" / "raw" / "phishing-emails" / "phishing_email.csv"
    output_dir = project_root / "data" / "processed"
    output_path = output_dir / "emails_clean.csv"

    # 1) Load raw dataset
    df = pd.read_csv(input_path)
    print(f"Loaded: {input_path}")
    print(f"Columns: {df.columns.tolist()}")
    print(f"Total rows loaded: {len(df)}")

    # 2) Show class distribution before cleaning
    print("\nClass distribution before dedup:")
    class_counts_before = df["label"].value_counts()
    print(class_counts_before)

    # 3) Remove duplicate emails using combined text field
    rows_before = len(df)
    df = df.drop_duplicates(subset=["text_combined"])
    rows_after = len(df)

    print(f"\nRows before dedup: {rows_before}")
    print(f"Rows after dedup:  {rows_after}")
    print(f"Duplicates removed: {rows_before - rows_after}")

    # 4) Re-check class balance after deduplication
    print("\nClass distribution after dedup:")
    class_counts_after = df["label"].value_counts()
    print(class_counts_after)

    imbalance_ratio = class_counts_after.max() / class_counts_after.min()
    if imbalance_ratio > 3:
        print(f"⚠️  WARNING: imbalance ratio {imbalance_ratio:.1f}:1")
    else:
        print(f"✅ Balance OK: ratio {imbalance_ratio:.1f}:1")

    # 5) Save cleaned dataset
    output_dir.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"\n✅ Saved cleaned dataset: {output_path} ({len(df)} rows)")


if __name__ == "__main__":
    main()