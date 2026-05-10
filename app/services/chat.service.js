import { Message } from "../models/message.model.js";
import { createHttpError } from "../utils/http.util.js";
import { SERVICE_NAME } from "../config/app.conf.js";
import * as SessionService from "./session.service.js";
import * as OllamaService from "./ollama.service.js";

function buildPromptFromHistory(history) {
    return history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
}

export async function chatTurn({ sessionId, userMessage, log }) {
    await SessionService.assertSessionExists(sessionId);

    const trimmed = typeof userMessage === "string" ? userMessage.trim() : "";
    if (!trimmed) throw createHttpError(400, "Message must be a non-empty string");

    // Save user message
    const userDoc = await Message.create({
        sessionId,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
        latencyMs: null,
    });

    log.info({
        service: SERVICE_NAME,
        sessionId,
        event: "db.message.saved",
        role: "user",
        messageId: String(userDoc._id),
    });

    await SessionService.touchSessionUpdatedAt(sessionId, log);

    // Build prompt from full conversation history
    const history = await Message.find({ sessionId })
        .sort({ timestamp: 1, createdAt: 1 })
        .select({ role: 1, content: 1 })
        .lean();

    const prompt = buildPromptFromHistory(history);

    // Get AI response
    const { text: reply, latencyMs } = await OllamaService.generateCompletion({ prompt, log, sessionId });

    // Save assistant message
    const assistantDoc = await Message.create({
        sessionId,
        role: "assistant",
        content: reply,
        timestamp: new Date(),
        latencyMs,
    });

    log.info({
        service: SERVICE_NAME,
        sessionId,
        event: "db.message.saved",
        role: "assistant",
        messageId: String(assistantDoc._id),
        latencyMs,
    });

    await SessionService.touchSessionUpdatedAt(sessionId, log);

    return { assistantText: reply, latencyMs };
}
