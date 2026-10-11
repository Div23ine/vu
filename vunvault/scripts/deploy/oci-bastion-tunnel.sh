#!/usr/bin/env bash
# Open an OCI Bastion port-forward session to a private Kubernetes API and
# export a KUBECONFIG that points at the forwarded local port (Task 102).
#
# Usage: oci-bastion-tunnel.sh <oke|k3s>
# Env:   BASTION_ID, COMPARTMENT_ID, plus a configured OCI CLI profile.
#        KUBECONFIG_SOURCE may point at a fetched kubeconfig template whose
#        server URL gets rewritten to the local forward.
#
# The session is killed on exit — a deploy job must not leave a tunnel open.
set -euo pipefail

TARGET="${1:-oke}"
LOCAL_PORT="${LOCAL_PORT:-6443}"

case "$TARGET" in
  oke) TARGET_HOST="${OKE_API_HOST:?OKE_API_HOST must be the private endpoint hostname}" ;;
  k3s) TARGET_HOST="${K3S_API_HOST:?K3S_API_HOST must be the k3s control node IP}" ;;
  *) echo "usage: $0 <oke|k3s>" >&2; exit 2 ;;
esac

SESSION_ID="$(oci bastion session create-ported \
  --bastion-id "${BASTION_ID:?BASTION_ID is required}" \
  --target-ip-address "$TARGET_HOST" \
  --target-port 6443 \
  --session-type PORT_FORWARDING \
  --display-name "ci-${TARGET}-$(date -u +%s)" \
  --query 'data.id' --raw-output)"

cleanup() {
  oci bastion session delete --session-id "$SESSION_ID" --force >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "waiting for bastion session ${SESSION_ID} to become ACTIVE…"
for _ in $(seq 1 60); do
  STATE="$(oci bastion session get --session-id "$SESSION_ID" --query 'data."lifecycle-state"' --raw-output)"
  [ "$STATE" = "ACTIVE" ] && break
  sleep 2
done
[ "$STATE" = "ACTIVE" ] || { echo "bastion session never became ACTIVE (${STATE})" >&2; exit 1; }

# The session's ssh command carries the local forward; run it detached.
SSH_COMMAND="$(oci bastion session get --session-id "$SESSION_ID" --query 'data."ssh-metadata".command' --raw-output)"
eval "nohup ${SSH_COMMAND} >/tmp/tunnel-${TARGET}.log 2>&1 &"
TUNNEL_PID=$!
trap 'kill "$TUNNEL_PID" >/dev/null 2>&1 || true; cleanup' EXIT

# Wait for the local port to answer.
for _ in $(seq 1 30); do
  if (exec 3<>"/dev/tcp/127.0.0.1/${LOCAL_PORT}") 2>/dev/null; then break; fi
  sleep 1
done

# Point the kubeconfig at the forward. CI provides the cluster kubeconfig
# (fetched with `oci ce cluster generate-kubeconfig` for OKE, or the k3s
# server's file via the session) as KUBECONFIG already; rewrite the server.
if [ -n "${KUBECONFIG:-}" ] && [ -f "${KUBECONFIG}" ]; then
  kubectl config set-cluster "$(kubectl config current-context | cut -d/ -f2)" \
    --server="https://127.0.0.1:${LOCAL_PORT}" --insecure-skip-tls-verify=false >/dev/null
fi

echo "tunnel to ${TARGET} ready on 127.0.0.1:${LOCAL_PORT} (session ${SESSION_ID})"
