#!/usr/bin/env bash
# One chart, one atomic upgrade (Task 102).
#
# Usage: helm-deploy.sh <chart> <digests.json>
# Env:   REGISTRY (OCIR host/namespace), ENVIRONMENT (staging|production),
#        GIT_SHA (tag for humans; the digest is what actually runs).
#
# --atomic --wait: a failed rollout rolls ITSELF back, so the pipeline never
# leaves a half-deployed release behind. Per-environment values come from
# infra/helm/values-<env>.yaml when that file exists, and the Vault OCID map
# rendered by render-secret-map.mjs when it does.
set -euo pipefail

CHART="${1:?usage: helm-deploy.sh <chart> <digests.json>}"
DIGESTS_FILE="${2:?usage: helm-deploy.sh <chart> <digests.json>}"
ENVIRONMENT="${ENVIRONMENT:?ENVIRONMENT is required}"
REGISTRY="${REGISTRY:?REGISTRY is required}"
GIT_SHA="${GIT_SHA:-main}"

RELEASE="vv-${CHART}"
NAMESPACE="vunvault"
[ "$CHART" = "scan-controller" ] && NAMESPACE="vv-scans"

# Pin BY DIGEST. The tag is decoration for `helm history`; the digest is the
# immutable artefact the release job scanned and signed.
IMAGE="$(node -e '
  const [file, chart, registry] = process.argv.slice(1);
  const digests = JSON.parse(require("node:fs").readFileSync(file, "utf8"));
  const entry = digests[chart];
  if (entry === undefined || entry.digest === undefined || entry.digest === "") {
    console.error(`no pushed digest for "${chart}" in ${file}`);
    process.exit(1);
  }
  console.log(`${registry}/vv/${chart}@${entry.digest}`);
' "$DIGESTS_FILE" "$CHART" "$REGISTRY")"

ARGS=(
  upgrade --install "$RELEASE" "infra/helm/$CHART"
  --namespace "$NAMESPACE"
  --atomic --wait --timeout 10m
  --set "image.repository=${REGISTRY}/vv/${CHART}"
  --set "image.tag=${GIT_SHA}"
  --set "image.digest=${IMAGE#*@}"
)

VALUES_FILE="infra/helm-values/values-${ENVIRONMENT}.yaml"
if [ -f "$VALUES_FILE" ]; then
  ARGS+=(--values "$VALUES_FILE")
fi

SECRET_MAP="artifacts/secret-maps/${CHART}.json"
if [ -f "$SECRET_MAP" ]; then
  KEY="ociSecretMap"
  [ "$CHART" != "api" ] && KEY="vaultSecrets"
  ARGS+=(--set-json "${KEY}=$(cat "$SECRET_MAP")")
fi

echo "helm ${RELEASE} → ${IMAGE} (namespace ${NAMESPACE}, environment ${ENVIRONMENT})"
helm "${ARGS[@]}"
