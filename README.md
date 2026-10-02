# AI ChatBot

AI chat application built with Express.js, MongoDB, and Ollama. The repository includes three deployment packaging options, a full observability stack, and a path-gated Jenkins pipeline with Discord notifications and Gemini-assisted failure analysis.

| Area          | Technology                                                |
| ------------- | --------------------------------------------------------- |
| Application   | Node.js 24, Express, MongoDB, Ollama                      |
| Packaging     | Docker, Docker Compose, Helm, Kustomize, plain manifests  |
| Cluster       | Minikube (Cilium CNI, metrics-server, local-path storage) |
| Observability | Prometheus, Loki, Grafana Alloy, Grafana                  |
| CI/CD         | Jenkins, Trivy, Discord, Gemini                           |

---

## Architecture

```text
Developer / Git push
        │
        ▼
   Jenkins pipeline
   ├── app/** changed
   │     → yarn install → lint || test → docker build → Trivy → push
   └── app/** or kubernetes/** changed
         → kubectl apply → rollout status
        │
        ▼
 Docker Hub ──► Kubernetes (chat-app)
                    ├── ai-chat (API + UI)
                    ├── MongoDB
                    ├── Ollama (+ HPA)
                    └── monitoring/
                          Prometheus · Loki · Alloy · Grafana
```

---

## Prerequisites

Install the following on the host:

| Tool            | Purpose                                        |
| --------------- | ---------------------------------------------- |
| Docker          | Images, Compose, Jenkins container             |
| Minikube        | Local Kubernetes cluster                       |
| kubectl         | Cluster interaction; bind-mounted into Jenkins |
| Trivy           | Image scanning; bind-mounted into Jenkins      |
| Helm            | Monitoring charts and Helm deploy path         |
| Node.js ≥ 24.11 | Local app development                          |
| Yarn            | Package management                             |

---

## Environment setup

### Application variables

Create a local `.env` in the repository root (gitignored). Example for local development:

```env
PORT=5000
NODE_ENV=development

MONGO_HOST=127.0.0.1:27017
MONGO_DB=ai-chat
MONGO_USER=admin
MONGO_PASSWORD=<your-password>

OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=smollm2:135m
```

| Variable                        | Description                                 |
| ------------------------------- | ------------------------------------------- |
| `PORT`                          | HTTP port for the Express server            |
| `NODE_ENV`                      | Runtime mode (`development` / `production`) |
| `MONGO_HOST`                    | MongoDB host:port                           |
| `MONGO_DB`                      | Database name                               |
| `MONGO_USER` / `MONGO_PASSWORD` | MongoDB credentials                         |
| `OLLAMA_URL`                    | Ollama base URL                             |
| `OLLAMA_MODEL`                  | Model pulled and used for chat              |

### Kubernetes configuration

Cluster config and secrets live in:

- Manifests: `kubernetes/variables.yaml` (ConfigMap + Secret)
- Helm: `helm/values.yaml` (`secrets` and service settings)

Replace demo credentials before any shared or non-local use.

### Docker Compose overrides

`docker-compose.yaml` wires the app to in-compose services (`database`, `ollama`). You do not need a root `.env` for Compose unless you want to override those defaults.

---

## Quick start options

### 1. Local full stack (Docker Compose)

Runs the API, MongoDB, and Ollama without Kubernetes:

```bash
docker compose up --build
```

Application: `http://127.0.0.1:5000`

### 2. Local app only (Node)

With MongoDB and Ollama already reachable (Compose services, or host installs):

```bash
yarn install
yarn dev
```

Useful scripts:

```bash
yarn lint
yarn test
yarn start
```

### 3. Local Kubernetes cluster + stack

#### Create the cluster

```bash
./scripts/cluster.sh create
```

This Minikube profile (`ai-chat`) provides:

- 3 nodes (1 control-plane + 2 workers)
- Cilium CNI
- Worker role labels and control-plane taint
- metrics-server
- Rancher local-path storage provisioner

Other cluster commands:

```bash
./scripts/cluster.sh status
./scripts/cluster.sh stop
./scripts/cluster.sh start
./scripts/cluster.sh delete
```

#### Deploy the stack

Pick one packaging path:

```bash
# Plain manifests + monitoring (recommended default)
./scripts/deploy-k8s-stack.sh

# Helm chart + monitoring
./scripts/deploy-helm-stack.sh

# Kustomize overlays (app only; deploy monitoring separately if needed)
kubectl apply -k kustomize/overlays/dev
kubectl apply -k kustomize/overlays/prod
```

| Path          | Contents                                                         |
| ------------- | ---------------------------------------------------------------- |
| `kubernetes/` | App manifests + monitoring Helm values                           |
| `helm/`       | Chart mirroring the manifests                                    |
| `kustomize/`  | Base + `dev` / `prod` overlays (`chat-app-dev`, `chat-app-prod`) |

#### Verify

```bash
kubectl get nodes -o wide
kubectl -n chat-app get pods,svc
kubectl -n monitoring get pods
```

---

## Observability

Monitoring is installed into the `monitoring` namespace by the deploy scripts.

```bash
# Application service
kubectl -n chat-app get svc ai-chat-svc

# Grafana UI
kubectl -n monitoring port-forward svc/prometheus-grafana 3000:80
```

- URL: `http://127.0.0.1:3000`
- Default login: `admin` / `prom-operator` (change before shared use)
- Dashboards: Service Overview, Database Overview, Service Logs (`grafana/`)

