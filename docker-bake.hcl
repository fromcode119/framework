// Image build definition for CI.
//
// Every target below forks from the SAME `builder` stage in the Dockerfile. Building them in one
// `bake` invocation means BuildKit resolves base + builder ONCE and branches — four separate
// `docker build` calls would repeat the expensive npm install and compile four times over.
//
// Local use is identical to CI, which is the point:
//   docker buildx bake                 # build all targets locally
//   docker buildx bake api             # just one
//   VERSION=v2.0.1 docker buildx bake --push

variable "REGISTRY" { default = "ghcr.io/fromcode119" }

// Set by CI from the git tag. Locally it stays "dev" so a stray local build can never be mistaken
// for a release, and can never overwrite one in the registry.
variable "VERSION" { default = "dev" }

group "default" {
  targets = ["api", "admin", "frontend", "gateway"]
}

// Shared by every target. `linux/amd64` only, deliberately: both servers are amd64 and adding arm64
// would double build time to produce an image nothing here can run.
target "_common" {
  context    = "."
  dockerfile = "Dockerfile"
  platforms  = ["linux/amd64"]
  cache-from = ["type=gha"]
  cache-to   = ["type=gha,mode=max"]
}

target "api" {
  inherits = ["_common"]
  target   = "api-only"
  tags     = ["${REGISTRY}/framework-api:${VERSION}", "${REGISTRY}/framework-api:latest"]
}

target "admin" {
  inherits = ["_common"]
  target   = "admin-only"
  tags     = ["${REGISTRY}/framework-admin:${VERSION}", "${REGISTRY}/framework-admin:latest"]
}

target "frontend" {
  inherits = ["_common"]
  target   = "frontend-only"
  tags     = ["${REGISTRY}/framework-frontend:${VERSION}", "${REGISTRY}/framework-frontend:latest"]
}

// Only needed for single-domain deployments, where the gateway is the ingress. A host that puts
// Traefik (or any other proxy) in front does not run this.
target "gateway" {
  inherits = ["_common"]
  target   = "gateway-only"
  tags     = ["${REGISTRY}/framework-gateway:${VERSION}", "${REGISTRY}/framework-gateway:latest"]
}
