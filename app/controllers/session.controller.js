import * as SessionService from "../services/session.service.js";
import { SERVICE_NAME } from "../config/app.conf.js";

export async function createSession(req, res) {
    const { sessionId } = await SessionService.createSession();

    req.log.info({
        service: SERVICE_NAME,
        requestId: req.id,
        sessionId,
        event: "session.created",
    });

    res.status(201).json({ sessionId });
}

export async function getMessages(req, res) {
    const { sessionId } = req.params;
    const messages = await SessionService.listMessages(sessionId);
    res.json({ messages });
}

export async function getRecentSessions(req, res) {
    const sessions = await SessionService.listRecentSessions(50);
    res.json({ sessions });
}

export async function deleteSession(req, res) {
    const { sessionId } = req.params;
    await SessionService.deleteSession(sessionId);

    req.log.info({
        service: SERVICE_NAME,
        requestId: req.id,
        sessionId,
        event: "session.deleted",
    });

    res.status(204).end();
}
