import pandas as pd
import re
from bs4 import BeautifulSoup

print("Loading dataset...")

df = pd.read_csv("data/processed/emails_clean.csv")

print("Rows:", len(df))


def strip_html(text):
    if pd.isna(text):
        return ""
    return BeautifulSoup(str(text), "html.parser").get_text(separator=" ")


df["text_clean"] = df["text_combined"].apply(strip_html)

df["text_clean"] = df["text_clean"].str.lower()


def strip_headers(text):
    lines = text.split("\n")
    body_lines = [
        l for l in lines
        if not re.match(
            r"^(received:|x-mailer:|message-id:|mime-version:|content-type:|from:|to:|subject:|date:)",
            l.strip(),
            re.I,
        )
    ]
    return " ".join(body_lines).strip()


df["text_clean"] = df["text_clean"].apply(strip_headers)

df["text_clean"] = df["text_clean"].apply(
    lambda x: re.sub(r"http\S+|www\.\S+", " ", x)
)

df["text_clean"] = df["text_clean"].apply(
    lambda x: re.sub(r"\S+@\S+", " ", x)
)

df["text_clean"] = df["text_clean"].apply(
    lambda x: re.sub(r"\s+", " ", x).strip()
)
df["text_clean"] = df["text_clean"].fillna("empty_email")

df[["text_clean", "label"]].to_csv(
    "data/processed/emails_normalized.csv",
    index=False
)

print("Saved:", len(df), "rows")
print("Output: data/processed/emails_normalized.csv")