The app exposes `/metrics` and a readiness check against MongoDB and Ollama. Alloy ships container logs to Loki; a ServiceMonitor scrapes the application.

Optional load generation:

```bash
./scripts/generate-load.sh
```

---

## CI/CD with Jenkins

The Declarative Pipeline in `Jenkinsfile` is path-gated:

| Change set                  | Stages                                                                       |
| --------------------------- | ---------------------------------------------------------------------------- |
| `app/**`                    | Install → Lint \| Test → Build image → Trivy (HIGH/CRITICAL gate) → Push     |
| `app/**` or `kubernetes/**` | `kubectl apply -f kubernetes/` + rollout wait                                |
| Always (post)               | Discord success/failure; on failure, Gemini analyzes logs and suggests a fix |

Image: `abstergo07/ai-chat:<BUILD_NUMBER>` and `:latest`  
Namespace: `chat-app`

### 1. Start Jenkins

Ensure Docker, `kubectl`, and Trivy are installed on the host first (`jenkins-compose.yaml` bind-mounts them into the container):

| Host path                | Mounted in Jenkins as    |
| ------------------------ | ------------------------ |
| `/var/run/docker.sock`   | `/var/run/docker.sock`   |
| `/usr/bin/docker`        | `/usr/local/bin/docker`  |
| `/usr/local/bin/kubectl` | `/usr/local/bin/kubectl` |
| `/usr/local/bin/trivy`   | `/usr/local/bin/trivy`   |

```bash
./scripts/deploy-jenkins.sh
```

This starts Jenkins from `jenkins-compose.yaml` (host networking, named volume `jenkins-data`) and installs only `python3` inside the container (used by Gemini log analysis).

Open: `http://127.0.0.1:8080`

### 2. Unlock and configure Jenkins

1. Retrieve the initial admin password from the container logs or `/var/jenkins_home/secrets/initialAdminPassword`.
2. Install suggested plugins, then add:
   - Docker Pipeline
   - Kubernetes CLI
   - NodeJS
   - Pipeline
   - Pipeline Utility Steps
   - Git
   - Discord Notifier
3. **Manage Jenkins → Tools → NodeJS installations**
   - Name: `node-24-lts` (must match `Jenkinsfile`)
   - Global npm packages: `yarn`

### 3. Create Jenkins credentials

| Credential ID     | Type                           | Purpose                                     |
| ----------------- | ------------------------------ | ------------------------------------------- |
| `dockerhub-login` | Username/password              | Push images to Docker Hub                   |
| `jenkins-token`   | Secret file / kubeconfig entry | Authenticate `kubectl` to the cluster       |
| `k8s-api-server`  | Secret text                    | Kubernetes API URL (`kubectl cluster-info`) |
| `discord-webhook` | Secret text                    | Discord notifications                       |
| `gemini-api-key`  | Secret text                    | Failure log analysis                        |

### 4. Create a cluster ServiceAccount for Jenkins

```bash
kubectl create serviceaccount jenkins -n default

kubectl create clusterrolebinding jenkins-admin \
  --clusterrole=cluster-admin \
  --serviceaccount=default:jenkins

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Secret
metadata:
  name: jenkins-token
  namespace: default
  annotations:
    kubernetes.io/service-account.name: jenkins
type: kubernetes.io/service-account-token
EOF

kubectl get secret jenkins-token -n default \
  -o jsonpath='{.data.token}' | base64 -d; echo
```

Use the token (and cluster CA/API URL) when configuring the `jenkins-token` and `k8s-api-server` credentials. Prefer least-privilege bindings for non-demo environments.

### 5. Create the Pipeline job

1. New Item → Pipeline → name: `ai-chat-app`
2. Pipeline → Definition: **Pipeline script from SCM**
3. Point at this repository
4. Script path: `Jenkinsfile`
5. Save and run **Build Now**

Notes:

- An empty SCM changelog (first build, or Build Now with no new commits) runs all gated stages once so the path filters have a baseline.
- After that, stages still follow `app/**` / `kubernetes/**` changesets.
- Trivy failures fail the build; report is archived as `trivy-report.log`.
- On failure, `scripts/analyze-logs.py` uses Gemini to summarize root cause and a suggested fix in Discord.

---

## Repository layout

```text
.
├── app/                     # Express API, UI, business logic
├── tests/                   # Mocha tests
├── grafana/                 # Dashboard JSON
├── kubernetes/               # Plain manifests + monitoring values
├── helm/                    # Helm chart + monitoring values
├── kustomize/               # base + dev/prod overlays
├── scripts/
│   ├── cluster.sh           # Minikube lifecycle
│   ├── deploy-k8s-stack.sh  # Manifests + monitoring
│   ├── deploy-helm-stack.sh # Helm + monitoring
│   ├── deploy-jenkins.sh    # Local Jenkins
│   ├── security-scan.sh     # Trivy gate
│   ├── analyze-logs.py      # Gemini failure analysis
│   └── generate-load.sh     # Optional load test
├── Dockerfile
├── docker-compose.yaml
├── jenkins-compose.yaml
├── Jenkinsfile
└── server.js
```

---

## Security notes

- Demo MongoDB and Grafana credentials are for local use only — rotate them before sharing a cluster.
- Do not commit `.env`, API keys, or kubeconfig tokens.
- Trivy blocks HIGH/CRITICAL vulnerabilities before image push.
- Prefer scoped RBAC for Jenkins instead of `cluster-admin` outside personal labs.
