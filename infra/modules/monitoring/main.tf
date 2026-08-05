###############################################################################
# Module: monitoring — shared SNS alarm topic (OBS-T1)
#
# One topic, fanned into every CloudWatch alarm (ALB 5xx/latency, RDS
# CPU/connections) plus GuardDuty/Security Hub findings, so there is exactly
# one place to subscribe an operator email/Slack webhook rather than one per
# resource.
###############################################################################

resource "aws_sns_topic" "alerts" {
  name = "${var.project}-alerts"

  # SSE-SNS with the AWS-managed key — same no-extra-cost call as the S3
  # buckets' aws/s3 default (CKV_AWS_26).
  kms_master_key_id = "alias/aws/sns"

  tags = { Project = var.project }
}

resource "aws_sns_topic_policy" "alerts" {
  arn = aws_sns_topic.alerts.arn

  # CloudWatch alarms and EventBridge (GuardDuty/Security Hub finding
  # forwarding) both publish directly; scoped to this account/topic only.
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudWatchAlarms"
        Effect = "Allow"
        Principal = {
          Service = ["cloudwatch.amazonaws.com", "events.amazonaws.com"]
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.alerts.arn
        Condition = {
          StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
        }
      }
    ]
  })
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

data "aws_caller_identity" "current" {}
