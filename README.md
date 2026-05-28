# AI Chat

AI chat application built with Express.js, MongoDB, and Ollama.

## Features

- AI chat with Ollama
- Session-based conversations
- Message persistence
- Structured logging (`pino`)
- Prometheus metrics (`/metrics`, request duration histogram + Node.js runtime)
- Grafana dashboards for metrics, MongoDB, and **Service Logs** (`grafana/`)
- Plain Kubernetes manifests and a Helm chart for cluster deploys
- Minimal frontend UI

## Requirements

- Node.js 24+
- MongoDB
- Ollama (with desired model pulled)

## Installation

1. Clone the repository:
    ```bash
    git clone <repo-url>
    cd ai-chat
    ```
2. Install dependencies:
    ```bash
    npm install
    ```
3. Configure environment variables:
   Create a `.env` file in the root directory and use the **.env example** section below as a template.
4. Run the application:
    ```bash
    npm run dev
    ```

## Environment Variables

| Variable         | Example                  | Description                              |
| :--------------- | :----------------------- | :--------------------------------------- |
| `PORT`           | `5000`                   | HTTP port for the server (default: 5000) |
| `MONGO_HOST`     | `127.0.0.1:27017`        | MongoDB connection host and port         |
| `MONGO_DB`       | `ai-chat`                | Name of the MongoDB database             |
| `MONGO_USER`     | `admin`                  | MongoDB username (optional)              |
| `MONGO_PASSWORD` | `password`               | MongoDB password (optional)              |
| `OLLAMA_URL`     | `http://127.0.0.1:11434` | Ollama API base URL                      |
| `OLLAMA_MODEL`   | `smollm2:135m`           | Name of the Ollama model to use          |

## Run Commands

```bash
npm install     # Install dependencies
npm run dev     # Start development server with auto-reload
npm start       # Start production server
npm test        # Run the test suite
npm run lint    # Check code style
```

## API Endpoints

| Method   | Path                         | Purpose                             |
| :------- | :--------------------------- | :---------------------------------- |
| `POST`   | `/api/sessions`              | Create a new chat session           |
| `GET`    | `/api/sessions`              | List recent sessions                |
| `DELETE` | `/api/sessions/:id`          | Delete a session and its history    |
| `GET`    | `/api/sessions/:id/messages` | Fetch message history for a session |
| `POST`   | `/api/sessions/:id/chat`     | Send a new message to the AI        |
| `GET`    | `/health/live`               | Liveness check                      |
| `GET`    | `/health/ready`              | Readiness check (DB & AI)           |
| `GET`    | `/metrics`                   | Prometheus scrape (text format)     |

## Kubernetes

