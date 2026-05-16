#!/bin/bash

set -e

cd "$(dirname "$0")"

if ! helm version &>/dev/null; then
	echo "Helm is not installed!"
	exit 1
fi

if ! helm list -n monitoring | grep -q "prometheus"; then
	echo "Deploying Prometheus stack..."
	helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
	helm upgrade --install "prometheus" "prometheus-community/kube-prometheus-stack" \
		--namespace "monitoring" \
		--create-namespace \
		--wait \
		--timeout 300s
fi

echo "Updating Helm chart dependencies..."
helm dependency update ../helm

echo "Deploying AI Chat app..."
helm upgrade --install "ai-chat" "../helm" \
	--namespace "chat-app" \
	--create-namespace \
	--wait \
	--timeout 600s

echo "Deployment complete!"
