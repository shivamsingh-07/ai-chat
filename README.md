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
/app
  /controllers  # Request handlers
  /services     # Business logic
  /routes       # API route definitions
  /models       # Mongoose schemas
  /public       # Frontend assets
server.js       # Entry point
```

## Notes

- Use `npm run dev` for the best development experience with hot-reloading.
- Ensure Ollama is running locally and the specified model is pulled before chatting.
