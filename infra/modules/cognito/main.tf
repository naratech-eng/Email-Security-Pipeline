###############################################################################
# Module: cognito — User Pool + app client for dashboard auth
###############################################################################

resource "aws_cognito_user_pool" "main" {
  name = "${var.project}-user-pool"

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  auto_verified_attributes = ["email"]

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Custom attributes the dashboard sets at sign-up / in settings. Adding new
  # schema blocks like these applied in place against the existing pool with
  # this provider version (verified live: pool id and CreationDate unchanged
  # after apply) -- Cognito's AddCustomAttributes API allows adding attributes
  # after creation, it just can't modify or remove ones that already exist.
  # Removing or changing an existing schema block WOULD force a replace.
  schema {
    name                     = "role"
    attribute_data_type      = "String"
    mutable                  = true
    developer_only_attribute = false
    string_attribute_constraints {
      min_length = 1
      max_length = 64
    }
  }

  schema {
    name                     = "gender"
    attribute_data_type      = "String"
    mutable                  = true
    developer_only_attribute = false
    string_attribute_constraints {
      min_length = 1
      max_length = 16
    }
  }

  schema {
    name                     = "avatar_url"
    attribute_data_type      = "String"
    mutable                  = true
    developer_only_attribute = false
    string_attribute_constraints {
      min_length = 0
      max_length = 2048
    }
  }

  tags = { Project = var.project }
}

resource "aws_cognito_user_pool_client" "dashboard" {
  name         = "${var.project}-dashboard-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  supported_identity_providers = ["COGNITO"]

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  # The client must be allowed to write the custom attrs at sign-up and read
  # them back via fetchUserAttributes.
  read_attributes = [
    "email",
    "email_verified",
    "custom:role",
    "custom:gender",
    "custom:avatar_url",
  ]
  write_attributes = [
    "email",
    "custom:role",
    "custom:gender",
    "custom:avatar_url",
  ]
}

# --------------------------------------------------------------------------- #
# Role groups — the JWT `cognito:groups` claim drives frontend RBAC + the
# backend role matrix. The backend claim-role endpoint adds a user to the group
# matching their verified custom:role.
# --------------------------------------------------------------------------- #
resource "aws_cognito_user_group" "soc_analyst" {
  name         = "soc-analyst"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Read-only: Overview + Detections."
  precedence   = 30
}

resource "aws_cognito_user_group" "security_operator" {
  name         = "security-operator"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Operator: adds the Analyze page."
  precedence   = 20
}

resource "aws_cognito_user_group" "security_analyst" {
  name         = "security-analyst"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Full access: review, user management, CSV export."
  precedence   = 10
}

# --------------------------------------------------------------------------- #
# Identity Pool — grants signed-in users temporary, IAM-scoped AWS credentials
# so the browser can upload avatars straight to S3 (aws-amplify/storage), each
# user confined to their own private/<identityId>/ prefix.
# --------------------------------------------------------------------------- #
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "${var.project}-dashboard-identity"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    provider_name           = aws_cognito_user_pool.main.endpoint
    client_id               = aws_cognito_user_pool_client.dashboard.id
    server_side_token_check = false
  }
}

data "aws_iam_policy_document" "authenticated_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = ["cognito-identity.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "cognito-identity.amazonaws.com:aud"
      values   = [aws_cognito_identity_pool.main.id]
    }
    condition {
      test     = "ForAnyValue:StringLike"
      variable = "cognito-identity.amazonaws.com:amr"
      values   = ["authenticated"]
    }
  }
}

resource "aws_iam_role" "authenticated" {
  name               = "${var.project}-dashboard-authenticated"
  assume_role_policy = data.aws_iam_policy_document.authenticated_assume.json
  tags               = { Project = var.project }
}

data "aws_region" "current" {}

# Each user can only touch objects under their own identity prefix.
data "aws_iam_policy_document" "avatar_access" {
  statement {
    sid     = "OwnAvatarObjects"
    effect  = "Allow"
    actions = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = [
      "${var.avatars_bucket_arn}/private/$${cognito-identity.amazonaws.com:sub}/*",
    ]
  }

  # s3_avatars' default encryption is SSE-KMS (the AWS-managed aws/s3 key).
  # Unlike AES256, SSE-KMS checks KMS permissions on every PUT/GET even when
  # the key comes from the bucket's default rather than being named in the
  # request -- without this statement, uploads would fail with AccessDenied
  # despite the S3-level grant above being correct. Resource "*" scoped down
  # via kms:ViaService: the AWS-managed key's ARN isn't user-referenceable
  # ahead of creation, and this is the standard pattern AWS documents for
  # granting per-principal access to an account's managed key.
  statement {
    sid       = "AvatarBucketDefaultKmsKey"
    effect    = "Allow"
    actions   = ["kms:GenerateDataKey", "kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["s3.${data.aws_region.current.name}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "avatar_access" {
  name   = "${var.project}-avatar-access"
  role   = aws_iam_role.authenticated.id
  policy = data.aws_iam_policy_document.avatar_access.json
}

resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id
  roles = {
    authenticated = aws_iam_role.authenticated.arn
  }
}
