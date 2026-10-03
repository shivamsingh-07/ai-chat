#!/bin/bash

set -e

NAMESPACE="chat-app"
MONITORING_NS="monitoring"

cd "$(dirname "$0")"

if ! helm version &>/dev/null; then
    echo "Helm is required to install the observability stack."
    exit 1
fi

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>/dev/null || true
helm repo add grafana https://grafana.github.io/helm-charts 2>/dev/null || true

echo "Updating Helm repositories..."
helm repo update

echo "Deploying Prometheus stack..."
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
    --namespace "$MONITORING_NS" \
    --create-namespace \
    -f ../observability/monitoring/prometheus-values.yaml \
    --wait \
    --timeout 300s

echo "Deploying Loki..."
helm upgrade --install loki grafana/loki \
    --namespace "$MONITORING_NS" \
    -f ../observability/monitoring/loki-values.yaml \
    --wait \
    --timeout 300s

echo "Deploying Grafana Alloy..."
helm upgrade --install alloy grafana/alloy \
    --namespace "$MONITORING_NS" \
    -f ../observability/monitoring/alloy-values.yaml \
    --wait \
    --timeout 300s

kubectl create namespace "$NAMESPACE" 2>/dev/null || true

echo "Deploying ServiceMonitor..."
kubectl apply -n "$NAMESPACE" -f ../observability/metrics.yaml

echo "Deploying model alerts..."
kubectl apply -n "$NAMESPACE" -f ../observability/model-alerts.yaml

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

kubectl create configmap ai-chat-model-dashboard \
    --from-file=model.json="../grafana/model.json" \
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

echo "Observability stack deployed."
