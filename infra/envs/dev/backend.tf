###############################################################################
# Remote state backend — created by infra/bootstrap
###############################################################################
terraform {
  backend "s3" {
    bucket       = "esp-tfstate-us-east-1-802531654188"
    key          = "envs/dev/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    profile      = "lab-user"
    use_lockfile = true
  }
}
