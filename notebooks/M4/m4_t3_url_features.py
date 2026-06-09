from pathlib import Path
import csv
from collections import Counter
from urllib.parse import urlparse

import re


# Milestone 4 - Task 3: Extract URL features from the labeled URL dataset
# - Load raw malicious_phish.csv (url, type)
# - Binarize the label (0 = benign, 1 = malicious)
# - Deduplicate URLs
# - Extract 11 numerical URL features per URL
# - Save the feature matrix for downstream model training


IP_RE = re.compile(r"^(https?://)?(\d{1,3}\.){3}\d{1,3}")
SHORTENERS = {
    "bit.ly", "tinyurl.com", "goo.gl", "t.co",
    "ow.ly", "is.gd", "buff.ly", "adf.ly",
}


def normalize_url(url: str) -> str:
    u = str(url).strip()
    if not u:
        return ""
    if u.startswith(("http://", "https://")):
        return u
    return f"http://{u}"


def extract_host(url: str) -> str:
    u = normalize_url(url)
    if not u:
        return ""
    try:
        return urlparse(u).netloc.lower().split(":")[0]
    except Exception:
        return ""


def split_host(host: str) -> tuple[str, str, str]:
    parts = [p for p in host.split(".") if p]
    if len(parts) >= 2:
        subdomain = ".".join(parts[:-2])
        domain = parts[-2]
        suffix = parts[-1]
    elif len(parts) == 1:
        subdomain = ""
        domain = parts[0]
        suffix = ""
    else:
        subdomain = ""
        domain = ""
        suffix = ""
    return subdomain, domain, suffix


def is_shortened_host(host: str) -> int:
    subdomain, domain, suffix = split_host(host)
    if domain and suffix:
        registered = f"{domain}.{suffix}"
    else:
        registered = domain or host
    return int(registered in SHORTENERS)


def url_features(url: str) -> dict:
    """Extract numerical features from a single URL string."""
    u = str(url)
    host = extract_host(u)
    subdomain, _, _ = split_host(host)
    return {
        "url_length": len(u),
        "hostname_length": len(host),
        "num_dots": u.count("."),
        "num_hyphens": u.count("-"),
        "num_at": u.count("@"),
        "num_digits": sum(c.isdigit() for c in u),
        "num_special_chars": len(re.findall(r"[@%?=&_~]", u)),
        "has_ip": int(bool(IP_RE.match(u))),
        "has_https": int(u.lower().startswith("https")),
        "num_subdomains": (subdomain.count(".") + 1) if subdomain else 0,
        "is_shortened": is_shortened_host(host),
    }


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    input_path = project_root / "data" / "raw" / "urls" / "malicious_phish.csv"
    output_dir = project_root / "data" / "processed"
    output_path = output_dir / "url_features.csv"

    # 1) Load raw URL dataset
    with input_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        raise ValueError("Input CSV is empty.")

    columns = list(rows[0].keys())
    if "url" not in columns or "type" not in columns:
        raise ValueError("Input CSV must include 'url' and 'type' columns.")

    print(f"Loaded: {input_path}")
    print(f"Columns: {columns}")
    print(f"Total rows loaded: {len(rows)}")

    # 2) Show raw type distribution
    print("\nRaw type distribution:")
    raw_type_counts = Counter(row.get("type", "") for row in rows)
    for key, count in raw_type_counts.most_common():
        print(f"{key}: {count}")

    # 3) Binarize label: 0 = benign, 1 = malicious (phishing/defacement/malware)
    for row in rows:
        row["label"] = 0 if row.get("type", "") == "benign" else 1

    # 4) Deduplicate on URL
    rows_before = len(rows)
    deduped_rows = []
    seen_urls = set()
    for row in rows:
        url = str(row.get("url", ""))
        if url in seen_urls:
            continue
        seen_urls.add(url)
        deduped_rows.append(row)
    rows_after = len(deduped_rows)

    print(f"\nRows before dedup: {rows_before}")
    print(f"Rows after dedup:  {rows_after}")
    print(f"Duplicates removed: {rows_before - rows_after}")

    print("\nBinary label distribution (0=benign, 1=malicious):")
    label_counts = Counter(row["label"] for row in deduped_rows)
    for key, count in sorted(label_counts.items()):
        print(f"{key}: {count}")

    # 5) Extract URL features
    print("\nExtracting URL features...")
    out_rows = []
    sample_row = None
    for row in deduped_rows:
        feats = url_features(row.get("url", ""))
        combined = {"url": row.get("url", ""), "label": row["label"], **feats}
        out_rows.append(combined)
        if sample_row is None:
            sample_row = combined

    feature_columns = [
        "url_length",
        "hostname_length",
        "num_dots",
        "num_hyphens",
        "num_at",
        "num_digits",
        "num_special_chars",
        "has_ip",
        "has_https",
        "num_subdomains",
        "is_shortened",
    ]

    print(f"\nFeature columns ({len(feature_columns)}): {feature_columns}")
    print("\nSample of extracted features:")
    if sample_row is not None:
        print(sample_row)

    # 6) Save feature matrix
    output_dir.mkdir(parents=True, exist_ok=True)
    output_columns = ["url", "label", *feature_columns]
    with output_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=output_columns)
        writer.writeheader()
        writer.writerows(out_rows)

    print(
        f"\nSaved feature matrix: {output_path} "
        f"({len(out_rows)} rows, {len(feature_columns)} features)"
    )


if __name__ == "__main__":
    main()
