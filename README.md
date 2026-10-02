# AI ChatBot

An AI chat app (Express, MongoDB, Ollama) that runs on Kubernetes, with monitoring baked in and a Jenkins pipeline that builds, scans, pushes, and deploys for you.

| Area       | What we use                                           |
| ---------- | ----------------------------------------------------- |
| App        | Node.js 24, Express, MongoDB, Ollama                  |
| Packaging  | Docker, Helm, Kustomize, plain manifests              |
| Cluster    | Minikube (Cilium, metrics-server, local-path storage) |
| Monitoring | Prometheus, Loki, Grafana Alloy, Grafana              |
| CI/CD      | Jenkins, Trivy, Discord, Gemini                       |

---

## How it fits together

```text
Git push / manual build
        │
        ▼
   Jenkins
   ├── app/** changed
   │     → install → lint/test → build image → Trivy → push
   └── app/** or kubernetes/** changed
         → ensure namespace → apply manifests → wait for rollout
        │
        ▼
 Docker Hub ──► Kubernetes (chat-app)
                    ├── API + UI
                    ├── MongoDB
                    ├── Ollama (+ HPA)
                    └── monitoring/
                          Prometheus · Loki · Alloy · Grafana
```

---

## What you need on the machine

| Tool     | Why                                                 |
| -------- | --------------------------------------------------- |
| Docker   | Build images and run Jenkins                        |
| Minikube | Local Kubernetes cluster                            |
| kubectl  | Talk to the cluster (also mounted into Jenkins)     |
| Trivy    | Scan images before push (also mounted into Jenkins) |
| Helm     | Install the monitoring stack                        |

Quick sanity check:

```bash
docker version
minikube version
kubectl version --client
helm version
trivy --version
```

---

## Setup

Do these in order. Later steps assume earlier ones succeeded.

### 1. Create the cluster

```bash
./scripts/cluster.sh create
```

That spins up a Minikube profile named `ai-chat` with three nodes (one control-plane, two workers), Cilium, metrics-server, and local-path storage. Workers get a worker role label; the control-plane is tainted so workloads stay on workers.

Day-to-day:

```bash
./scripts/cluster.sh status
./scripts/cluster.sh stop
./scripts/cluster.sh start
./scripts/cluster.sh delete
```

Check that nodes are up:

```bash
kubectl get nodes -o wide
```

### 2. Install monitoring (do this before Jenkins deploys)

The app manifests include a `ServiceMonitor`. That resource only exists after kube-prometheus-stack is installed. If you skip this step, the first Jenkins deploy will fail on the CRD.

Easiest path — monitoring plus a first app deploy in one go:

```bash
./scripts/deploy-k8s-stack.sh
```

That script will:

1. Install kube-prometheus-stack in `monitoring` (this brings in the ServiceMonitor CRDs)
2. Install Loki and Grafana Alloy in `monitoring`
3. Deploy the app into `chat-app` (database, model, API, HPA, ServiceMonitor, Grafana dashboards)

If you only want monitoring for now:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  -f kubernetes/monitoring/prometheus-values.yaml \
  --wait --timeout 300s

helm upgrade --install loki grafana/loki \
  --namespace monitoring \
  -f kubernetes/monitoring/loki-values.yaml \
  --wait --timeout 300s

helm upgrade --install alloy grafana/alloy \
  --namespace monitoring \
  -f kubernetes/monitoring/alloy-values.yaml \
  --wait --timeout 300s
