export const SERVICE_NAME = "chat-app";

export const bodyLimit = 1024 * 128;

export const helmetOptions = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false,
};

export function createRootLoggerOptions() {
    return {
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        mixin() {
            return { service: SERVICE_NAME, sessionId: null };
        },
    };
}
