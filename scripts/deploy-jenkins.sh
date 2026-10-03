#!/bin/bash

set -e

cd "$(dirname "$0")"

for bin in /usr/bin/docker /usr/local/bin/kubectl /usr/local/bin/trivy; do
    if [[ ! -x "$bin" ]]; then
        echo "Missing required host binary: $bin"
        echo "Install Docker, kubectl, and Trivy on the host before starting Jenkins."
        exit 1
    fi
done

docker compose -f jenkins-compose.yaml up -d

docker compose -f jenkins-compose.yaml exec -T jenkins \
    bash -c 'apt-get update && apt-get install -y python3'

echo "Jenkins URL: http://127.0.0.1:8080"
