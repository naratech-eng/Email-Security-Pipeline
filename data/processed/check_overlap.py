import pandas as pd

email_train = pd.read_csv("email_train.csv")
email_test = pd.read_csv("email_test.csv")

email_overlap = set(email_train["text_clean"]).intersection(
    set(email_test["text_clean"])
)

print("Email overlap:", len(email_overlap))

url_train = pd.read_csv("url_train.csv")
url_test = pd.read_csv("url_test.csv")

url_overlap = set(url_train["url"]).intersection(
    set(url_test["url"])
)

print("URL overlap:", len(url_overlap))
