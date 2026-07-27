variable "project" {
  type = string
}

variable "bucket_name" {
  type        = string
  description = "Globally-unique bucket name for profile avatars."
}

variable "cors_allowed_origins" {
  type        = list(string)
  description = "Origins allowed to PUT/GET avatars from the browser (Amplify Storage)."
  default = [
    "http://localhost:3000",
    "https://esp.naratech.xyz",
    "https://esp-dev.naratech.xyz",
  ]
}
