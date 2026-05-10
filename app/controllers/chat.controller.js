import * as ChatService from "../services/chat.service.js";
import { SERVICE_NAME } from "../config/app.conf.js";

export async function postChat(req, res) {
    const { sessionId } = req.params;
    const { message } = req.body;

    req.log.info({
        service: SERVICE_NAME,
        requestId: req.id,
        sessionId: req.params?.sessionId ?? null,
        event: "chat.request",
        userMessage: typeof message === "string" ? message.slice(0, 2000) : "",
    });

    const { assistantText, latencyMs } = await ChatService.chatTurn({
        sessionId,
        userMessage: message,
        log: req.log,
    });

    res.json({ reply: assistantText, latencyMs });
}
