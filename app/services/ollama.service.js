import { getOllamaRuntimeConfig, getOllamaGenerateClient, createOllamaHealthClient } from "../config/ollama.conf.js";
import { SERVICE_NAME } from "../config/app.conf.js";

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(err) {
    return err instanceof Error ? err.message : String(err);
}

function isTimeoutError(err) {
    return err?.name === "AbortError" || err?.name === "TimeoutError" || /timed out|timeout/i.test(getErrorMessage(err));
}

function getHttpStatus(err) {
    const s = err?.status ?? err?.statusCode ?? err?.response?.status;
    return typeof s === "number" ? s : undefined;
}

export async function generateCompletion({ prompt, log, sessionId }) {
    const cfg = getOllamaRuntimeConfig();
    const client = getOllamaGenerateClient();
    const { model, maxRetries, requestTimeoutMs, initialBackoffMs, maxBackoffMs } = cfg;

    let backoffMs = initialBackoffMs;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const started = Date.now();

        log.info({ service: SERVICE_NAME, sessionId, event: "ollama.request.start", attempt, model });

        try {
            const json = await client.generate({ model, prompt, stream: false });
            const latencyMs = Date.now() - started;

            if (!json || typeof json !== "object" || typeof json.response !== "string") {
                throw new Error("Ollama response missing string \"response\" field");
            }

            log.info({ service: SERVICE_NAME, sessionId, event: "ollama.request.complete", attempt, latencyMs, model });
            return { text: json.response, latencyMs };
        } catch (err) {
            const latencyMs = Date.now() - started;
            lastError = err;

            // Normalize HTTP errors from ollama-js into proper status codes.
            const httpStatus = getHttpStatus(err);
            let normalizedError = err;
            if (httpStatus !== undefined && httpStatus >= 400) {
                normalizedError = new Error(`Ollama HTTP ${httpStatus}: ${getErrorMessage(err).slice(0, 500)}`);
                normalizedError.statusCode = httpStatus >= 500 ? 502 : 424;
            }

            const isTimeout = isTimeoutError(err);
            const message = isTimeout
                ? `Ollama request timed out after ${requestTimeoutMs}ms`
                : getErrorMessage(normalizedError);

            log.error({
                service: SERVICE_NAME,
                sessionId,
                event: "ollama.request.failed",
                attempt,
                latencyMs,
                err: message,
                isTimeout,
            });

            // Retry with exponential backoff on any failure.
            if (attempt < maxRetries) {
                await sleep(backoffMs);
                backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
                continue;
            }

            // Final attempt failed — throw with appropriate status code.
            if (isTimeout) {
                const e = new Error(message);
                e.statusCode = 504;
                throw e;
            }
            if (normalizedError.statusCode) throw normalizedError;

            const e = new Error(message);
            e.statusCode = 502;
            throw e;
        }
    }

    // Fallback (should not be reached due to throw in loop).
    const e = new Error(lastError instanceof Error ? lastError.message : "Ollama request failed");
    e.statusCode = 502;
    throw e;
}

export async function checkOllamaReachable() {
    try {
        await createOllamaHealthClient().list();
        return { ok: true };
    } catch (err) {
        const reason = isTimeoutError(err) ? "timeout" : getErrorMessage(err);
        return { ok: false, reason };
    }
}
