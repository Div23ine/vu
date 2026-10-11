# R2 buckets (Task 99). Four buckets, four different postures:
#   public  — avatars and studio images, served through the assets hostname;
#   private — authorisations, invoices, reports, scan logs: presigned URLs only;
#   audit   — the daily WORM snapshots (Task 92): LOCKED for 7 years;
#   logs    — the Logpush destination, written by Cloudflare, read by nobody.
# R2 API tokens (the S3-compatible credentials the API and Logpush use) are
# created OUT OF BAND and stored in OCI Vault — never by Terraform, never here.

resource "cloudflare_r2_bucket" "public" {
  account_id = var.account_id
  name       = "vv-${var.environment}-public"
  location   = var.r2_location_hint
}

resource "cloudflare_r2_bucket" "private" {
  account_id = var.account_id
  name       = "vv-${var.environment}-private"
  location   = var.r2_location_hint
}

resource "cloudflare_r2_bucket" "audit" {
  account_id = var.account_id
  name       = "vv-${var.environment}-audit"
  location   = var.r2_location_hint
}

resource "cloudflare_r2_bucket" "logs" {
  account_id = var.account_id
  name       = "vv-${var.environment}-logs"
  location   = var.r2_location_hint
}

# The audit bucket's lock: 7 years (2555 days), whole-bucket (empty prefix),
# compliance mode — objects cannot be overwritten or deleted inside the
# window, which is what makes the daily snapshot (Task 92) evidence.
resource "cloudflare_r2_bucket_lock" "audit" {
  account_id = var.account_id
  bucket     = cloudflare_r2_bucket.audit.name
  prefix     = ""
  mode       = "compliance"
  period     = 2555
}

# Scan logs are operational, not evidential: they expire after a year.
resource "cloudflare_r2_bucket_lifecycle" "private" {
  account_id = var.account_id
  bucket     = cloudflare_r2_bucket.private.name
  rules {
    id         = "expire-scan-logs"
    prefix     = "scan-logs/"
    expiration = 365
    enabled    = true
  }
}

# The public bucket's custom domain (assets.<zone>) — proxied through
# Cloudflare so media gets the same TLS posture as everything else.
resource "cloudflare_r2_custom_domain" "assets" {
  account_id = var.account_id
  bucket     = cloudflare_r2_bucket.public.name
  domain     = var.assets_hostname
}

# CORS: the browser reads media from anywhere (public images are public) but
# may only UPLOAD from the web origin — presigned PUTs are scoped by the API,
# and the CORS layer refuses everyone else's preflight.
resource "cloudflare_r2_bucket_cors" "public" {
  account_id = var.account_id
  bucket     = cloudflare_r2_bucket.public.name
  rules {
    allowed = {
      header = ["Content-Type"]
      method = ["GET", "PUT"]
      origin = ["*", var.web_origin]
    }
    max_age_seconds = 3600
  }
}

resource "cloudflare_r2_bucket_cors" "private" {
  account_id = var.account_id
  bucket     = cloudflare_r2_bucket.private.name
  rules {
    allowed = {
      header = ["Content-Type"]
      method = ["PUT"] # presigned uploads from the web origin only
      origin = [var.web_origin]
    }
    max_age_seconds = 3600
  }
}
