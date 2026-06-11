# SVM for Text Classification - Step-by-Step Guide

## Overview
This guide walks through training a Support Vector Machine (SVM) classifier for email phishing detection, following the M5 evaluation protocol. By the end, you'll have:

- A working SVM model with TF-IDF features
- Proper cross-validation and test evaluation
- Results logged to a CSV file (comparable across models)
- Understanding of hyperparameter tuning

---

## Prerequisites
Install Python packages:

```
pip install pandas scikit-learn numpy matplotlib
```

---

## Step 1: Generate Sample Dataset
Run:
```
python 02_generate_data.py
```

## Step 2: Train SVM
Run:
```
python 03_train_svm.py
```

## Step 3: View Results
```
type results\m5_results.csv
```
