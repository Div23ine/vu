# TFLint (Task 98). CI runs `tflint --recursive` over infra/terraform; these
# plugins encode the platform's rules at lint level (the hard security rules
# live in scripts/verify-terraform.mjs, which needs no toolchain).
plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

plugin "oci" {
  enabled = true
  source  = "github.com/oracle/terraform-provider-oci"
  # Version pinned by CI's tflint plugin install step (Task 101).
}

rule "terraform_naming_convention" {
  enabled = true
}

rule "terraform_documented_variables" {
  enabled = false # the modules' variables carry descriptions where they decide policy
}
