// VUNVAULT image builds (Task 97).
//
// Every input that could drift is a variable with an EMPTY default: CI (Task
// 102) supplies the registry, the pinned base-image digests and the scan-tool
// versions/checksums from repository variables. Nothing here invents a digest,
// and a local `docker buildx bake` without the image args fails in the
// Dockerfile's first FROM rather than pulling `latest`.
//
//   REGISTRY=… TAG=… GIT_SHA=… CREATED=… \
//   NODE_BUILD_IMAGE=node:22-bookworm-slim@sha256:… \
//   DISTROLESS_IMAGE=gcr.io/distroless/nodejs22-debian12:nonroot@sha256:… \
//   docker buildx bake

variable "REGISTRY" { default = "" }
variable "TAG" { default = "dev" }
variable "GIT_SHA" { default = "" }
variable "CREATED" { default = "" }

// Base images — pinned BY DIGEST by the caller (never defaulted here).
variable "NODE_BUILD_IMAGE" { default = "" }
variable "DISTROLESS_IMAGE" { default = "" }

// Scan-tool inputs for the runner image (Task 87); checksums are mandatory
// there — its Dockerfile verifies every download with `sha256sum -c`.
variable "NMAP_VERSION" { default = "" }
variable "NMAP_PACKAGE" { default = "" }
variable "NUCLEI_VERSION" { default = "" }
variable "NUCLEI_SHA256" { default = "" }
variable "HTTPX_VERSION" { default = "" }
variable "HTTPX_SHA256" { default = "" }
variable "TESTSSL_VERSION" { default = "" }
variable "TESTSSL_SHA256" { default = "" }
variable "NUCLEI_TEMPLATES_REF" { default = "" }

group "default" {
  targets = [
    "api",
    "broadcast-worker",
    "notify-worker",
    "maintenance-worker",
    "scan-controller",
    "scan-runner",
  ]
}

target "_common" {
  context    = "."
  platforms  = ["linux/amd64"]
  args = {
    NODE_BUILD_IMAGE = NODE_BUILD_IMAGE
    DISTROLESS_IMAGE = DISTROLESS_IMAGE
    GIT_REVISION     = GIT_SHA
    CREATED          = CREATED
  }
  // GitHub Actions cache; harmless no-op placeholders for local builds.
  cache-from = ["type=gha"]
  cache-to   = ["type=gha,mode=max"]
  provenance = true
  sbom       = true
}

target "api" {
  inherits   = ["_common"]
  dockerfile = "docker/node-service.Dockerfile"
  args       = { APP = "api" }
  tags = [
    "${REGISTRY}/vv/api:${TAG}",
    "${REGISTRY}/vv/api:${GIT_SHA}",
  ]
}

target "broadcast-worker" {
  inherits   = ["_common"]
  dockerfile = "docker/node-service.Dockerfile"
  args       = { APP = "broadcast-worker" }
  tags = [
    "${REGISTRY}/vv/broadcast-worker:${TAG}",
    "${REGISTRY}/vv/broadcast-worker:${GIT_SHA}",
  ]
}

target "notify-worker" {
  inherits   = ["_common"]
  dockerfile = "docker/node-service.Dockerfile"
  args       = { APP = "notify-worker" }
  tags = [
    "${REGISTRY}/vv/notify-worker:${TAG}",
    "${REGISTRY}/vv/notify-worker:${GIT_SHA}",
  ]
}

target "maintenance-worker" {
  inherits   = ["_common"]
  dockerfile = "docker/node-service.Dockerfile"
  args       = { APP = "maintenance-worker" }
  tags = [
    "${REGISTRY}/vv/maintenance-worker:${TAG}",
    "${REGISTRY}/vv/maintenance-worker:${GIT_SHA}",
  ]
}

target "scan-controller" {
  inherits   = ["_common"]
  dockerfile = "docker/node-service.Dockerfile"
  args       = { APP = "scan-worker" }
  tags = [
    "${REGISTRY}/vv/scan-controller:${TAG}",
    "${REGISTRY}/vv/scan-controller:${GIT_SHA}",
  ]
}

target "scan-runner" {
  inherits   = ["_common"]
  dockerfile = "apps/scan-worker/Dockerfile.runner"
  args = {
    NMAP_VERSION         = NMAP_VERSION
    NMAP_PACKAGE         = NMAP_PACKAGE
    NUCLEI_VERSION       = NUCLEI_VERSION
    NUCLEI_SHA256        = NUCLEI_SHA256
    HTTPX_VERSION        = HTTPX_VERSION
    HTTPX_SHA256         = HTTPX_SHA256
    TESTSSL_VERSION      = TESTSSL_VERSION
    TESTSSL_SHA256       = TESTSSL_SHA256
    NUCLEI_TEMPLATES_REF = NUCLEI_TEMPLATES_REF
    SOURCE_COMMIT        = GIT_SHA
    BUILD_DATE           = CREATED
  }
  tags = [
    "${REGISTRY}/vv/scan-runner:${TAG}",
    "${REGISTRY}/vv/scan-runner:${GIT_SHA}",
  ]
}
