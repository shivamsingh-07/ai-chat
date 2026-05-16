import { Router } from "express";
import * as HealthController from "./controllers/health.controller.js";
import * as SessionController from "./controllers/session.controller.js";
import * as ChatController from "./controllers/chat.controller.js";
import { metricsHandler } from "./config/prometheus.conf.js";
import { attachRequestLog, validateChatRequest, validateListMessagesParams } from "./middleware.js";

const healthRouter = Router();
healthRouter.use(attachRequestLog);
healthRouter.get("/live", HealthController.getLive);
healthRouter.get("/ready", HealthController.getReady);

// Session + chat share the same /api/sessions prefix.
const sessionRouter = Router();
sessionRouter.use(attachRequestLog);
sessionRouter.post("/", SessionController.createSession);
sessionRouter.get("/", SessionController.getRecentSessions);
sessionRouter.get("/:sessionId/messages", validateListMessagesParams, SessionController.getMessages);
sessionRouter.delete("/:sessionId", validateListMessagesParams, SessionController.deleteSession);
sessionRouter.post("/:sessionId/chat", validateChatRequest, ChatController.postChat);

export function mountRoutes(app) {
    app.get("/metrics", metricsHandler);
    app.use("/health", healthRouter);
    app.use("/api/sessions", sessionRouter);
}
