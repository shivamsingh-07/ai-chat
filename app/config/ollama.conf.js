import { Ollama } from "ollama";

export const ollamaHttp = {
    requestTimeoutMs: 30_000,
    healthProbeTimeoutMs: 5000,
    maxRetries: 2,
    initialBackoffMs: 500,
    maxBackoffMs: 8000,
};

export function getOllamaRuntimeConfig() {
    const baseUrl = (process.env.OLLAMA_URL ?? "").replace(/\/$/, "");
    const model = process.env.OLLAMA_MODEL;
    if (!baseUrl) throw new Error("OLLAMA_URL is required");
    if (!model) throw new Error("OLLAMA_MODEL is required");
    return { baseUrl, model, ...ollamaHttp };
}

function createTimeoutFetch(timeoutMs) {
    return async (url, options = {}) => {
        const signal = options.signal
            ? AbortSignal.any([AbortSignal.timeout(timeoutMs), options.signal])
            : AbortSignal.timeout(timeoutMs);
        return fetch(url, { ...options, signal });
    };
}

let generateClient;

export function getOllamaGenerateClient() {
    if (!generateClient) {
        const cfg = getOllamaRuntimeConfig();
        generateClient = new Ollama({
            host: cfg.baseUrl,
            fetch: createTimeoutFetch(cfg.requestTimeoutMs),
        });
    }
    return generateClient;
}

export function createOllamaHealthClient() {
    const cfg = getOllamaRuntimeConfig();
    return new Ollama({
        host: cfg.baseUrl,
        fetch: createTimeoutFetch(cfg.healthProbeTimeoutMs),
    });
}
