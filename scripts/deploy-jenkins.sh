#!/bin/bash

set -e

cd "$(dirname "$0")"

docker compose -f ../jenkins-compose.yaml up -d

docker compose -f ../jenkins-compose.yaml exec -T jenkins bash -c '
	apt update && apt install -y python3
	curl -fsSL -o /usr/local/bin/kubectl "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
	chmod +x /usr/local/bin/kubectl
	curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
'

echo "Jenkins URL: http://127.0.0.1:8080"
