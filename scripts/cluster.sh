#!/bin/bash

set -e

PROFILE="ai-chat"

cluster_exists() {
	minikube profile list -o json | grep -q "$PROFILE"
}

create_cluster() {
	echo "🚀 Creating 4-node cluster (1 master + 2 workers)..."
	minikube start -p $PROFILE --nodes 3 --memory 2048 --cni=cilium

	echo "⏳ Waiting for nodes to be ready..."
	kubectl wait --for=condition=Ready nodes --all --timeout=180s

	echo "🏷️ Labeling worker nodes..."
	kubectl label node ${PROFILE}-m02 node-role.kubernetes.io/worker=worker
	kubectl label node ${PROFILE}-m03 node-role.kubernetes.io/worker=worker

	echo "🚫 Tainting control-plane..."
	kubectl taint nodes ${PROFILE} node-role.kubernetes.io/control-plane=:NoSchedule --overwrite

	echo "📊 Enabling metrics server..."
	minikube addons enable metrics-server -p $PROFILE

	echo "💾 Enabling rancher local-path storage provisioner..."
	minikube addons enable storage-provisioner-rancher -p $PROFILE

	echo "✅ Cluster ready!"
	kubectl get nodes -o wide
}

start_cluster() {
	if cluster_exists; then
		echo "▶️ Starting existing cluster..."
		minikube start -p $PROFILE
		echo "✅ Cluster ready!"
		kubectl get nodes -o wide
	else
		echo "⚠️ Cluster not found. Creating a new one..."
		create_cluster
		return
	fi
}

stop_cluster() {
	if cluster_exists; then
		echo "🛑 Stopping cluster..."
		minikube stop -p $PROFILE
		echo "⏸️ Cluster stopped."
	else
		echo "⚠️ Cluster does not exist."
	fi
}

delete_cluster() {
	if cluster_exists; then
		echo "🔥 Deleting cluster..."
		minikube delete -p $PROFILE
		echo "🗑️ Cluster deleted."
	else
		echo "⚠️ Cluster does not exist."
	fi
}

status_cluster() {
	if cluster_exists; then
		echo "📊 Cluster status:"
		minikube status -p $PROFILE
		kubectl get nodes
	else
		echo "⚠️ Cluster does not exist."
	fi
}

case "$1" in
create)
	create_cluster
	;;
start)
	start_cluster
	;;
stop)
	stop_cluster
	;;
delete)
	delete_cluster
	;;
status)
	status_cluster
	;;
*)
	echo "Usage: $0 {create|start|stop|delete|status}"
	exit 1
	;;
esac
