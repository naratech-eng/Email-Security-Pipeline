output "public_alb_dns" {
  value       = aws_lb.public.dns_name
  description = "ALB DNS name — aliased to esp-api.naratech.xyz via Route53"
}

output "internal_alb_dns" {
  value = aws_lb.internal.dns_name
}

output "public_tg_arn" {
  value = aws_lb_target_group.public.arn
}

output "internal_tg_arn" {
  value = aws_lb_target_group.internal.arn
}

output "public_alb_arn" {
  value = aws_lb.public.arn
}

output "esp_api_cert_arn" {
  value       = aws_acm_certificate_validation.esp_api.certificate_arn
  description = "Validated ACM cert ARN for esp-api.naratech.xyz"
}
