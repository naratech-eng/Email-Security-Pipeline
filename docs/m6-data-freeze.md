# M6-T1 Data Freeze

## Objective

Freeze the final train/test datasets reused from M4-T7 for all M6 model training.

## Dataset Splits

### Email Dataset
- Training rows: 65,662
- Testing rows: 16,416

### URL Dataset
- Training rows: 512,895
- Testing rows: 128,224

## Label Mapping

| Label | Meaning |
|---------|---------|
| 0 | Benign |
| 1 | Phishing / Malicious |

Verified in both email and URL datasets.

## Checksums

Generated using SHA256 (see `data/processed/SPLITS.sha256`):

```text
ac6586926d46474aa91384ddf59fc90eaa6f14ff612865dcb97c0a41177813b3  email_train.csv
802a9d6d6865a25aa6f40a1f9559f8fa745dedfa91be9f1db3f5b68011a4547c  email_test.csv
a7e42eddec4799ad828ebfd8b1e52ae2ea04563cc8bda8f1465203c2ecffeaa3  url_train.csv
35e732222b7c0e1bea29e95910ac1e038a21c6cd3fa26bf452e493550be453f2  url_test.csv
```

## Train/Test Leakage Verification

### URL Dataset
- URL overlap count: 0
- No train/test leakage detected.

### Email Dataset
- Text overlap count: 2
- Two duplicate email bodies were found across train and test sets.
- These duplicates already exist in the frozen M4-T7 split.
- No re-splitting was performed.

## Frozen S3 Paths

Splits are stored in the project datasets bucket and must be downloaded from here by all M6 training tasks.

```
s3://email-security-pipeline-datasets/datasets/processed/splits/email_train.csv
s3://email-security-pipeline-datasets/datasets/processed/splits/email_test.csv
s3://email-security-pipeline-datasets/datasets/processed/splits/url_train.csv
s3://email-security-pipeline-datasets/datasets/processed/splits/url_test.csv
```

AWS profile: `lab-user` · Region: `us-east-1`

Download command:

```bash
mkdir -p data/processed
for f in email_train email_test url_train url_test; do
  aws s3 cp s3://email-security-pipeline-datasets/datasets/processed/splits/${f}.csv \
            data/processed/${f}.csv --profile lab-user
done
```

Verify after download (manifest uses bare filenames, so run from inside `data/processed/`):

```bash
# download manifest alongside the CSVs
aws s3 cp s3://email-security-pipeline-datasets/datasets/processed/splits/SPLITS.sha256 \
          data/processed/SPLITS.sha256 --profile lab-user

cd data/processed && sha256sum -c SPLITS.sha256
```

## Verification Notebook

`notebooks/M6/m6_t1_data_freeze.ipynb` — runs all checks programmatically:
- SHA-256 checksum verification against `SPLITS.sha256`
- Row counts and class balance per split
- Train↔test leakage check for both tracks

Run this notebook before starting any M6 model training task.

## References

These frozen datasets are consumed by:

- M6-T2 (email LinearSVC) — `email_train.csv` / `email_test.csv`
- M6-T3 (URL char-CNN) — `url_train.csv` / `url_test.csv`
- M6-T4 (URL Random Forest fallback) — `url_train.csv` / `url_test.csv`
