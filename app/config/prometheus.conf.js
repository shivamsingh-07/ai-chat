import { collectDefaultMetrics, Histogram, Registry } from "prom-client";
import { SERVICE_NAME } from "./app.conf.js";

const register = new Registry();
register.setDefaultLabels({ app: SERVICE_NAME });

collectDefaultMetrics({ register });

const httpRequestDurationSeconds = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 3, 5, 10],
    registers: [register],
});

/**
 * Always return the matched route template (e.g. "/api/sessions/:sessionId").
 * For unmatched paths (404s, scanners, static asset misses) return "unknown"
 * to keep the `route` label cardinality bounded.
 */
function routeLabel(req) {
    if (req.route && typeof req.route.path === "string") {
        const base = req.baseUrl ?? "";
        const path = req.route.path;
        if (path === "/") return base || "/";
        return `${base}${path}`;
    }
    return "unknown";
}

/**
 * Records request duration when the response finishes. Skips /metrics scrapes.
 */
export function prometheusHttpDurationMiddleware(req, res, next) {
    if (req.path === "/metrics") return next();

    const start = process.hrtime.bigint();
    res.on("finish", () => {
        const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
        httpRequestDurationSeconds
            .labels(req.method, routeLabel(req), String(res.statusCode))
            .observe(durationSeconds);
    });
    next();
}

/** Prometheus text exposition format for GET /metrics */
export async function metricsHandler(_req, res) {
    try {
        res.setHeader("Content-Type", register.contentType);
        res.end(await register.metrics());
    } catch {
        res.status(500).type("text/plain").send("metrics unavailable");
    }
}
