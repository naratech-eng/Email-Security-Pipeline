###############################################################################
# Module: waf — WAFv2 Web ACL on the public ALB (SEC-T2 / M9-T4)
#
# REGIONAL scope (ALB, not CloudFront). Three AWS managed rule groups, all in
# count mode by default (see var.block_mode) so a first deploy can be watched
# in CloudWatch before it starts rejecting real traffic -- flipping to COUNT
# for a false positive is a one-line var change, not an emergency redeploy.
###############################################################################

resource "aws_wafv2_web_acl" "this" {
  #checkov:skip=CKV_AWS_192: Log4Shell coverage (part of KnownBadInputsRuleSet below) intentionally starts in COUNT mode via var.block_mode, same "observe before block" pattern already used for the ZAP passive baseline (devsecops.md §3.3) -- flip block_mode=true once a baseline run shows no false positives.
  name = "${var.project}-waf"
  # AWS's description field only allows word chars plus + = : # @ / - , . and
  # whitespace -- no parentheses. Learned the hard way: CreateWebACL 400s on
  # ValidationException otherwise.
  description = "Managed rule sets in front of the public ALB esp-api.naratech.xyz"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 0

    override_action {
      dynamic "count" {
        for_each = var.block_mode ? [] : [1]
        content {}
      }
      dynamic "none" {
        for_each = var.block_mode ? [1] : []
        content {}
      }
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project}-common-rules"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 1

    override_action {
      dynamic "count" {
        for_each = var.block_mode ? [] : [1]
        content {}
      }
      dynamic "none" {
        for_each = var.block_mode ? [1] : []
        content {}
      }
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project}-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 2

    override_action {
      dynamic "count" {
        for_each = var.block_mode ? [] : [1]
        content {}
      }
      dynamic "none" {
        for_each = var.block_mode ? [1] : []
        content {}
      }
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project}-ip-reputation"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project}-waf"
    sampled_requests_enabled   = true
  }

  tags = { Project = var.project }
}

resource "aws_wafv2_web_acl_association" "public_alb" {
  resource_arn = var.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.this.arn
}

# WAF logging requires the destination log group's name to start with
# "aws-waf-logs-" -- not a project convention, an AWS-enforced prefix.
resource "aws_cloudwatch_log_group" "waf" {
  #checkov:skip=CKV_AWS_158: CloudWatch Logs' default encryption-at-rest is AWS-owned (always on); a customer-managed KMS key is a paid CMK, deferred for the lab budget like the other KMS CMK skips in this repo (docs/devsecops.md §3.1)
  name              = "aws-waf-logs-${var.project}"
  retention_in_days = 365
}

resource "aws_wafv2_web_acl_logging_configuration" "this" {
  resource_arn            = aws_wafv2_web_acl.this.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]
}

# HIGH-severity blocked/counted requests -> the shared alerts topic, same
# signal DAST treats as merge-blocking (devsecops.md §3.3).
resource "aws_cloudwatch_metric_alarm" "waf_blocked" {
  alarm_name          = "${var.project}-waf-blocked-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = 300
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "WAF blocked more than 50 requests in 5 minutes on the public ALB."
  treat_missing_data  = "notBreaching"

  dimensions = {
    WebACL = aws_wafv2_web_acl.this.name
    Region = data.aws_region.current.name
    Rule   = "ALL"
  }

  alarm_actions = [var.alerts_topic_arn]
  ok_actions    = [var.alerts_topic_arn]
}

data "aws_region" "current" {}
