
import pandas as pd
import re

print("Loading dataset...")

df = pd.read_csv("data/processed/emails_clean.csv")

URGENCY_WORDS = [
    'urgent', 'immediately', 'verify', 'suspended', 'limited',
    'action required', 'click here', 'confirm', 'account',
    'password', 'update', 'expire', 'unusual activity', 'security alert'
]

def urgency_score(text):
    text = str(text).lower()
    return sum(1 for w in URGENCY_WORDS if w in text)

def count_links(text):
    return len(re.findall(r'https?://[^\s]+', str(text)))

def html_ratio(text):
    text = str(text)
    html_tags = len(re.findall(r'<[^>]+>', text))
    total = len(text)
    return round(html_tags / total, 4) if total > 0 else 0

def word_count(text):
    return len(str(text).split())

def avg_word_length(text):
    words = str(text).split()
    return round(
        sum(len(w) for w in words) / len(words),
        2
    ) if words else 0

print("Extracting features...")

df["urgency_score"] = df["text_combined"].apply(urgency_score)
df["link_count"] = df["text_combined"].apply(count_links)
df["html_ratio"] = df["text_combined"].apply(html_ratio)
df["word_count"] = df["text_combined"].apply(word_count)
df["avg_word_length"] = df["text_combined"].apply(avg_word_length)

df = df.fillna(0)

df[
    [
        "label",
        "urgency_score",
        "link_count",
        "html_ratio",
        "word_count",
        "avg_word_length"
    ]
].to_csv(
    "data/processed/emails_body_features.csv",
    index=False
)

print("Rows:", len(df))
print("Saved: data/processed/emails_body_features.csv")
