import { Session } from "../models/session.model.js";
import { Message } from "../models/message.model.js";
import { createHttpError } from "../utils/http.util.js";
import { SERVICE_NAME } from "../config/app.conf.js";

export async function createSession() {
    const doc = await Session.create({});
    return { sessionId: doc.sessionId };
}

export async function assertSessionExists(sessionId) {
    const session = await Session.findOne({ sessionId });
    if (!session) throw createHttpError(404, "Session not found");
    return session;
}

export async function listMessages(sessionId) {
    const session = await Session.findOne({ sessionId }).select({ sessionId: 1 }).lean();
    if (!session) throw createHttpError(404, "Session not found");

    const rows = await Message.find({ sessionId })
        .sort({ timestamp: 1, createdAt: 1 })
        .select({ role: 1, content: 1, timestamp: 1, latencyMs: 1, createdAt: 1 })
        .lean();

    return rows.map((m) => {
        const ts = m.timestamp ?? m.createdAt;
        return {
            role: m.role,
            content: m.content,
            timestamp: ts instanceof Date ? ts.toISOString() : new Date(ts).toISOString(),
            latencyMs: m.latencyMs ?? null,
        };
    });
}

export async function touchSessionUpdatedAt(sessionId, log) {
    await Session.updateOne({ sessionId }, { $set: { updatedAt: new Date() } }).catch((err) => {
        log.error({
            service: SERVICE_NAME,
            sessionId,
            event: "db.error",
            err: err instanceof Error ? err.message : String(err),
        });
    });
}

export async function listRecentSessions(limit = 20) {
    const sessions = await Session.find()
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();

    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((s) => s.sessionId);

    // Batch-fetch first user message per session for preview titles.
    const firstMessages = await Message.aggregate([
        { $match: { sessionId: { $in: sessionIds }, role: "user" } },
        { $sort: { timestamp: 1 } },
        { $group: { _id: "$sessionId", title: { $first: "$content" } } },
    ]);

    const titleMap = new Map(firstMessages.map((m) => [m._id, m.title]));

    return sessions.map((s) => ({
        sessionId: s.sessionId,
        title: (titleMap.get(s.sessionId) || "New chat").slice(0, 100),
        updatedAt: s.updatedAt?.toISOString() ?? s.createdAt?.toISOString() ?? null,
    }));
}

export async function deleteSession(sessionId) {
    const session = await Session.findOne({ sessionId });
    if (!session) throw createHttpError(404, "Session not found");

    await Promise.all([Session.deleteOne({ sessionId }), Message.deleteMany({ sessionId })]);
}
