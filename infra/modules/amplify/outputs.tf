output "app_id" {
  description = "Amplify app id."
  value       = aws_amplify_app.dashboard.id
}

output "default_domain" {
  description = "Amplify-provided default domain (e.g. <id>.amplifyapp.com)."
  value       = aws_amplify_app.dashboard.default_domain
}

output "dev_branch_url" {
  description = "Amplify default URL for the dev branch."
  value       = "https://${aws_amplify_branch.dev.branch_name}.${aws_amplify_app.dashboard.default_domain}"
}

output "prod_branch_url" {
  description = "Amplify default URL for the prod (naratech) branch."
  value       = "https://${aws_amplify_branch.prod.branch_name}.${aws_amplify_app.dashboard.default_domain}"
}

output "amplify_domain_records" {
  description = "DNS records to create if the custom domain isn't a Route53 zone in this account (add these where naratech.xyz DNS is managed)."
  value       = var.create_domain_association ? aws_amplify_domain_association.this[0].certificate_verification_dns_record : null
}
