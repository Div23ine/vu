# VUNVAULT container images (Task 97)

Six images, one recipe each: the five Node services share
`docker/node-service.Dockerfile` (parametrised by `APP`); the scan runner has
its own hardened recipe at `apps/scan-worker/Dockerfile.runner` (Task 87).

## Build

```sh
REGISTRY=ghcr.io/div23ine TAG=dev GIT_SHA=$(git rev-parse HEAD) CREATED=$(date -u +%FT%TZ) \
NODE_BUILD_IMAGE=node:22-bookworm-slim@sha256:<digest> \
DISTROLESS_IMAGE=gcr.io/distroless/nodejs22-debian12:nonroot@sha256:<digest> \
NMAP_VERSION=… NUCLEI_VERSION=… NUCLEI_SHA256=… HTTPX_VERSION=… HTTPX_SHA256=… \
TESTSSL_VERSION=… TESTSSL_SHA256=… NUCLEI_TEMPLATES_REF=… \
docker buildx bake
```

`REGISTRY`, the two base-image digests and the tool versions/checksums come
from CI repository variables (Task 102) — **no digest is committed to git**,
because a stale committed digest is a silent supply-chain pin. Without
`NODE_BUILD_IMAGE`/`DISTROLESS_IMAGE` the build fails at the first `FROM`
(the ARGs have no defaults) rather than pulling `latest`.

## Why distroless

The final stage has no shell, no package manager and no ambient tooling: the
attack surface after a hypothetical RCE is a Node binary, the app's own code
and nothing to escalate with. Combined with `USER 65532`, a read-only root
filesystem (only `/tmp`, an emptyDir in Helm) and dropped capabilities, the
image assumes it will run inside a hostile cluster. The scan runner is the one
exception: it must carry nmap/nuclei/httpx/testssl, so instead of distroless
it pins every download and verifies it with `sha256sum -c` at build time.

## Policy

`pnpm verify:docker` runs `scripts/verify-dockerfiles.mjs` over every
Dockerfile in the repo (rules: multi-stage, digest/ARG base images, numeric
non-root USER, no `latest`, no remote `ADD`, no pipe-to-shell, no
secret-shaped ARG/ENV, no privilege escalation, distroless finals, runner
checksums). CI fails on any violation — see `node-service.Dockerfile.test.md`
for the manual runtime checks a human runs once per base-image bump.
