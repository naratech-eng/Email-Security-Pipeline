###############################################################################
# Remote state backend — created by infra/bootstrap
###############################################################################
terraform {
  backend "s3" {
    bucket  = "esp-tfstate-us-east-1-802531654188"
    key     = "envs/dev/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
    # No profile here so CI can use OIDC env credentials.
    # Local runs: `export AWS_PROFILE=lab-user` before terraform init,
    # or `terraform init -backend-config="profile=lab-user"`.
    use_lockfile = true
  }
}
