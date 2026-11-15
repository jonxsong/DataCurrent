#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl docker.io docker-compose-v2 git unattended-upgrades
systemctl enable --now docker

install -d -m 0755 /opt/datacurrent
if [[ ! -d /opt/datacurrent/.git ]]; then
  git clone --branch main --single-branch https://github.com/jonxsong/DataCurrent.git /opt/datacurrent
else
  git -C /opt/datacurrent pull --ff-only origin main
fi

install -d -m 0700 /opt/datacurrent/infrastructure/deployment/runtime
