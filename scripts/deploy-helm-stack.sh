#!/bin/bash

set -e

NAMESPACE="chat-app"
MONITORING_NS="monitoring"

cd "$(dirname "$0")"

if ! helm version &>/dev/null; then
	echo "Helm is not installed!"
	exit 1
fi

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>/dev/null || true
helm repo add grafana https://grafana.github.io/helm-charts 2>/dev/null || true

echo "Updating Helm chart dependencies..."
helm dependency update ../helm

echo "Deploying Prometheus stack..."
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
	--namespace "$MONITORING_NS" \
	--create-namespace \
	-f ../helm/monitoring/prometheus-values.yaml \
	--wait \
	--timeout 300s

echo "Deploying Loki..."
helm upgrade --install loki grafana/loki \
	--namespace "$MONITORING_NS" \
	-f ../helm/monitoring/loki-values.yaml \
	--wait \
	--timeout 300s

echo "Deploying Grafana Alloy..."
helm upgrade --install alloy grafana/alloy \
	--namespace "$MONITORING_NS" \
	-f ../helm/monitoring/alloy-values.yaml \
	--wait \
	--timeout 300s

echo "Deploying AI Chat app..."
helm upgrade --install ai-chat ../helm \
	--namespace "$NAMESPACE" \
	--create-namespace \
	--wait \
	--timeout 600s

echo "Deployment complete!"
