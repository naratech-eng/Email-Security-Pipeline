output "guardduty_detector_id" {
  value = try(aws_guardduty_detector.this[0].id, null)
}

output "security_logs_bucket" {
  value = aws_s3_bucket.security_logs.id
}

output "cloudtrail_arn" {
  value = aws_cloudtrail.this.arn
}
