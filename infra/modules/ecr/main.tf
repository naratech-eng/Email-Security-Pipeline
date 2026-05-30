###############################################################################
# Module: ecr — container registry with image scanning
###############################################################################

resource "aws_ecr_repository" "this" {
  #checkov:skip=CKV_AWS_51: Tags kept mutable so CI can re-push the "latest" placeholder image; switch to IMMUTABLE with git-SHA tags once the M6 build pipeline lands
  name                 = var.repo_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  # KMS encryption with the AWS-managed aws/ecr key (no extra cost) (CKV_AWS_136)
  encryption_configuration {
    encryption_type = "KMS"
  }

  tags = {
    Project = var.project
  }
}

# Keep only the last N images to control costs
resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last ${var.max_images} images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = var.max_images
      }
      action = { type = "expire" }
    }]
  })
}
