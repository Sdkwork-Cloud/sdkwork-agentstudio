FROM debian:bookworm-slim

WORKDIR /opt/claw

ENV CLAW_SERVER_HOST=0.0.0.0 \
    CLAW_SERVER_PORT=18797 \
    CLAW_SERVER_DATA_DIR=/var/lib/clawstudio-server \
    CLAW_SERVER_WEB_DIST=/opt/claw/app/web/dist

COPY app ./app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /var/lib/clawstudio-server \
  && chmod +x /opt/claw/app/bin/clawstudio-server

EXPOSE 18797

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:18797/claw/health/ready || exit 1

CMD ["/opt/claw/app/bin/clawstudio-server"]
