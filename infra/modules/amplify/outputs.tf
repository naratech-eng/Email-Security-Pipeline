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
  description = "Amplify cert-verification record per domain. Should not need manual entry: both domains are Route53 zones in this account, so Amplify writes its own records."
  value = var.create_domain_association ? {
    prod = aws_amplify_domain_association.prod[0].certificate_verification_dns_record
    dev  = aws_amplify_domain_association.dev[0].certificate_verification_dns_record
  } : null
}

output "prod_domain_url" {
  description = "Custom-domain URL for the prod branch."
  value       = var.create_domain_association ? "https://${var.prod_domain_name}" : null
}

output "dev_domain_url" {
  description = "Custom-domain URL for the dev branch."
  value       = var.create_domain_association ? "https://${var.dev_domain_name}" : null
}
