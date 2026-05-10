import * as OllamaService from "../services/ollama.service.js";
import { SERVICE_NAME } from "../config/app.conf.js";

export function getLive(req, res) {
    res.json({ status: "live" });
}

export async function getReady(req, res) {
    const log = req.log;
    const mongo = req.app.locals.mongo;

    let mongoOk = false;
    try {
        mongoOk = Boolean(await mongo.ping());
    } catch (err) {
        log.error({
            service: SERVICE_NAME,
            event: "health.ready.fail",
            requestId: req.id,
            sessionId: null,
            component: "mongo",
            err: err instanceof Error ? err.message : String(err),
        });
    }

    const ollamaResult = await OllamaService.checkOllamaReachable();
    if (!ollamaResult.ok) {
        log.error({
            service: SERVICE_NAME,
            event: "health.ready.fail",
            requestId: req.id,
            sessionId: null,
            component: "ollama",
            reason: ollamaResult.reason,
        });
    }

    const ready = mongoOk && ollamaResult.ok;
    const checks = { mongo: mongoOk, ollama: ollamaResult.ok };

    if (!ready) return res.status(503).json({ status: "not_ready", checks });
    res.json({ status: "ready", checks });
}
