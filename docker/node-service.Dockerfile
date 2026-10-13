# syntax=docker/dockerfile:1.7
#
# VUNVAULT node-service image (Task 97) — ONE parametrised Dockerfile for all
# five Node services: api, broadcast-worker, notify-worker, maintenance-worker
# and scan-worker (the controller). `docker-bake.hcl` selects the service with
# the APP build arg; nothing else differs between them.
#
# The two base images have NO defaults on purpose: they are pinned BY DIGEST in
# CI repository variables (Task 102) and a build without them must fail loudly
# rather than silently pulling `latest`. This file never invents a digest.
#
# Hardening contract (enforced by scripts/verify-dockerfiles.mjs):
#   - multi-stage; the final stage is distroless — no shell, no package
#     manager, no apt-get, nothing to escalate with;
#   - USER 65532:65532 (the distroless `nonroot` uid), never root;
#   - runs under readOnlyRootFilesystem: the only writable path is /tmp, which
#     Helm mounts as an emptyDir (Task 100);
#   - no EXPOSE (documentation only, below), no HEALTHCHECK (Kubernetes probes
#     own liveness), no ENV/ARG whose name smells of a secret;
#   - secrets never exist at build time: the app reads them from OCI Vault at
#     runtime through its SECRETS_PROVIDER.
#
# The API listens on $PORT (8080 by convention); the workers expose their
# health endpoints on $HEALTH_PORT (8081). Ports are declared in the Helm
# charts, not here.

ARG NODE_BUILD_IMAGE
ARG DISTROLESS_IMAGE

# ——————————————————————————————————————————————— base: the toolchain
FROM ${NODE_BUILD_IMAGE} AS base
RUN corepack enable
WORKDIR /repo

# ————————————————————————————————————— fetch: lockfile-only dependency pull
# Only the workspace manifests are copied, so source edits do not invalidate
# the (cached) dependency fetch.
FROM base AS fetch
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/lib/package.json packages/lib/
COPY packages/ui/package.json packages/ui/
COPY apps/api/package.json apps/api/
COPY apps/broadcast-worker/package.json apps/broadcast-worker/
COPY apps/maintenance-worker/package.json apps/maintenance-worker/
COPY apps/notify-worker/package.json apps/notify-worker/
COPY apps/scan-worker/package.json apps/scan-worker/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --frozen-lockfile --store-dir /pnpm/store

# ————————————————————————————————————————————— build: compile ONE service
FROM fetch AS build
ARG APP
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --store-dir /pnpm/store \
    && pnpm --filter "${APP}..." build

# ——————————————————————————————— prune: production-only deployment tree
FROM build AS prune
ARG APP
# `--legacy` runs pnpm 9's standalone deploy (no injected-workspace config).
RUN pnpm --filter "${APP}" deploy --prod --legacy /out \
    # Entrypoint normalisation (planner decision, Task 97): the API compiles to
    # dist/server.js, every worker to dist/main.js. A relative symlink gives
    # ALL services the same CMD — bake args cannot override an exec-form CMD,
    # and distroless has no shell to expand one.
    && if [ -f /out/dist/server.js ] && [ ! -f /out/dist/main.js ]; then \
         ln -s server.js /out/dist/main.js; \
       fi

# ——————————————————————————————————————————— runtime: distroless, non-root
FROM ${DISTROLESS_IMAGE} AS runtime
ARG APP
ARG GIT_REVISION
ARG CREATED
WORKDIR /app
COPY --from=prune --chown=65532:65532 /out /app
USER 65532:65532
ENV NODE_ENV=production
ENV NODE_OPTIONS=--enable-source-maps
LABEL org.opencontainers.image.title="${APP}" \
      org.opencontainers.image.source="https://github.com/Div23ine/vu" \
      org.opencontainers.image.revision="${GIT_REVISION}" \
      org.opencontainers.image.created="${CREATED}"
ENTRYPOINT ["/nodejs/bin/node"]
CMD ["dist/main.js"]
