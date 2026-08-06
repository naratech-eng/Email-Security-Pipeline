#!/bin/sh
# M9-T0: inbound SPF/DKIM/DMARC validation, so live mail carries the same
# Received-SPF / Authentication-Results headers the M4-T4 feature extractor
# (has_spf, has_dkim) expects. Without this, every email through our own
# Postfix scores has_spf=0/has_dkim=0 regardless of the sender's actual
# authentication, because nothing on this server ever computed a result.
#
# Verify-only throughout: outbound signing is already handled by SES
# (M7-T6, DKIM keys live with SES). opendkim/opendmarc here only check
# *inbound* mail and annotate it.
#
# Soft mode by design (S-07 fail-open): none of these reject at SMTP time.
# A DNS hiccup or a legitimate sender's loose SPF record must never bounce
# mail outright -- the result is a downstream ML feature, not an SMTP gate.
#
# Usage: setup-mail-auth.sh <mail_hostname>
MAIL_HOSTNAME="$1"

# opendkim/opendmarc pull in libmilter (sendmail-milter) and libmemcached,
# which live in CRB (disabled by default on Rocky 9) -- without this the
# install fails on unresolved deps and every message goes out unauthenticated,
# with no error surfaced anywhere except this script's own fallback message.
dnf config-manager --set-enabled crb || true

dnf install -y opendkim opendmarc pypolicyd-spf || {
  echo "setup-mail-auth.sh: package install failed, leaving mail unauthenticated"
  exit 0
}

mkdir -p /etc/python-policyd-spf
cat > /etc/python-policyd-spf/policyd-spf.conf << 'EOF'
debugLevel = 1
defaultSeedOnly = 1
HELO_reject = False
Mail_From_reject = False
PermError_reject = False
TempError_Defer = False
skip_addresses = 127.0.0.0/8,::ffff:127.0.0.0/104,::1
EOF

cat > /etc/opendkim.conf << 'EOF'
Mode v
Syslog yes
SyslogSuccess yes
UserID opendkim:opendkim
Socket inet:8891@127.0.0.1
PidFile /run/opendkim/opendkim.pid
AutoRestart yes
OversignHeaders From
EOF

# AuthservID must match what opendmarc expects in Authentication-Results
# (our own hostname) so it trusts the SPF/DKIM results opendkim/policyd-spf
# already wrote, rather than treating them as an untrusted upstream header.
cat > /etc/opendmarc.conf << EOF
Syslog yes
UserID opendmarc:opendmarc
Socket inet:8893@127.0.0.1
PidFile /run/opendmarc/opendmarc.pid
AuthservID ${MAIL_HOSTNAME}
TrustedAuthservIDs ${MAIL_HOSTNAME}
RejectFailures false
FailureReports false
EOF

# policyd-spf is a Postfix policy service (spawn), not a milter -- wired via
# master.cf + check_policy_service, not smtpd_milters.
cat >> /etc/postfix/master.cf << 'EOF'

policyd-spf unix - n n - 0 spawn
  user=nobody argv=/usr/libexec/postfix/policyd-spf
EOF

postconf -e "smtpd_recipient_restrictions = permit_mynetworks, reject_unauth_destination, check_policy_service unix:private/policyd-spf"
# milter_default_action=accept: if opendkim/opendmarc are briefly down, mail
# still flows unscanned rather than queuing/bouncing -- same fail-open call
# as the phishing content_filter's own circuit breaker (M7-T16).
postconf -e "milter_default_action = accept"
postconf -e "milter_protocol = 6"
postconf -e "smtpd_milters = inet:127.0.0.1:8891 inet:127.0.0.1:8893"
postconf -e "non_smtpd_milters = "

systemctl enable --now opendkim opendmarc

echo "setup-mail-auth.sh: opendkim/opendmarc/policyd-spf configured for inbound SPF/DKIM/DMARC"
