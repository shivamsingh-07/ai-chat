#!/bin/bash

set -e

NAMESPACE="chat-app"

cd "$(dirname "$0")"

if ! helm version &>/dev/null; then
	echo "Helm is required to install kube-prometheus-stack."
	exit 1
fi

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>/dev/null || true
helm repo add grafana https://grafana.github.io/helm-charts 2>/dev/null || true

echo "Updating Helm repositories..."
helm repo update

echo "Deploying Prometheus stack..."
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
	--namespace monitoring \
	--create-namespace \
	-f ../kubernetes/monitoring/prometheus-values.yaml \
	--wait \
	--timeout 300s

echo "Deploying Loki..."
helm upgrade --install loki grafana/loki \
	--namespace monitoring \
	-f ../kubernetes/monitoring/loki-values.yaml \
	--wait \
	--timeout 300s

echo "Deploying Grafana Alloy..."
helm upgrade --install alloy grafana/alloy \
	--namespace monitoring \
	-f ../kubernetes/monitoring/alloy-values.yaml \
	--wait \
	--timeout 300s

kubectl create namespace "$NAMESPACE" 2>/dev/null || true

echo "Deploying variables..."
kubectl apply -n "$NAMESPACE" -f ../kubernetes/variables.yaml

echo "Deploying database..."
kubectl apply -n "$NAMESPACE" -f ../kubernetes/database.yaml
kubectl wait -n "$NAMESPACE" --for=condition=Ready pods -l app=ai-chat-db --timeout=180s

echo "Deploying model..."
kubectl apply -n "$NAMESPACE" -f ../kubernetes/model.yaml
kubectl wait -n "$NAMESPACE" --for=condition=Ready pods -l app=ai-chat-model --timeout=600s

echo "Deploying model autoscaler..."
kubectl apply -n "$NAMESPACE" -f ../kubernetes/autoscaler.yaml

echo "Deploying application..."
kubectl apply -n "$NAMESPACE" -f ../kubernetes/application.yaml

echo "Deploying ServiceMonitor..."
kubectl apply -n "$NAMESPACE" -f ../kubernetes/metrics.yaml

echo "Creating Grafana dashboards..."
kubectl create configmap ai-chat-app-dashboard \
	--from-file=chat-app.json="../grafana/chat-app.json" \
	-n "$NAMESPACE" \
	--dry-run=client -o yaml |
	kubectl label --local -f - grafana_dashboard=1 -o yaml |
	kubectl apply -f -

kubectl create configmap ai-chat-mongodb-dashboard \
	--from-file=mongodb.json="../grafana/mongodb.json" \
	-n "$NAMESPACE" \
	--dry-run=client -o yaml |
	kubectl label --local -f - grafana_dashboard=1 -o yaml |
	kubectl apply -f -

kubectl create configmap ai-chat-app-logs-dashboard \
	--from-file=app-logs.json="../grafana/app-logs.json" \
	-n "$NAMESPACE" \
	--dry-run=client -o yaml |
	kubectl label --local -f - grafana_dashboard=1 -o yaml |
	kubectl apply -f -

helm upgrade --install "mongo-exporter" "prometheus-community/prometheus-mongodb-exporter" \
	--namespace "$NAMESPACE" \
	--set "mongodb.uri=mongodb://admin:password@ai-chat-db-svc:27017/?authSource=admin" \
	--set "extraArgs[0]=--compatible-mode" \
	--set "extraArgs[1]=--collect-all" \
	--set "customLabels.release=prometheus" \
	--set "serviceMonitor.enabled=true" \
	--set "serviceMonitor.interval=15s"

echo "Deployment complete!"
