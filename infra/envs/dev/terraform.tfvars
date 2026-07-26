# Dev environment — non-sensitive vars only
# NEVER put db_password here — use: export TF_VAR_db_password="yourpassword"
# AWS auth: local runs `export AWS_PROFILE=lab-user`; CI uses OIDC env credentials.

aws_region  = "us-east-1"
project     = "esp"
environment = "dev"

# Create in AWS Console → EC2 → Key Pairs, then paste the name here
key_name = "esp-dev-key"

# Route53 hosted zone IDs (lab account 802531654188).
# Each is a delegated SUBDOMAIN zone — the naratech.xyz apex lives in a
# different AWS account, so nothing here may be attached to the apex.
esp_api_zone_id = "Z04132153JT7YAXT7E8D"
esp_zone_id     = "Z08382621P3TE6ILDEBXO"
mail_zone_id    = "Z04118593IZKW7SZN71AP"
esp_dev_zone_id = "Z03718845RKDT8O4W6QR" # esp-dev.naratech.xyz — Amplify dev branch

mail_domain   = "naratech.xyz"
mail_hostname = "mail.naratech.xyz"

cognito_callback_urls = ["https://esp.naratech.xyz/callback", "http://localhost:3000/callback"]
cognito_logout_urls   = ["https://esp.naratech.xyz", "http://localhost:3000"]
