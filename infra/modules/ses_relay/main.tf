# M7-T6 outbound relay via Amazon SES.
#
# Why a relay at all: AWS blocks outbound TCP/25 from EC2 by default, so the
# mail server cannot talk to any recipient MX directly (verified — Gmail's MX
# on :25 times out, while :587 is open). Lifting that block needs an AWS
# Support request, and Gmail would still reject us for having no PTR record on
# the instance's public IP and no sending reputation on a new domain.
#
# Relaying through SES on :587 sidesteps all three: SES owns the IP
# reputation, and with the domain verified below it DKIM-signs as
# mail.naratech.xyz, so mail still comes from klara@mail.naratech.xyz rather
# than some third-party identity.

# Easy DKIM: SES generates the keypair and we publish three CNAMEs pointing at
# its selectors. DKIM alignment is what makes DMARC pass here, since without a
# custom MAIL FROM domain the SPF check authenticates amazonses.com, not us.
resource "aws_sesv2_email_identity" "mail_domain" {
  email_identity = var.mail_hostname

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

resource "aws_route53_record" "dkim" {
  count = 3

  zone_id = var.mail_zone_id
  name    = "${element(aws_sesv2_email_identity.mail_domain.dkim_signing_attributes[0].tokens, count.index)}._domainkey"
  type    = "CNAME"
  ttl     = 300
  records = ["${element(aws_sesv2_email_identity.mail_domain.dkim_signing_attributes[0].tokens, count.index)}.dkim.amazonses.com"]
}

# "a mx" keeps the instance itself authorised (it still delivers local mail and
# presents this MX for inbound); include:amazonses.com authorises the relay.
# ~all (softfail) rather than -all so a missed source degrades to a spam score
# rather than an outright rejection while this is still a lab setup.
resource "aws_route53_record" "spf" {
  zone_id = var.mail_zone_id
  name    = var.mail_hostname
  type    = "TXT"
  ttl     = 300
  records = ["v=spf1 a mx include:amazonses.com ~all"]
}

# p=none: monitor-only. Report first, and only tighten to quarantine/reject
# once the aggregate reports show legitimate mail passing consistently —
# starting at p=reject is how you silently lose real mail.
resource "aws_route53_record" "dmarc" {
  zone_id = var.mail_zone_id
  name    = "_dmarc.${var.mail_hostname}"
  type    = "TXT"
  ttl     = 300
  records = ["v=DMARC1; p=none; rua=mailto:${var.dmarc_report_address}; fo=1"]
}

# SES SMTP auth needs long-lived credentials, which means an IAM user: the SMTP
# protocol has no way to use an instance role or temporary credentials.
resource "aws_iam_user" "ses_smtp" {
  #checkov:skip=CKV_AWS_273: SES SMTP authentication requires a long-lived IAM user; SSO/role credentials cannot be used over SMTP
  name = "${var.project}-ses-smtp"
}

data "aws_caller_identity" "current" {}

# Resource covers every identity in this account rather than just the sending
# domain, because while SES is in the sandbox it authorises against the
# *recipient* identity as well — scoping this to identity/${var.mail_hostname}
# fails with "not authorized ... on resource identity/<recipient>".
#
# The real protection is the ses:FromAddress condition, not the resource ARN:
# it means a leaked SMTP credential can only send *as* our own domain, which is
# the actual risk of putting long-lived credentials on a mail server. Sending
# to arbitrary recipients is the intended behaviour.
# Attached via a group rather than inline on the user: an inline user policy
# trips CKV_AWS_40, and the group is where the permission belongs anyway if a
# second sender is ever added.
resource "aws_iam_group" "ses_smtp" {
  name = "${var.project}-ses-smtp"
}

resource "aws_iam_group_membership" "ses_smtp" {
  name  = "${var.project}-ses-smtp"
  group = aws_iam_group.ses_smtp.name
  users = [aws_iam_user.ses_smtp.name]
}

resource "aws_iam_group_policy" "ses_send" {
  name  = "ses-send-only"
  group = aws_iam_group.ses_smtp.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ses:SendRawEmail"]
      Resource = "arn:aws:ses:${var.ses_region}:${data.aws_caller_identity.current.account_id}:identity/*"
      Condition = {
        StringLike = {
          "ses:FromAddress" = "*@${var.mail_hostname}"
        }
      }
    }]
  })
}

resource "aws_iam_access_key" "ses_smtp" {
  user = aws_iam_user.ses_smtp.name
}

# ses_smtp_password_v4 is the access key run through SES's documented
# HMAC derivation — the provider computes it so we never have to reimplement
# that in cloud-init (and cloud-init has almost no user_data budget left).
resource "aws_secretsmanager_secret" "ses_smtp" {
  #checkov:skip=CKV_AWS_149: Uses the AWS-managed secretsmanager key (no extra cost); a dedicated CMK is deferred for the budget lab
  #checkov:skip=CKV2_AWS_57: Rotation would invalidate the SMTP password Postfix reads at boot; out of scope for the lab
  name                    = "${var.project}-ses-smtp-credentials"
  description             = "SES SMTP username/password for the Postfix outbound relay (M7-T6)"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "ses_smtp" {
  secret_id = aws_secretsmanager_secret.ses_smtp.id
  secret_string = jsonencode({
    username = aws_iam_access_key.ses_smtp.id
    password = aws_iam_access_key.ses_smtp.ses_smtp_password_v4
  })
}

# SES starts every account in the sandbox, where mail may only go to verified
# addresses. Each entry here triggers a confirmation email from AWS that the
# owner of that address must click. Request production access to drop this
# restriction and send to arbitrary recipients.
resource "aws_sesv2_email_identity" "verified_recipient" {
  for_each = toset(var.sandbox_verified_recipients)

  email_identity = each.value
}
