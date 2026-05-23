# Exploratory Data Analysis (EDA)

## Objective

The purpose of this exploratory analysis was to evaluate whether the selected datasets are appropriate for training AI models to classify phishing emails and malicious URLs.

---

# Dataset 1: Phishing Email Dataset

## Summary

This dataset contains phishing and legitimate email samples used for supervised machine learning classification.

## Findings

### Features
- text_combined
- label

### Observations
- The dataset contains labeled email samples.
- Email content includes suspicious wording and phishing-style language.
- Labels allow supervised machine learning classification.

### Justification

This dataset was selected because it contains realistic phishing email examples and labeled classes that are useful for training AI models to detect phishing attempts.

---

# Dataset 2: Malicious URL Dataset

## Summary

This dataset contains malicious and legitimate URLs.

## Findings

### Features
- url
- type

### Observations
- The dataset includes phishing, benign, malware, and defacement URLs.
- Suspicious URLs contain unusual structures and malicious patterns.
- The dataset supports URL-based phishing detection.

### Justification

This dataset complements the phishing email dataset by allowing the AI system to analyze malicious links commonly embedded inside phishing emails.

---

# Overall Conclusion

The exploratory analysis confirmed that both datasets:
- contain meaningful features,
- include usable class labels,
- contain realistic phishing behavior,
- and are suitable for AI-based phishing detection.

These datasets will be used for preprocessing and machine learning in future milestones.