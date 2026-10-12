# The state bucket must be PRIVATE, VERSIONED and encrypted with a
# customer-managed key: this stack's state holds the k3s join token and the
# OCIR auth token (see README.md). Partial configuration — bucket, key and
# endpoint are supplied at `terraform init -backend-config=…` time by CI.
terraform {
  backend "s3" {
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    force_path_style            = true
  }
}