```

Make sure things landed:

```bash
kubectl get crd servicemonitors.monitoring.coreos.com
kubectl -n monitoring get pods
kubectl -n chat-app get pods,svc
```

Other ways to ship the app later (monitoring must already be there):

| Approach                | Command                                                 |
| ----------------------- | ------------------------------------------------------- |
| Helm (app + monitoring) | `./scripts/deploy-helm-stack.sh`                        |
| Kustomize (app only)    | `kubectl apply -k kustomize/overlays/dev` or `.../prod` |

App config and secrets live in `kubernetes/variables.yaml` (or `helm/values.yaml` if you use Helm). The defaults are fine for a lab — change them before anyone else uses the cluster.

Jenkins creates the `chat-app` namespace on deploy if it is missing. You do not need to create it by hand.

### 3. Start Jenkins

Jenkins expects Docker, kubectl, and Trivy on the host at these paths (they are bind-mounted in):

| On the host              | Inside Jenkins           |
| ------------------------ | ------------------------ |
| `/var/run/docker.sock`   | `/var/run/docker.sock`   |
| `/usr/bin/docker`        | `/usr/local/bin/docker`  |
| `/usr/local/bin/kubectl` | `/usr/local/bin/kubectl` |
| `/usr/local/bin/trivy`   | `/usr/local/bin/trivy`   |

Then:

```bash
./scripts/deploy-jenkins.sh
```

That starts Jenkins with host networking and a `jenkins-data` volume, and installs Python 3 inside the container so failure analysis can run.

Open [http://127.0.0.1:8080](http://127.0.0.1:8080).

### 4. Unlock Jenkins and add plugins

1. Grab the initial admin password from the container logs or `/var/jenkins_home/secrets/initialAdminPassword`.
2. Walk through the setup wizard.
3. Install the suggested plugins, then add these if they are not already there:
   - Docker Pipeline
   - Kubernetes CLI
   - NodeJS
   - Pipeline
   - Pipeline Utility Steps
   - Git
   - Discord Notifier
4. Under **Manage Jenkins → Tools → NodeJS**, add an installation named exactly `node-24-lts` and include `yarn` as a global npm package. The pipeline looks for that name.

### 5. Give Jenkins access to the cluster

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

API server URL:

```bash
kubectl cluster-info
```

You will paste the token and API URL into Jenkins credentials next. `cluster-admin` is fine for a personal lab; tighten RBAC if this is shared.

### 6. Add credentials in Jenkins

| ID                | Type                     | Used for                 |
| ----------------- | ------------------------ | ------------------------ |
| `dockerhub-login` | Username/password        | Pushing images           |
| `jenkins-token`   | Secret file / kubeconfig | Talking to the cluster   |
| `k8s-api-server`  | Secret text              | Kubernetes API URL       |
| `discord-webhook` | Secret text              | Build notifications      |
| `gemini-api-key`  | Secret text              | Explaining failed builds |

### 7. Create the pipeline job

1. **New Item** → Pipeline → name it `ai-chat-app`.
2. Under Pipeline, choose **Pipeline script from SCM**.
3. Point it at this repo.
4. Set the script path to `Jenkinsfile`.
5. Save.

### 8. Run a build

- **Build Now** — runs every gated stage. Handy for the first run or a full rebuild.
- **Automatic builds** (SCM / webhook / timer) — only run the stages that match what changed.

| What changed                | What runs                                                         |
| --------------------------- | ----------------------------------------------------------------- |
| `app/**`                    | Install, lint/test, build, Trivy, push                            |
| `app/**` or `kubernetes/**` | Ensure `chat-app` exists, apply manifests, wait for rollout       |
| Every build (post)          | Discord ping; on failure, Gemini reads the log and suggests a fix |

Images land as `abstergo07/ai-chat:<BUILD_NUMBER>` and `:latest`.

If Trivy finds HIGH or CRITICAL issues, the build stops and `trivy-report.log` is archived on the job.

---

## Checking the running system

App service:

```bash
kubectl -n chat-app get svc ai-chat-svc
```

Grafana:

```bash
kubectl -n monitoring port-forward svc/prometheus-grafana 3000:80
```

Then open [http://127.0.0.1:3000](http://127.0.0.1:3000) — default login is `admin` / `prom-operator`. Change that before sharing the cluster.

Dashboards (Service Overview, Database Overview, Service Logs) come from `grafana/`.

The API exposes `/metrics`, Alloy ships logs to Loki, and the ServiceMonitor tells Prometheus what to scrape.

To generate a bit of traffic:

```bash
./scripts/generate-load.sh
```

---

## What’s in the repo

```text
.
├── app/                     # API and UI
├── tests/
├── grafana/                 # Dashboard JSON
├── kubernetes/               # Manifests + monitoring values
├── helm/                    # Chart + monitoring values
├── kustomize/               # base + dev/prod overlays
├── scripts/
│   ├── cluster.sh           # Minikube create/start/stop/delete
│   ├── deploy-k8s-stack.sh  # Monitoring + manifests
│   ├── deploy-helm-stack.sh # Monitoring + Helm chart
│   ├── deploy-jenkins.sh    # Start Jenkins
│   ├── security-scan.sh     # Trivy gate
│   ├── analyze-logs.py      # Gemini on failure
│   └── generate-load.sh
├── Dockerfile
├── jenkins-compose.yaml
├── Jenkinsfile
└── server.js
```

---

## A few security notes

- MongoDB and Grafana defaults are for local labs. Rotate them if anyone else can reach the cluster.
- Keep secrets, API keys, and kubeconfig tokens out of git.
- Trivy blocks HIGH/CRITICAL findings before an image is pushed.
- Prefer a tighter role for Jenkins than `cluster-admin` outside a personal setup.
