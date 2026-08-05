###############################################################################
# Module: ecs_service — Fargate cluster + service skeleton for FastAPI
###############################################################################

resource "aws_ecs_cluster" "main" {
  name = "${var.project}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Project = var.project }
}

resource "aws_cloudwatch_log_group" "api" {
  #checkov:skip=CKV_AWS_158: KMS encryption needs a dedicated CMK (~$1/mo); deferred for the budget lab — logs use the default CloudWatch encryption
  name              = "/ecs/${var.project}/api"
  retention_in_days = 365 # CKV_AWS_338 — retain at least 1 year
  tags              = { Project = var.project }
}

# IAM — ECS task execution role
resource "aws_iam_role" "ecs_execution" {
  name = "${var.project}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# IAM — ECS task role (least-privilege app permissions)
resource "aws_iam_role" "ecs_task" {
  name = "${var.project}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "model-bucket-read"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["s3:GetObject", "s3:ListBucket"]
      Resource = [
        "arn:aws:s3:::${var.model_bucket_name}",
        "arn:aws:s3:::${var.model_bucket_name}/*"
      ]
    }]
  })
}

# M7-T14 — the API's claim-role endpoint reads a user's custom:role and adds
# them to the matching Cognito group. Scoped to this pool only.
resource "aws_iam_role_policy" "ecs_task_cognito" {
  count = var.cognito_user_pool_arn != "" ? 1 : 0
  name  = "cognito-claim-role"
  role  = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminAddUserToGroup",
        "cognito-idp:AdminListGroupsForUser"
      ]
      Resource = [var.cognito_user_pool_arn]
    }]
  })
}

# SEC-T3 — read-only access to exactly the two app secrets, nothing else.
# Attached to the execution role, not the task role: ECS resolves the
# container definition's `secrets` block (env var injection at container
# startup) using the execution role, not the task role. The task role is for
# permissions the app itself needs at runtime (e.g. S3 model reads below).
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "app-secrets-read"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        var.db_credentials_secret_arn,
        var.jwt_signing_key_secret_arn
      ]
    }]
  })
}

# Task definition — placeholder image until M6 builds the real one
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  #checkov:skip=CKV_AWS_336: readonlyRootFilesystem can't be enforced on the placeholder image yet; revisit when the real FastAPI image lands in M6 (it writes temp model files)

  container_definitions = jsonencode([{
    name      = "api"
    image     = var.container_image
    essential = true

    portMappings = [{
      containerPort = 8000
      protocol      = "tcp"
    }]

    environment = [
      { name = "ENV", value = var.environment },
      { name = "COGNITO_USER_POOL_ID", value = var.cognito_user_pool_id },
      { name = "COGNITO_REGION", value = var.aws_region },
      { name = "COGNITO_APP_CLIENT_ID", value = var.cognito_app_client_id },
      { name = "CORS_ALLOWED_ORIGINS", value = join(",", var.cors_allowed_origins) },
    ]

    # SEC-T3 — pulled from Secrets Manager at task startup, never plaintext
    # in the task definition, CI logs, or the repo.
    secrets = [
      { name = "DB_CREDENTIALS_JSON", valueFrom = var.db_credentials_secret_arn },
      { name = "JWT_SIGNING_KEY", valueFrom = var.jwt_signing_key_secret_arn }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }
  }])

  tags = { Project = var.project }
}

# ECS Service
resource "aws_ecs_service" "api" {
  name            = "${var.project}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.sg_ecs_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.public_tg_arn
    container_name   = "api"
    container_port   = 8000
  }

  load_balancer {
    target_group_arn = var.internal_tg_arn
    container_name   = "api"
    container_port   = 8000
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  tags = { Project = var.project }
}

# --------------------------------------------------------------------------- #
# M9-T7 — scheduled detection-record retention purge. Reuses the API's own
# container image and IAM roles (no separate build pipeline), overriding the
# entrypoint to backend/retention_purge.py instead of uvicorn. See
# docs/data-retention-privacy.md for the policy this enforces.
# --------------------------------------------------------------------------- #
resource "aws_iam_role" "scheduler" {
  name = "${var.project}-retention-scheduler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# EventBridge Scheduler needs to both launch the task and hand it the two
# roles the task itself runs as -- iam:PassRole is what makes that handoff
# possible, scoped to exactly those two roles rather than "*".
resource "aws_iam_role_policy" "scheduler_run_task" {
  name = "run-retention-purge-task"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecs:RunTask"]
        Resource = [aws_ecs_task_definition.retention_purge.arn]
        Condition = {
          ArnLike = { "ecs:cluster" = aws_ecs_cluster.main.arn }
        }
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = [aws_iam_role.ecs_execution.arn, aws_iam_role.ecs_task.arn]
      },
    ]
  })
}

resource "aws_cloudwatch_log_group" "retention_purge" {
  #checkov:skip=CKV_AWS_158: KMS encryption needs a dedicated CMK (~$1/mo); deferred for the budget lab, same call as the API's own log group above
  name              = "/ecs/${var.project}/retention-purge"
  retention_in_days = 365 # CKV_AWS_338
  tags              = { Project = var.project }
}

# A separate task definition, not a RunTask containerOverrides.command on the
# API's own definition: ECS RunTask overrides don't support overriding
# logConfiguration (only name/command/environment/cpu/memory/resources), so
# there's no way to route a per-run override into its own log group. A
# purpose-built definition gets its own log group baked in, at the cost of
# reusing the API's (over-broad, for this) task role rather than a minimal
# one -- an accepted simplification for a scheduled maintenance job with no
# internet exposure, not a real credential-exfiltration path.
resource "aws_ecs_task_definition" "retention_purge" {
  family                   = "${var.project}-retention-purge"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  #checkov:skip=CKV_AWS_336: readonlyRootFilesystem not enforced -- same call as the API task definition above, shares its image

  container_definitions = jsonencode([{
    name      = "retention-purge"
    image     = var.container_image
    essential = true
    command   = ["python", "retention_purge.py"]

    environment = [
      { name = "RETENTION_DAYS", value = tostring(var.retention_days) },
    ]

    secrets = [
      { name = "DB_CREDENTIALS_JSON", valueFrom = var.db_credentials_secret_arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.retention_purge.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "retention-purge"
      }
    }
  }])

  tags = { Project = var.project }
}

resource "aws_scheduler_schedule" "retention_purge" {
  #checkov:skip=CKV_AWS_297: AWS-owned encryption is on by default (KMS_MANAGED is the resource's own default); a customer-managed CMK is a paid resource deferred for the lab budget, same call as the other KMS CMK skips in this repo (docs/devsecops.md §3.1)
  name = "${var.project}-retention-purge"

  flexible_time_window {
    mode = "OFF"
  }

  # Daily, low-traffic hour (03:00 America/Toronto / 07:00 UTC in EDT) --
  # same slot logic as the DAST nightly scan, just offset so they don't
  # compete for the shared RDS instance.
  schedule_expression          = "cron(0 7 * * ? *)"
  schedule_expression_timezone = "UTC"

  target {
    arn      = aws_ecs_cluster.main.arn
    role_arn = aws_iam_role.scheduler.arn

    ecs_parameters {
      task_definition_arn = aws_ecs_task_definition.retention_purge.arn
      launch_type         = "FARGATE"
      task_count          = 1

      network_configuration {
        subnets          = var.private_subnet_ids
        security_groups  = [var.sg_ecs_id]
        assign_public_ip = false
      }
    }
  }
}
