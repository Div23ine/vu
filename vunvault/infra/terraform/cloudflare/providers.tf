# The API token arrives through the CLOUDFLARE_API_TOKEN environment variable
# (a CI environment secret). It is never written to a file, a variable default
# or the state — and scripts that touch it mask it with ::add-mask::.
provider "cloudflare" {}
