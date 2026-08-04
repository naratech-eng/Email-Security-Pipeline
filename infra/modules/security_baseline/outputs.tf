output "guardduty_detector_id" {
  value = aws_guardduty_detector.this.id
}

output "security_logs_bucket" {
  value = aws_s3_bucket.security_logs.id
}

output "cloudtrail_arn" {
  value = aws_cloudtrail.this.arn
}
