# Docker Deployment

The Docker image packages the Go API and built Vite frontend into one container. Nginx serves the frontend and proxies `/api/*` to the API over the container loopback interface.

## Build

From the repository root:

```bash
docker buildx build --platform linux/amd64 -t app-template:local -f docker/Dockerfile . --load
```

The command must run from the repository root so `app/`, `server/`, and `docker/` are available in the build context. Set `VITE_API_ORIGIN` with `--build-arg` when the frontend must call an API outside the container. The default empty value keeps requests same-origin through Nginx:

```bash
docker buildx build \
	--build-arg VITE_API_ORIGIN=https://api.example.com \
	--platform linux/amd64 \
	-t app-template:local \
	-f docker/Dockerfile . \
	--load
```

To build for multiple platforms and publish directly to a registry:

```bash
docker buildx build \
	--platform linux/amd64,linux/arm64 \
	-t your-registry/app-template:latest \
	-f docker/Dockerfile . \
	--push
```

## Run

The compose file builds the image locally and publishes it on port `3000`:

```bash
docker compose -f docker/docker-compose.yml up --build
```

To run the locally tagged image directly without Compose:

```bash
docker run --rm \
	--name app-template \
	-p 3000:80 \
	app-template:local
```

Open `http://localhost:3000`. The container serves the built frontend through Nginx and proxies `/api/*` to the Go API running inside the same container.

Use `APP_PORT` to change the host port and `APP_IMAGE` to select a prebuilt image:

```bash
APP_PORT=8088 APP_IMAGE=ghcr.io/example/app:latest \
docker compose -f docker/docker-compose.yml up
```

The compose file loads `server/.env` when it exists, so application-specific settings stay outside the reusable Docker files.
