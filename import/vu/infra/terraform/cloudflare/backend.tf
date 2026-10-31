# Same private/versioned/CMK-encrypted Object Storage bucket as the OCI stack
# (Task 98), different key. Partial configuration; CI passes bucket/endpoint.
terraform {
  backend "s3" {
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    force_path_style            = true
  }
}
