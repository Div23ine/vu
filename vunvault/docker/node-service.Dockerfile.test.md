# `node-service.Dockerfile` — manual verification checklist

Static policy is `pnpm verify:docker`. These are the checks that need a Docker
daemon; run them once per base-image bump and once per recipe change (the
person bumping the digest records the results in the PR description).

```sh
# 0. Prerequisites — the pinned base images come from CI repository variables.
export NODE_BUILD_IMAGE=node:22-bookworm-slim@sha256:<digest>
export DISTROLESS_IMAGE=gcr.io/distroless/nodejs22-debian12:nonroot@sha256:<digest>

# 1. Every service builds (repeat APP for all five).
docker build -f docker/node-service.Dockerfile \
  --build-arg NODE_BUILD_IMAGE --build-arg DISTROLESS_IMAGE \
  --build-arg APP=api --build-arg GIT_REVISION=$(git rev-parse HEAD) \
  --build-arg CREATED=$(date -u +%FT%TZ) -t vv/api:manual .

# 2. The image is non-root, distroless and labelled.
docker inspect vv/api:manual --format '{{.Config.User}}'          # → 65532:65532
docker inspect vv/api:manual --format '{{json .Config.Labels}}'  # title/source/revision/created
docker inspect vv/api:manual --format '{{json .Config.Entrypoint}} {{json .Config.Cmd}}'
#  → ["/nodejs/bin/node"] ["dist/main.js"]   (the API's symlink normalisation)

# 3. No shell, no package manager in the final stage.
docker run --rm --entrypoint /bin/sh vv/api:manual -c true        # → must FAIL (no /bin/sh)
docker history vv/api:manual | grep -iE 'secret|token|password'  # → no output

# 4. Runs read-only, capability-dropped, as the nonroot uid — the way Helm
#    (Task 100) will run it. The API answers on $PORT.
docker run --rm --read-only --cap-drop ALL --user 65532:65532 \
  --tmpfs /tmp -e PORT=8080 -p 8080:8080 vv/api:manual &
sleep 3 && curl -fsS http://localhost:8080/healthz                 # → 200 ok

# 5. A worker image passes the same runtime gate on its health port.
docker build -f docker/node-service.Dockerfile \
  --build-arg NODE_BUILD_IMAGE --build-arg DISTROLESS_IMAGE \
  --build-arg APP=maintenance-worker -t vv/maintenance-worker:manual .
docker run --rm --read-only --cap-drop ALL --user 65532:65532 \
  --tmpfs /tmp -e HEALTH_PORT=8081 -e REDIS_URL=redis://invalid \
  -e DATABASE_URL=postgres://invalid -p 8081:8081 vv/maintenance-worker:manual &
sleep 3 && curl -fsS http://localhost:8081/healthz || echo "expected: exits on invalid infra — check logs, not the probe"

# 6. The scan runner (Task 87 recipe) still verifies its downloads.
docker build -f apps/scan-worker/Dockerfile.runner \
  --build-arg NMAP_VERSION=… --build-arg NUCLEI_VERSION=… --build-arg NUCLEI_SHA256=… \
  --build-arg HTTPX_VERSION=… --build-arg HTTPX_SHA256=… --build-arg TESTSSL_VERSION=… \
  --build-arg TESTSSL_SHA256=… --build-arg NUCLEI_TEMPLATES_REF=… -t vv/scan-runner:manual .
docker run --rm --read-only --cap-drop ALL --user 65532:65532 --tmpfs /tmp \
  --entrypoint /usr/bin/nmap vv/scan-runner:manual --version        # → nmap banner
```
