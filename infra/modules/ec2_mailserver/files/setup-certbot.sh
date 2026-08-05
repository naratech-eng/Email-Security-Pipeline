#!/bin/sh
# M7-T17: real Let's Encrypt cert so mail clients need no manual exception.
# Fetched from S3 at boot, same reason as phishing_filter.py: this logic no
# longer fits inside EC2's 16384-byte user_data limit.
#
# DNS-01 via Route53, not HTTP-01: HTTP-01 needs :80 open to the entire
# internet (ACME validates from arbitrary IPs), which trips CKV_AWS_260 for
# good reason on a mail server. DNS-01 proves control with a TXT record and
# opens no inbound port. Non-fatal throughout: the self-signed cert generated
# in cloud-init.yml before this script runs stays in place on any failure, so
# TLS never breaks even if issuance does.
#
# Usage: setup-certbot.sh <mail_hostname> <certbot_email>
MAIL_HOSTNAME="$1"
CERTBOT_EMAIL="$2"

dnf install -y certbot || true
# Separate transaction from the mail packages installed earlier in
# cloud-init.yml: a failure here must not roll back postfix/dovecot. Verified
# present on Rocky 9 as python3-certbot-dns-route53 3.1.0-1.el9 (epel), and
# `certbot --dry-run` against LE staging succeeded with the IAM policy in
# main.tf. The pip fallback below is for mirrors/releases lacking the EPEL
# package -- it pulls its own certbot as a dependency, shadowing
# /usr/bin/certbot on PATH, which the detection logic below accounts for.
dnf install -y python3-certbot-dns-route53 \
  || (dnf install -y python3-pip && pip3 install certbot-dns-route53) \
  || true

# Prefer dnf's /usr/bin/certbot (what the systemd renewal timer already
# targets); only look elsewhere if its plugin list lacks dns-route53. Verified
# live: a pip-installed plugin is invisible to the dnf certbot even when both
# share the same Python interpreter, so if the pip fallback above fired,
# renewal must be repointed at whichever binary can actually see the plugin --
# otherwise it silently stops renewing the moment this run's issuance succeeds.
CERTBOT_BIN=/usr/bin/certbot
if ! $CERTBOT_BIN plugins --non-interactive 2>/dev/null | grep -q dns-route53; then
  for c in /usr/local/bin/certbot /usr/bin/certbot; do
    if [ -x "$c" ] && "$c" plugins --non-interactive 2>/dev/null | grep -q dns-route53; then
      CERTBOT_BIN="$c"
      break
    fi
  done
fi

if [ "$CERTBOT_BIN" != "/usr/bin/certbot" ]; then
  mkdir -p /etc/systemd/system/certbot-renew.service.d
  printf '[Service]\nExecStart=\nExecStart=%s renew --noninteractive --no-random-sleep-on-renew\n' \
    "$CERTBOT_BIN" > /etc/systemd/system/certbot-renew.service.d/override.conf
  systemctl daemon-reload
fi

"$CERTBOT_BIN" certonly --dns-route53 --non-interactive --agree-tos \
  --domains "$MAIL_HOSTNAME" --email "$CERTBOT_EMAIL" \
  --cert-name esp-mail --key-type rsa && \
LIVE=/etc/letsencrypt/live/esp-mail && \
ARCHIVE=/etc/letsencrypt/archive/esp-mail && \
postconf -e "smtpd_tls_cert_file = $LIVE/fullchain.pem" && \
postconf -e "smtpd_tls_key_file = $LIVE/privkey.pem" && \
printf 'ssl = required\nssl_cert = <%s/fullchain.pem\nssl_key = <%s/privkey.pem\nssl_min_protocol = TLSv1.2\n' "$LIVE" "$LIVE" > /etc/dovecot/conf.d/94-esp-ssl.conf && \
chmod 0755 /etc/letsencrypt/live /etc/letsencrypt/archive && \
chgrp postfix "$ARCHIVE"/privkey*.pem && chmod 0640 "$ARCHIVE"/privkey*.pem && \
echo "certbot: issued via $CERTBOT_BIN, postfix+dovecot now using the trusted cert" || \
echo "certbot: issuance FAILED, staying on the self-signed cert"

# Renewal rewrites the cert files but nothing re-reads them without this hook.
# Critically, this must also redo the chgrp/chmod below: certbot's renewal
# writes a brand-new privkeyN.pem each time and re-points the live/ symlink,
# so the group grant applied above is lost on the very first renewal unless
# it's reapplied here too. Without this, Postfix's unprivileged smtpd process
# (submission on 587, TLS mandatory) loses read access to the key on the next
# renewal and outbound STARTTLS silently breaks again for real mail clients
# (Dovecot survives because its SSL key loading happens in its root master).
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nchgrp postfix /etc/letsencrypt/archive/esp-mail/privkey*.pem\nchmod 0640 /etc/letsencrypt/archive/esp-mail/privkey*.pem\nsystemctl reload postfix dovecot\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-mail.sh
chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/reload-mail.sh
systemctl enable --now certbot-renew.timer || true
