# AI Chat

AI chat application built with Express.js, MongoDB, and Ollama.

## Features

- AI chat with Ollama
- Session-based conversations
- Message persistence
- Structured logging
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
| `MONGO_DB`       | `chat-app`               | Name of the MongoDB database             |
| `MONGO_USER`     | `admin`                  | MongoDB username (optional)              |
| `MONGO_PASSWORD` | `password`               | MongoDB password (optional)              |
| `OLLAMA_URL`     | `http://127.0.0.1:11434` | Ollama API base URL                      |
| `OLLAMA_MODEL`   | `llama3.2`               | Name of the Ollama model to use          |

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
│   ├── config/               # App, MongoDB, Ollama settings from env
│   ├── controllers/          # HTTP handlers (health, session, chat)
│   ├── services/             # Chat, session, Ollama integration
│   ├── models/               # Mongoose models (session, message)
│   ├── schemas/              # Zod schemas for request/response validation
│   ├── utils/                # HTTP helpers, retries, time
│   └── public/               # Static UI (HTML, CSS, JS, assets)
│
├── kubernetes/               # Kubernetes manifests (ConfigMap, Secret, workloads, Services)
│   ├── variables.yaml        # chat-app-config + chat-app-secrets
│   ├── database.yaml         # MongoDB StatefulSet + Service
│   ├── model.yaml            # Ollama Deployment, PVC, Service
│   └── application.yaml      # API Deployment + LoadBalancer Service
│
├── scripts/
│   ├── cluster.sh            # Minikube profile lifecycle (create/start/stop/delete/status)
│   └── deploy-k8s-stack.sh   # Ordered kubectl apply + wait for DB/model pods
│
└── tests/
    ├── integration/          # HTTP tests against the app
    ├── unit/                 # Unit tests (config, validation, errors, utils)
    ├── helpers/              # Test app factory, mocks, silent logger
    └── fixtures/             # Shared test data (e.g. UUIDs)
```

## Notes

- Use `npm run dev` for the best development experience with hot-reloading.
- Ensure Ollama is running locally and the specified model is pulled before chatting.
