output "role_arn" {
  description = "ARN of the IAM role assumed by GitHub Actions — set as AWS_OIDC_ROLE_ARN secret in GitHub"
  value       = aws_iam_role.github_ci.arn
}

output "oidc_provider_arn" {
  description = "ARN of the GitHub OIDC provider"
  value       = aws_iam_openid_connect_provider.github.arn
}
