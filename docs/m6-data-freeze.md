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

Generated using SHA256:

ac6586926d46474aa91384ddf59fc90eaa6f14ff612865dcb97c0a41177813b3  email_train.csv

802a9d6d6865a25aa6f40a1f9559f8fa745dedfa91be9f1db3f5b68011a4547c  email_test.csv

a7e42eddec4799ad828ebfd8b1e52ae2ea04563cc8bda8f1465203c2ecffea3  url_train.csv

35e732222b7c0e1bea29e95910ac1e038a21c6cd3fa26bf452e493550be453f2  url_test.csv

## Train/Test Leakage Verification

### URL Dataset
- URL overlap count: 0
- No train/test leakage detected.

### Email Dataset
- Text overlap count: 2
- Two duplicate email bodies were found across train and test sets.
- These duplicates already exist in the frozen M4-T7 split.
- No re-splitting was performed.

## References

These frozen datasets will be used by:

- M6-T2
- M6-T3
- M6-T4# M6-T1 Data Freeze

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

Generated using SHA256:

```text
ac6586926d46474aa91384ddf59fc90eaa6f14ff612865dcb97c0a41177813b3  email_train.csv
802a9d6d6865a25aa6f40a1f9559f8fa745dedfa91be9f1db3f5b68011a4547c  email_test.csv
a7e42eddec4799ad828ebfd8b1e52ae2ea04563cc8bda8f1465203c2ecffea3   url_train.csv
35e732222b7c0e1bea29e95910ac1e038a21c6cd3fa26bf452e493550be453f2   url_test.csv