Requires [Minikube](https://minikube.sigs.k8s.io/) (or another cluster), `kubectl`, and Helm. Use `scripts/cluster.sh` to create a local profile (`ai-chat`, Cilium CNI, metrics-server). The Ollama model Deployment is scaled by a HorizontalPodAutoscaler on CPU (70%) and memory (80%) utilization; metrics-server must be running for HPA to work.

The plain-k8s script installs [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack), [Loki](https://grafana.com/docs/loki/latest/), and [Grafana Alloy](https://grafana.com/docs/alloy/latest/) into `monitoring` (see `kubernetes/prometheus-values.yaml`, `loki-values.yaml`, `alloy-values.yaml`), then deploys the app into `chat-app`. Grafana picks up dashboard ConfigMaps labeled `grafana_dashboard=1` and a Loki datasource for container logs.

Run deploy scripts from the `scripts/` directory:

```bash
cd scripts

# Plain kubectl manifests (file-by-file apply)
./deploy-k8s-stack.sh

# Kustomize — app only, two namespaces (no monitoring stack)
kubectl apply -k ../kustomize/overlays/prod
kubectl apply -k ../kustomize/overlays/dev

# Helm chart (release name must be ai-chat to match kubernetes/ names)
./deploy-helm-stack.sh
```

Both **`deploy-k8s-stack.sh`** and **`deploy-helm-stack.sh`** install the same monitoring stack (Prometheus + Loki + Alloy into `monitoring`) from shared values in `kubernetes/` (`helm/monitoring/` symlinks those files). Kustomize overlays deploy the app only — no monitoring stack. The Helm app release name must be **`ai-chat`** so resource names match the plain manifests.

**Ollama autoscaler:** `kubernetes/autoscaler.yaml` (plain kubectl), `kustomize/base/autoscaler.yaml`, and `helm/templates/autoscaler.yaml` define an HPA for the Ollama model Deployment (1–5 replicas). Tune limits in the manifest or via Helm (`autoscaler.minReplicas`, `autoscaler.maxReplicas`, `autoscaler.cpu.averageUtilization`, `autoscaler.memory.averageUtilization`).

**Dashboards:** JSON lives in `grafana/`. The Helm chart loads them via `helm/dashboards/` (symlinks into `grafana/`). The plain-k8s script creates ConfigMaps with `kubectl create configmap … --from-file` from `grafana/`. Open **AI Chat / Service Logs** for Loki log panels (pod + event filters).

**MongoDB exporter:** The Helm chart installs `prometheus-mongodb-exporter` as a dependency (alias `mongodb-exporter`, `mongodb-exporter.enabled`, `--compatible-mode`, `--collect-all`, ServiceMonitor `release: prometheus`). The plain-k8s script installs the same exporter as a separate Helm release.

**Access after deploy:**

```bash
# API (LoadBalancer — use minikube tunnel or cloud LB if EXTERNAL-IP is pending)
kubectl -n chat-app get svc ai-chat-svc

# Grafana (metrics + Loki logs)
kubectl -n monitoring port-forward svc/prometheus-grafana 3000:80
# default login admin / prom-operator (unless changed in values)
# Dashboards → AI Chat / Service Overview, AI Chat / Database Overview, AI Chat / Service Logs
# Explore → Loki → {namespace="chat-app", container="ai-chat"} |= "{"
```

Override demo credentials before production (`kubernetes/variables.yaml`, `helm/values.yaml`, or `helm upgrade --set secrets.password=...`).

## Project Structure

```text
.
├── server.js                 # Application entry (loads env, builds app, listens)
├── package.json
├── yarn.lock
├── Dockerfile                # Multi-stage Node image for the API
├── docker-compose.yaml       # Local stack: API, MongoDB, Ollama
├── eslint.config.js
│
├── app/
│   ├── app.js                # Express factory: DB init, middleware, routes, static
│   ├── routes.js             # Route tables (/health, /api/sessions)
│   ├── middleware.js         # Core middleware (logging, validation, errors)
│   ├── config/               # app, database, ollama, prometheus (metrics registry)
│   ├── controllers/          # HTTP handlers (health, session, chat)
│   ├── services/             # Chat, session, Ollama integration
│   ├── models/               # Mongoose models (session, message)
│   ├── schemas/              # Zod schemas for request/response validation
│   ├── utils/                # HTTP helpers, retries, time
│   └── public/               # Static UI (HTML, CSS, JS, assets)
│
├── grafana/                  # Grafana dashboard JSON (source of truth)
│   ├── chat-app.json         # API RED / Node.js / container metrics
│   ├── app-logs.json         # Service Logs dashboard (Loki, chat-app namespace)
│   └── mongodb.json          # MongoDB exporter dashboard
│
├── kubernetes/               # Plain manifests (kubectl apply)
│   ├── variables.yaml        # ai-chat-config + ai-chat-secrets
│   ├── database.yaml         # MongoDB StatefulSet + Service
│   ├── model.yaml            # Ollama Deployment, Service
│   ├── autoscaler.yaml       # HPA for Ollama model (CPU + memory)
│   ├── application.yaml      # API Deployment + LoadBalancer Service
│   ├── metrics.yaml          # Prometheus Operator ServiceMonitor
│   ├── prometheus-values.yaml # kube-prometheus-stack + Grafana Loki datasource
│   ├── loki-values.yaml      # Loki SingleBinary + filesystem storage (Helm)
│   └── alloy-values.yaml     # Alloy log shipping from chat-app (Helm)
├── kustomize/                # Kustomize app deploy (no ServiceMonitor / exporter / monitoring)
│   ├── base/                 # database, model, application, autoscaler
│   └── overlays/
│       ├── dev/              # namespace chat-app-dev, config.env, secret.env
│       └── prod/             # namespace chat-app-prod, config.env, secret.env
│
├── helm/                     # Helm chart (parallel to kubernetes/)
│   ├── Chart.yaml            # declares prometheus-mongodb-exporter dependency
│   ├── Chart.lock            # pinned dependency versions (helm dependency update)
│   ├── values.yaml           # image, ports, replicas, secrets, mongo exporter subchart
│   ├── monitoring/           # symlinks → ../kubernetes/*-values.yaml (Loki, Alloy, Prometheus)
│   ├── dashboards/           # symlinks → ../grafana/*.json (packaged by chart)
│   └── templates/
│       ├── variables.yaml    # ConfigMap + Secret
│       ├── database.yaml     # MongoDB StatefulSet + Service
│       ├── model.yaml        # Ollama Deployment, Service
│       ├── autoscaler.yaml   # HPA for Ollama model (CPU + memory)
│       ├── application.yaml  # API Deployment + Service
│       ├── metrics.yaml      # ServiceMonitor
│       ├── dashboard.yaml    # Grafana dashboard ConfigMaps
│       └── NOTES.txt         # Post-install notes
│
├── scripts/
│   ├── cluster.sh            # Minikube profile lifecycle (create/start/stop/delete/status)
│   ├── deploy-k8s-stack.sh   # Monitoring (Prometheus, Loki, Alloy) + kubectl apply + dashboards + mongo-exporter
│   ├── deploy-helm-stack.sh  # Monitoring (Prometheus, Loki, Alloy) + helm upgrade --install ai-chat
│   └── generate-load.sh      # Sample API traffic for metrics and log dashboards
│
└── tests/
    ├── integration/          # HTTP tests against the app
    ├── unit/                 # Unit tests (config, validation, errors, utils)
    ├── helpers/              # Test app factory, mocks, silent logger
    └── fixtures/             # Shared test data (e.g. UUIDs)
```

## Notes

- Use `npm run dev` for the best development experience with hot-reloading.
- Ensure Ollama is running locally and the model in `OLLAMA_MODEL` (default `smollm2:135m`) is pulled before chatting.
- `docker-compose.yaml` is the simplest local stack; use Kubernetes scripts when testing probes, metrics, and Grafana.
