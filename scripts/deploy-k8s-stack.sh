#!/bin/bash

set -e

NAMESPACE="chat-app"

cd "$(dirname "$0")"

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

echo "Application deployment complete!"
