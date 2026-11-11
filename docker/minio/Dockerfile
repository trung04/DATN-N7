# MinIO Community is source-only. Pin the release that includes the October 2025 fix.
FROM golang:1.26-alpine AS build

ARG MINIO_RELEASE=RELEASE.2025-10-15T17-29-55Z

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOBIN=/out go install -p 2 -ldflags="-s -w" github.com/minio/minio@${MINIO_RELEASE}

FROM alpine:3.23

RUN apk add --no-cache ca-certificates curl \
    && addgroup -S -g 10001 minio \
    && adduser -S -u 10001 -G minio minio \
    && mkdir -p /data \
    && chown minio:minio /data

COPY --from=build /out/minio /usr/local/bin/minio

USER minio
EXPOSE 9000 9001
VOLUME ["/data"]
ENTRYPOINT ["/usr/local/bin/minio"]
CMD ["server", "/data", "--address", ":9000", "--console-address", ":9001"]
