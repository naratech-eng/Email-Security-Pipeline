# M7-T4/T5/T6 — Mail Filter Testing Guide

**Covers:** Postfix `content_filter` (T4), Dovecot Sieve quarantine routing (T5), end-to-end verification (T6).

---

## 1. What's actually running

Every inbound message to the mail server passes through this chain before it lands in a mailbox:

```
Postfix (SMTP, port 25)
  → content_filter: /usr/local/bin/phishing_filter.py
      → POST /analyze/email (internal ALB, real M6 models)
      → tags X-Phishing-Verdict / X-Phishing-Score headers
      → fails open on any error (never blocks or loses mail)
  → re-injected into Postfix (sendmail -G)
  → Dovecot LMTP delivery
      → Sieve: X-Phishing-Verdict: quarantine → "Quarantine" folder
      → everything else → INBOX
```

## 2. ⚠️ Known limitation — attachments are not scanned

Only the email **body text** (and the `Reply-To`/`List-Unsubscribe` headers) is analyzed. Confirmed directly in `backend/mime_parser.py`: `body_text` explicitly skips any MIME part with `Content-Disposition: attachment`, and `extract_urls()` only regexes `body_text`. The response does report `attachment_count` (how many attachments exist), but never opens or inspects their content.

**Practical effect:** a phishing email with a clean body but a malicious link inside an attached PDF/DOCX will currently score `clean`. Don't rely on attachment-based test cases to validate detection — use body text and inline URLs.

## 3. Test accounts

| Account | Address | Password |
|---|---|---|
| testuser1 | `testuser1@mail.naratech.xyz` | `ChangeMe123!` |
| testuser2 | `testuser2@mail.naratech.xyz` | `ChangeMe123!` |
| klara | `klara@mail.naratech.xyz` | `Klara2026!` |
| john | `john@mail.naratech.xyz` | `John2026!` |
| michael | `michael@mail.naratech.xyz` | `Michael2026!` |

Change passwords after first login (`passwd <username>` via SSM session — see §6).

**Do not use `@naratech.xyz`** — that domain's MX points to real email forwarding (`eforward*.registrar-servers.com`), unrelated to this mail server. Only `mail.naratech.xyz` routes here.

## 4. Fast path — internal testing (no external client needed)

SSM into the instance (`aws ssm start-session --target <instance-id>`) and use `swaks`, which is pre-installed:

```bash
# benign
swaks --to testuser2@localhost --from testuser1@localhost --server 127.0.0.1 \
  --header "Subject: Meeting tomorrow" \
  --body "Hi, can we reschedule to 2pm?"

# phishing-shaped
swaks --to testuser2@localhost --from attacker@evil.tk --server 127.0.0.1 \
  --header "Subject: URGENT verify your account" \
  --body "Click here immediately: http://bit.ly/x to verify your account or it will be suspended."
```

Check what actually got delivered and whether it was tagged/quarantined:

```bash
# as testuser2, inspect the message headers
sudo -u testuser2 sh -c 'ls ~/Maildir/new/ ~/Maildir/.Quarantine/new/ 2>/dev/null'
sudo -u testuser2 sh -c 'grep -l "X-Phishing-Verdict" ~/Maildir/new/* ~/Maildir/.Quarantine/new/* 2>/dev/null | xargs head -5'
```

Benign mail → `~/Maildir/new/`. Anything tagged `X-Phishing-Verdict: quarantine` → `~/Maildir/.Quarantine/new/`.

## 5. External path — real client, real Gmail

**Send (Gmail → us):** from Gmail (or any external account) to `klara@mail.naratech.xyz` (etc). Requires the MX record for `mail.naratech.xyz` to have propagated (`dig MX mail.naratech.xyz` — should return `10 mail.naratech.xyz`) and DNS TTL (300s) to have expired since the last apply.

**Read (IMAP):** configure an email client (Thunderbird, Outlook, Mail app) with:
- **IMAP host:** `mail.naratech.xyz`
- **Port:** `143` with **STARTTLS** — verified working (real TLS 1.3 handshake). **Port 993 (IMAPS/implicit TLS) does not currently work** — Dovecot's default install doesn't enable that listener even though the port is open at the security-group level; use 143+STARTTLS instead until this is fixed.
- Client will warn about the self-signed cert — accept/add the exception, expected for a dev cert.
- **Username:** just `klara` (not the full address)
- **Password:** as in §3

Look at message headers in the client (usually "View Source" / "Show Original") for `X-Phishing-Verdict` and `X-Phishing-Score`, and check whether the message landed in INBOX vs. a `Quarantine` folder (should appear automatically via IMAP once Sieve first files something into it).

**Send (client → someone else, e.g. klara → testuser1):** configure SMTP submission on the same account:
- **SMTP host:** `mail.naratech.xyz`
- **Port:** `587`, **Connection security: STARTTLS**, **Authentication: Normal password (SASL)**
- **Username/password:** same as IMAP (`klara` / `Klara2026!`, etc.)
- This is authenticated-only — an unauthenticated client can't relay through this server. Port 25 stays receive-only for inbound MX traffic; it's not a relay.

**Sending to a real external address (e.g. back to Gmail):** if that doesn't go through, check whether AWS's default outbound-port-25 block has been lifted for this account (EC2 console → request removal of email sending limitations) — an AWS account-level restriction outside Terraform's control, unrelated to the submission service above (which only handles the client → server hop; server → external internet still goes out over port 25).

## 6. Troubleshooting

**Getting a shell on the instance:** the official Rocky Linux AMI doesn't ship SSM Agent or EC2 Instance Connect pre-installed (unlike Amazon Linux) — both are now installed explicitly in `cloud-init.yml`, so:
```bash
aws ssm start-session --target <instance-id> --profile lab-user --region us-east-1
```
If that still doesn't connect, `ec2-instance-connect` is the fallback:
```bash
aws ec2-instance-connect ssh --instance-id <instance-id> --profile lab-user --region us-east-1
```

```bash
# service status
systemctl status postfix dovecot

# mail log — shows content_filter invocation, Sieve routing, delivery
sudo tail -f /var/log/maillog

# confirm the JWT token was fetched at boot
sudo cat /etc/esp/api-token   # should be non-empty

# confirm the content_filter script itself is intact and executable
ls -l /usr/local/bin/phishing_filter.py

# confirm the master.cf transport is wired up
postconf content_filter
grep -A3 "^phishing-filter" /etc/postfix/master.cf

# confirm the Sieve script compiled
ls -l /etc/dovecot/sieve/quarantine.sieve*   # look for the compiled .svbin
```

If a message never gets the `X-Phishing-Verdict` header at all, check `/var/log/maillog` for `phishing_filter: API call failed, failing open` — this means the API call itself failed (network path, auth token, or the API being cold/down), and the filter correctly delivered the message unmodified rather than blocking it.

## 7. For M7-T8 (integration report)

Document, with screenshots:
- A benign test email delivered to INBOX with `X-Phishing-Verdict: clean`
- A phishing-shaped test email delivered to Quarantine with `X-Phishing-Verdict: quarantine` and a non-trivial `X-Phishing-Score`
- The known attachment-scanning limitation (§2), so it's a documented gap rather than a silent one
