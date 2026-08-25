###############################################################################
# Module: rds_postgres — single-AZ dev Postgres, encrypted
###############################################################################

resource "aws_db_subnet_group" "this" {
  name       = "${var.project}-rds-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = { Project = var.project }
}

resource "aws_db_instance" "this" {
  # --- Skips: cost / lab-workflow tradeoffs ---
  #checkov:skip=CKV_AWS_157: Multi-AZ doubles the RDS bill; single-AZ is acceptable for the dev lab (enable in prod)
  #checkov:skip=CKV_AWS_118: Enhanced monitoring adds CloudWatch agent cost; deferred for the budget lab
  #checkov:skip=CKV_AWS_293: Deletion protection would block the OPS-T1 destroy/rebuild runbook; off in dev
  #checkov:skip=CKV2_AWS_30: Query logging requires a custom parameter group; deferred (perf insights covers lab needs)
  #checkov:skip=CKV_AWS_354: Performance Insights uses the default AWS-managed key; a dedicated CMK (~$1/mo) is deferred for the budget lab
  identifier            = "${var.project}-postgres"
  engine                = "postgres"
  engine_version        = "16"
  instance_class        = var.instance_class
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.sg_rds_id]

  multi_az            = false # single-AZ for dev
  publicly_accessible = false
  skip_final_snapshot = true # set to false before prod demo
  deletion_protection = false

  # Free / near-free hardening
  iam_database_authentication_enabled   = true                      # CKV_AWS_161
  auto_minor_version_upgrade            = true                      # CKV_AWS_226
  copy_tags_to_snapshot                 = true                      # CKV2_AWS_60
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"] # CKV_AWS_129
  performance_insights_enabled          = true                      # CKV_AWS_353
  performance_insights_retention_period = 7                         # 7 days = free tier

  # 7 days, not 1. The old comment claimed free tier caps retention at 1 day --
  # it does not. Free tier grants 20 GB of *backup storage*; the retention
  # period is unconstrained, and this instance's backups are far under that.
  #
  # This is not a theoretical setting. On 2026-08-13 a KMS outage during the
  # account suspension pushed esp-postgres into terminal
  # inaccessible-encryption-credentials, and recovery depended entirely on
  # whatever automated snapshots happened to still exist. At retention = 1 the
  # newest usable snapshot was already a week stale, and it survived only
  # because backups had stopped when the instance broke. One more day of
  # working backups would have aged it out and the database would have been
  # unrecoverable.
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  tags = { Project = var.project }
}

# OBS-T1 — the two RDS metrics that predict an outage before it happens:
# sustained CPU pressure and connection exhaustion (db.t4g.micro caps out
# around 87 connections, so 80 gives real headroom before the pool actually
# fills and the API starts throwing connection errors).
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.project}-rds-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU above 80% for 15 minutes."
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.this.id
  }

  alarm_actions = [var.alerts_topic_arn]
  ok_actions    = [var.alerts_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "${var.project}-rds-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS connection count above 80 for 10 minutes (db.t4g.micro caps out around 87)."
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.this.id
  }

  alarm_actions = [var.alerts_topic_arn]
  ok_actions    = [var.alerts_topic_arn]
}
