# AI Chatbot

Kubernetes-hosted AI chat workload with multi-path GitOps-style packaging, observability stack, and a path-gated Jenkins CI/CD pipeline (build → scan → push → deploy) with Discord notifications and Gemini-assisted failure analysis.

**Stack:** Kubernetes · Helm · Kustomize · Docker · Jenkins · Trivy · Prometheus · Loki · Grafana Alloy · Discord · Gemini

---

## Highlights

- **Three deploy paths** — plain manifests, Helm chart, and Kustomize overlays (`dev` / `prod`)
- **Observability** — kube-prometheus-stack, Loki + Alloy log pipeline, Grafana dashboards (API, MongoDB, service logs)
- **CI/CD** — path-gated Jenkins: lint/test → image build → Trivy gate (HIGH/CRITICAL) → registry push → `kubectl` deploy + rollout wait
- **Ops feedback loop** — Discord success/failure; on failure, Gemini analyzes `build.log` and posts cause + suggested fix
- **Production patterns** — probes, initContainer DB wait, HPA (Ollama), ServiceMonitor, structured logging, multi-stage Docker image

---

## Architecture

```text
Git push
   │
   ▼
Jenkins (path-gated)
   ├── app/**        → yarn lint|test → docker build → Trivy → push
   └── app|k8s/**    → kubectl apply → rollout status
   │
   ▼
Docker Hub ──► Kubernetes (chat-app)
                    │
                    ├── Express API + MongoDB + Ollama
                    └── monitoring ns: Prometheus / Loki / Alloy / Grafana
```

| Layer         | What                                                        |
| :------------ | :---------------------------------------------------------- |
| Packaging     | Multi-stage `Dockerfile`, Compose for local full stack      |
| Orchestration | Minikube (`scripts/cluster.sh`), kubectl / Helm / Kustomize |
| Observability | kube-prometheus-stack, Loki, Alloy, Grafana dashboards      |
| Pipeline      | Jenkins Compose, Trivy, Discord, Gemini log analysis        |

---

## Deploy

**Prerequisites:** Minikube, `kubectl`, Helm.

```bash
./scripts/cluster.sh create
./scripts/deploy-k8s-stack.sh      # monitoring + app (plain manifests)
# or: ./scripts/deploy-helm-stack.sh
# or: kubectl apply -k kustomize/overlays/dev|prod
```

| Path          | Role                                                             |
| :------------ | :--------------------------------------------------------------- |
| `kubernetes/` | Manifests + `monitoring/` Helm values (Prometheus, Loki, Alloy)  |
| `helm/`       | Chart paralleling manifests; MongoDB exporter dependency         |
| `kustomize/`  | App overlays for `chat-app-dev` / `chat-app-prod`                |
| `grafana/`    | Dashboard JSON (Service Overview, Database, Service Logs)        |
| `scripts/`    | Cluster lifecycle, stack deploy, Trivy scan, Gemini log analysis |

**Local full stack (optional):** `docker compose up --build`

---

## Observability

```bash
kubectl -n chat-app get svc ai-chat-svc
kubectl -n monitoring port-forward svc/prometheus-grafana 3000:80
# Grafana: admin / prom-operator
# Dashboards → Service Overview · Database Overview · Service Logs
```

Workload exposes `/metrics` (Prometheus) and readiness that checks MongoDB + Ollama. Alloy ships container logs to Loki; ServiceMonitor scrapes the app.

Replace demo Grafana credentials before shared use.

---

## CI/CD (Jenkins)

Path-gated Declarative Pipeline (`Jenkinsfile`):

| Trigger                     | Stages                                                               |
| :-------------------------- | :------------------------------------------------------------------- |
| `app/**`                    | Install → Lint \| Test → Build image → Trivy (gate) → Push           |
| `app/**` or `kubernetes/**` | `kubectl apply -f kubernetes/` + rollout wait                        |
| Always                      | Discord notify; on failure → Gemini analyzes `build.log` → cause/fix |

### Setup

1. `./scripts/deploy-jenkins.sh` — Jenkins via `jenkins-compose.yaml`; installs `kubectl` + Trivy
2. Unlock `http://127.0.0.1:8080`; plugins: Docker Pipeline, Kubernetes CLI, NodeJS, Pipeline, Pipeline Utility Steps, Git, Discord Notifier
3. NodeJS tool: **`node-24-lts`** (global package `yarn`)
4. Credentials: `dockerhub-login`, `jenkins-token`, `k8s-api-server`, `discord-webhook`, `gemini-api-key`
5. Pipeline job **`ai-chat-app`** → SCM → script path `Jenkinsfile`

ServiceAccount for CD:

```bash
kubectl create serviceaccount jenkins -n default
kubectl create clusterrolebinding jenkins-admin \
  --clusterrole=cluster-admin --serviceaccount=default:jenkins
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
kubectl get secret jenkins-token -n default -o jsonpath='{.data.token}' | base64 -d; echo
```

Set `k8s-api-server` from `kubectl cluster-info`. First build may skip changeset-gated stages until a later commit establishes a changelog baseline.

---

## Layout

```text
.
├── Dockerfile / docker-compose.yaml
├── jenkins-compose.yaml / Jenkinsfile
├── kubernetes/          # manifests + monitoring values
├── kustomize/           # base + dev/prod overlays
├── helm/                # chart + dashboard/monitoring links
├── grafana/             # dashboard JSON
├── scripts/             # cluster, deploy, security-scan, analyze-logs
└── app/                 # workload (API + UI)
```
