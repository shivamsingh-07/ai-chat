#!/bin/bash

set -e

echo "Deploying variables..."
kubectl apply -f ../kubernetes/variables.yaml

echo "Deploying database..."
kubectl apply -f ../kubernetes/database.yaml
kubectl wait --for=condition=Ready pods -l app=chat-db --timeout=180s

echo "Deploying model..."
kubectl apply -f ../kubernetes/model.yaml
kubectl wait --for=condition=Ready pods -l app=chat-model --timeout=300s

echo "Deploying application..."
kubectl apply -f ../kubernetes/application.yaml

echo "Deployment complete!"
