import express from "express";
import request from "supertest";
import { registerCoreMiddleware, requestIdMiddleware, errorHandlerMiddleware } from "../../app/middleware.js";
import { createSilentLogger } from "./silent-logger.js";

/**
 * Small Express stack: production-style global middleware + stub routes only.
 * No MongoDB, no Ollama — used to verify JSON body rules, trailing slashes, and request IDs.
 */
export function createHttpPipelineTestApp() {
    const app = express();
    app.locals.rootLogger = createSilentLogger();
    registerCoreMiddleware(app);

    app.get("/whoami", (req, res) => {
        res.json({ id: req.id });
    });

    app.get("/api/sessions", (_req, res) => {
        res.json({ ok: true });
    });

    app.post("/api/echo", (req, res) => {
        res.json(req.body ?? {});
    });

    app.use(errorHandlerMiddleware);
    return app;
}

export { request };

/** Supertest + only `requestIdMiddleware` (no Helmet) for a focused check. */
export function createRequestIdOnlyApp() {
    const app = express();
    app.use(requestIdMiddleware);
    app.get("/", (req, res) => res.send(req.id));
    return app;
}
