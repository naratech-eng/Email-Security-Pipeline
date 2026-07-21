# Demo: Real Mail Clients — Live Delivery vs Quarantine

**Goal:** demonstrate the pipeline with real desktop email clients. User A (Thunderbird) emails User B (Outlook) through our Postfix/Dovecot server. A benign email lands in B's inbox; a malicious one is automatically classified and **quarantined** so it never reaches B — and the operator sees both in the dashboard.

> Scope note: A and B are both mailboxes on **our** server, so all mail flows through our `content_filter` regardless of direction. True outbound DLP (our user → the public internet) is out of scope (PRD W-03) and not needed for this demo.

---

## 1. Architecture

```
Thunderbird (User A) --SMTP 587/STARTTLS--> Postfix (submission)
                                              |
                                              v
                                        content_filter --> Inference API (classify email + URLs)
                                              |
                         benign -------------/ \------------- phishing
                          |                                      |
                  deliver to B's Maildir                 divert to quarantine Maildir
                          |                                      |
        Outlook (User B) <--IMAP 993/SSL-- Dovecot         operator reviews via dashboard
```

Clients use two protocols: **IMAP (993)** to read mail, **SMTP submission (587)** to send. Port 25 is only for server-to-server mail with the outside world — **not used** for this local A→B demo.

---

## 2. Server prerequisites

### 2.1 Postfix submission (587) — `master.cf`
```
submission inet n - y - - smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_sasl_type=dovecot
  -o smtpd_sasl_path=private/auth
  -o smtpd_client_restrictions=permit_sasl_authenticated,reject
  -o content_filter=phishfilter:dummy
```

### 2.2 content_filter transport — `master.cf`
```
phishfilter unix - n n - 10 pipe
  flags=Rq user=filter null_sender=
  argv=/opt/esp/content_filter.sh -f ${sender} -- ${recipient}
```
The script POSTs the message to the inference API, then **re-injects benign mail** (`sendmail -G -i`) or **delivers phishing to the quarantine mailbox** based on the verdict. Fail-open: on API error/timeout, re-inject normally with an `X-Phish-Score: unavailable` header (PRD S-07).

### 2.3 Dovecot — IMAP 993 + SASL auth socket
- Enable `imaps` (993) and the `auth` Unix socket at `private/auth` for Postfix SASL.
- Mail location: Maildir per user. Add a `Quarantine` mailbox/namespace (or a dedicated `quarantine@` account the operator reads).

### 2.4 TLS certificate (do this before the demo)
```
sudo certbot certonly --standalone -d mail.naratech.xyz
```
Point Postfix `smtpd_tls_cert_file` / `smtpd_tls_key_file` and Dovecot `ssl_cert` / `ssl_key` at the issued cert. **Use a real cert** — Outlook rejects self-signed and will derail the demo.

### 2.5 Mailboxes
Create `alice@naratech.xyz` and `bob@naratech.xyz` with passwords (system users or Dovecot virtual users).

### 2.6 Security group
Allow inbound **587** and **993** from the demo laptops' public IPs. (No need to expose 25 for this demo.)

---

## 3. Client setup (two accounts, two clients)

| Setting | Value |
|---|---|
| Incoming (IMAP) | `mail.naratech.xyz` · port **993** · SSL/TLS · normal password |
| Outgoing (SMTP) | `mail.naratech.xyz` · port **587** · STARTTLS · normal password |
| Account A | user `alice@naratech.xyz` — in **Thunderbird** (sender) |
| Account B | user `bob@naratech.xyz` — in **Outlook** (recipient inbox shown on screen) |

**Client choice:**
- **Thunderbird** — easiest; manual IMAP/SMTP config, accepts certs with one click. Use for User A.
- **Outlook (classic desktop)** — works but fussy about TLS; needs the real Let's Encrypt cert. Use for User B so the "clean inbox" is the polished side.

---

## 4. The demo

1. **Operator** opens the dashboard (Cognito login), sits on the Detections view.
2. **Alice (Thunderbird)** → new email to `bob@` · subject "Lunch tomorrow?" · body "Are we still on for 12?" → Send.
   - ✅ Arrives in **Bob's Outlook inbox** within seconds. Dashboard shows a **benign** row.
3. **Alice** → new email to `bob@` · subject "Your account is on hold" · body "Verify now: hxxp://bit.ly/x9verify" → Send.
   - ✅ **Does not appear** in Bob's inbox — diverted to **quarantine**. Dashboard shows a **phishing** row with score, classification, and the flagged URL.
4. Talking point: same server, same path — only the model's verdict differs, and no human acted.

Pre-load 3–4 sample bodies from `email_test.csv` so each send is copy-paste.

---

## 5. Where to look (verification)
- **Bob's inbox** (Outlook) — benign arrives, phishing absent
- **Quarantine** mailbox — the phishing message, with `X-Phish-Score` header
- **Dashboard** — both detections, `source = server`
- **Mail log** — `sudo tail -f /var/log/maillog` shows the filter verdict per message

---

## 6. Gotchas
- **TLS cert:** issue Let's Encrypt for `mail.naratech.xyz` ahead of time — Outlook will not accept self-signed.
- **Port 25:** AWS throttles it, but the demo doesn't need it (local delivery + submission on 587).
- **SASL/auth:** if clients can't send, check the Dovecot `private/auth` socket and `smtpd_sasl_path`.
- **Fail-open:** if the API is down mid-demo, mail still flows (tagged `unavailable`) — by design.

---

## 7. Task mapping
| Need | Task |
|---|---|
| Submission 587 + IMAP 993 + SASL + Let's Encrypt + mailboxes | **M7-T17** (this runbook) |
| Quarantine routing + header | **M7-T5** |
| content_filter script + fail-open | **M7-T9**, **M7-T16** |
| Detections visible to operator | **M7-T13**, **M7-T15** |
| End-to-end verification | **M7-T6** |
