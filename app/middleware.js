import { randomUUID } from "node:crypto";
import express from "express";
import helmet from "helmet";
import { z } from "zod";
import { bodyLimit, helmetOptions, SERVICE_NAME } from "./config/app.conf.js";
import { uuidPattern } from "./schemas/common.schema.js";

// ── Request pipeline middleware ───────────────────────────────────────────────────

export function requestIdMiddleware(req, res, next) {
    const header = req.get("x-request-id");
    req.id = header && String(header).trim() ? String(header).trim() : randomUUID();
    next();
}

/**
 * Normalize trailing slashes on API/health paths so clients can use either form.
 * (Fastify had ignoreTrailingSlash; Express does not, so we do it manually.)
 */
function stripTrailingSlash(req, res, next) {
    const q = req.url.indexOf("?");
    const path = q === -1 ? req.url : req.url.slice(0, q);

    if (path.length <= 1 || !path.endsWith("/")) return next();
    if (!path.startsWith("/api") && !path.startsWith("/health")) return next();

    const query = q === -1 ? "" : req.url.slice(q);
    req.url = path.slice(0, -1) + query;
    next();
}

/**
 * Reject POST/PUT/PATCH with Content-Type: application/json but Content-Length: 0.
 * Preserves the same behavior as the previous Fastify implementation.
 */
function rejectEmptyJsonBody(req, res, next) {
    if (!["POST", "PUT", "PATCH"].includes(req.method)) return next();

    const ct = req.headers["content-type"];
    if (!ct || !ct.includes("application/json")) return next();

    if (req.headers["content-length"] === "0") {
        return res.status(400).json({
            statusCode: 400,
            code: "FST_ERR_CTP_EMPTY_JSON_BODY",
            error: "Bad Request",
            message: "Body cannot be empty when content-type is set to 'application/json'",
        });
    }
    next();
}

export function registerCoreMiddleware(app) {
    app.use(helmet(helmetOptions));
    app.use(requestIdMiddleware);
    app.use(stripTrailingSlash);
    app.use(rejectEmptyJsonBody);
    app.use(express.json({ limit: bodyLimit }));
}

// ── Per-route: attach child logger to req.log ────────────────────────

export function attachRequestLog(req, res, next) {
    req.log = req.app.locals.rootLogger.child({
        service: SERVICE_NAME,
        requestId: req.id,
        sessionId: req.params?.sessionId ?? null,
    });
    next();
}

// ── Zod validation ───────────────────────────────────────────────────

const uuidRegex = new RegExp(uuidPattern);

const sessionIdSchema = z.object({
    sessionId: z.string().regex(uuidRegex),
});

const chatBodySchema = z.object({
    message: z.string().min(1).max(100_000),
});

function validate(schema, source = "params") {
    return (req, res, next) => {
        const result = schema.safeParse(req[source]);
        if (!result.success) return next(result.error);
        next();
    };
}

export const validateListMessagesParams = validate(sessionIdSchema, "params");

export function validateChatRequest(req, res, next) {
    const params = sessionIdSchema.safeParse(req.params);
    if (!params.success) return next(params.error);

    const body = chatBodySchema.safeParse(req.body);
    if (!body.success) return next(body.error);

    next();
}

// ── 404 + centralized error handler ──────────────────────────────────

export function notFoundMiddleware(req, res) {
    res.status(404).json({
        message: `Route ${req.method}:${req.originalUrl} not found`,
        error: "Not Found",
        statusCode: 404,
    });
}

function isValidationError(error) {
    return Boolean(error.validation) || error.name === "ZodError";
}

/**
 * Central error handler. Express 5 forwards rejected promises here automatically.
 * body-parser sets `error.status` on bad JSON.
 */
export function errorHandlerMiddleware(error, req, res, _next) {
    const isProduction = process.env.NODE_ENV === "production";
    const isValidation = isValidationError(error);
    const status = isValidation ? 400 : (error.statusCode ?? error.status ?? 500);

    // Determine the message to expose to the client.
    let message = "Internal Server Error";
    if (isValidation) {
        if (isProduction) {
            message = "Invalid request";
        } else if (error.name === "ZodError" && Array.isArray(error.issues)) {
            message = error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`).join("; ");
        } else {
            message = error.message || "Invalid request";
        }
    } else if (!isProduction || status < 500) {
        message = error.message || "Request error";
    }

    const log = req.log ?? req.app.locals.rootLogger;
    log.error({
        service: SERVICE_NAME,
        event: "server.error",
        requestId: req.id,
        sessionId: req.params?.sessionId ?? null,
        statusCode: status,
        err: error.message,
        validation: isValidation ? (error.validation ?? error.issues) : undefined,
        ...(isProduction ? {} : { stack: error.stack }),
    });

    if (res.headersSent) return;
    res.status(status).json({ error: message });
}
