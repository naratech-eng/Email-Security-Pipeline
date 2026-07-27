output "smtp_credentials_secret_arn" {
  description = "Secrets Manager ARN holding {username, password} for SES SMTP auth — the mail server fetches this at boot to build /etc/postfix/sasl_passwd"
  value       = aws_secretsmanager_secret.ses_smtp.arn
}

output "relay_host" {
  description = "Postfix relayhost value, in the bracketed form that suppresses an MX lookup on the SES endpoint"
  value       = "[email-smtp.${var.ses_region}.amazonaws.com]:587"
}

output "dkim_tokens" {
  description = "SES DKIM selectors, for confirming the published CNAMEs match"
  value       = aws_sesv2_email_identity.mail_domain.dkim_signing_attributes[0].tokens
}

output "identity_arn" {
  description = "ARN of the verified mail-domain SES identity — used as Cognito's email source_arn."
  value       = aws_sesv2_email_identity.mail_domain.arn
}

output "identity_name" {
  description = "The verified SES domain identity (e.g. mail.naratech.xyz)."
  value       = aws_sesv2_email_identity.mail_domain.email_identity
}
