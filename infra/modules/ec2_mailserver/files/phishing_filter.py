#!/usr/bin/env python3
# M7-T4 content_filter: scores each message via the API, tags
# X-Phishing-Verdict/X-Phishing-Score, re-injects. Fails open on error.
#
# Fetched from S3 at boot rather than embedded in cloud-init's user_data --
# the script had grown large enough (plus M7-T16's circuit breaker, plus
# M7-T17's cert automation) to blow EC2's 16384-byte user_data limit.
# API_URL comes from /etc/esp/api-url (written by cloud-init) rather than
# being templated into this file, so the script itself is environment-free
# and can be uploaded as a plain static object.
import fcntl
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

API_URL_FILE = "/etc/esp/api-url"
TOKEN_FILE = "/etc/esp/api-token"
TIMEOUT = 45  # first call after an ECS task start loads models from S3 (~20-40s); warm calls are ~0.3s
SENDMAIL = "/usr/sbin/sendmail"

# M7-T16: skip the API entirely once it looks down, instead of paying a
# 45s timeout per message during an outage. Threshold/cooldown state is a
# file, since the pipe transport (max_proc=10) forks a fresh process per
# message -- nothing survives between invocations otherwise.
CIRCUIT_STATE = "/etc/esp/circuit-state.json"
CIRCUIT_THRESHOLD = 3
CIRCUIT_COOLDOWN = 60


def read_api_url():
    try:
        with open(API_URL_FILE) as f:
            base = f.read().strip()
        return base + "/analyze/email" if base else None
    except Exception:
        return None


def read_token():
    try:
        with open(TOKEN_FILE) as f:
            return f.read().strip()
    except Exception:
        return None


def _circuit_read():
    try:
        with open(CIRCUIT_STATE) as f:
            return json.load(f)
    except Exception:
        return {"failures": 0, "opened_at": 0}


def circuit_is_open():
    s = _circuit_read()
    if s.get("failures", 0) < CIRCUIT_THRESHOLD:
        return False
    return (time.time() - s.get("opened_at", 0)) < CIRCUIT_COOLDOWN


def circuit_record(success: bool):
    # flock + write-to-temp-then-rename: concurrent pipe workers must not
    # tear each other's JSON writes.
    with open(CIRCUIT_STATE + ".lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        s = _circuit_read()
        if success:
            s = {"failures": 0, "opened_at": 0}
        else:
            s["failures"] = s.get("failures", 0) + 1
            if s["failures"] >= CIRCUIT_THRESHOLD:
                s["opened_at"] = time.time()
        tmp = CIRCUIT_STATE + ".tmp"
        with open(tmp, "w") as f:
            json.dump(s, f)
        os.replace(tmp, CIRCUIT_STATE)


def score(raw_message: bytes):
    if circuit_is_open():
        sys.stderr.write("phishing_filter: circuit open, skipping API, failing open\n")
        return None

    api_url = read_api_url()
    if not api_url:
        sys.stderr.write("phishing_filter: no API URL configured, failing open\n")
        return None

    token = read_token()
    boundary = "----espfilterboundary"
    # source=server tags mail-path detections (vs dashboard upload/paste)
    body = (
        ("--" + boundary + "\r\n"
         'Content-Disposition: form-data; name="source"\r\n\r\n'
         "server\r\n"
         "--" + boundary + "\r\n"
         'Content-Disposition: form-data; name="file"; filename="msg.eml"\r\n'
         "Content-Type: message/rfc822\r\n\r\n").encode()
        + raw_message
        + ("\r\n--" + boundary + "--\r\n").encode()
    )
    headers = {"Content-Type": "multipart/form-data; boundary=" + boundary}
    if token:
        headers["Authorization"] = "Bearer " + token

    req = urllib.request.Request(api_url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            result = json.loads(resp.read())
        circuit_record(True)
        return result
    except Exception as e:
        sys.stderr.write("phishing_filter: API call failed, failing open: " + str(e) + "\n")
        circuit_record(False)
        return None


def tag_headers(raw_message: bytes, verdict_json) -> bytes:
    if verdict_json is None:
        return raw_message  # fail open — deliver unmodified
    verdict = verdict_json.get("verdict", "clean")
    likelihood = verdict_json.get("likelihood", 0)
    header = ("X-Phishing-Verdict: " + str(verdict) + "\r\n"
               "X-Phishing-Score: " + str(likelihood) + "\r\n").encode()
    return header + raw_message


def deliver(message: bytes, sender: str, recipients: list) -> int:
    # -G skips content_filter again (no re-scoring loop); -i keeps a
    # lone "." line from being treated as end-of-message.
    proc = subprocess.run(
        [SENDMAIL, "-G", "-i", "-f", sender, "--"] + recipients,
        input=message,
    )
    return proc.returncode


def main():
    args = sys.argv[1:]
    if "-f" not in args or "--" not in args:
        sys.stderr.write("usage: phishing_filter.py -f <sender> -- <recipient...>\n")
        sys.exit(1)
    sender = args[args.index("-f") + 1]
    recipients = args[args.index("--") + 1:]
    raw = sys.stdin.buffer.read()

    try:
        verdict_json = score(raw)
        out = tag_headers(raw, verdict_json)
    except Exception as e:
        sys.stderr.write("phishing_filter: unexpected error, failing open: " + str(e) + "\n")
        out = raw  # never lose or block mail

    sys.exit(deliver(out, sender, recipients))


if __name__ == "__main__":
    main()
