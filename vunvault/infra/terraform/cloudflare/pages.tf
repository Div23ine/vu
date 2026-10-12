# The Pages project (Task 99). Terraform owns the PROJECT and its custom
# domains; CI owns the DEPLOYMENTS (wrangler pages deploy, Task 102) — hence
# the ignore_changes: the two must not fight over deployment_configs.
# Only PUBLIC values are set here: NEXT_PUBLIC_* vars are inlined into the
# client bundle by design and contain nothing secret.

resource "cloudflare_pages_project" "web" {
  account_id        = var.account_id
  name              = "vunvault-web-${var.environment}"
  production_branch = var.pages_branch

  build_config {
    build_command   = "pnpm install --frozen-lockfile && pnpm --filter web pages:build"
    destination_dir = "apps/web/.vercel/output/static"
    root_dir        = "/"
  }

  deployment_configs {
    environment {
      environment_type = "production"
      plain_text {
        name  = "NEXT_PUBLIC_API_URL"
        value = "https://${local.api_hostname}"
      }
      plain_text {
        name  = "NEXT_PUBLIC_SITE_URL"
        value = "https://${local.www_hostname}"
      }
      plain_text {
        name  = "NEXT_PUBLIC_R2_HOST"
        value = "https://${var.assets_hostname}"
      }
      plain_text {
        name  = "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
        value = var.stripe_publishable_key # publishable by design
      }
      plain_text {
        name  = "NODE_VERSION"
        value = "22"
      }
      plain_text {
        name  = "PNPM_VERSION"
        value = var.pnpm_version
      }
    }
  }

  lifecycle {
    ignore_changes = [deployment_configs]
  }
}

resource "cloudflare_pages_domain" "www" {
  account_id   = var.account_id
  project_name = cloudflare_pages_project.web.name
  domain       = local.www_hostname
}

resource "cloudflare_pages_domain" "apex" {
  account_id   = var.account_id
  project_name = cloudflare_pages_project.web.name
  domain       = var.environment == "production" ? var.zone_name : "${var.environment}.${var.zone_name}"
}
