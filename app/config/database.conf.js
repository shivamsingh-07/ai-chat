import mongoose from "mongoose";
import { SERVICE_NAME } from "./app.conf.js";

const RETRY_CONFIG = {
    maxAttempts: 5,
    initialBackoffMs: 500,
    maxBackoffMs: 30_000,
};

const MONGOOSE_OPTIONS = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    family: 4,
};

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMongoUri() {
    const host = process.env.MONGO_HOST;
    const db = process.env.MONGO_DB;
    const user = process.env.MONGO_USER;
    const password = process.env.MONGO_PASSWORD;

    if (!host) throw new Error("MONGO_HOST is required");
    if (!db) throw new Error("MONGO_DB is required");

    const dbName = String(db).trim().replace(/^\/+|\/+$/g, "");
    if (!dbName) throw new Error("MONGO_DB must be a non-empty database name");

    const credentials = user && password
        ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@`
        : "";

    return `mongodb://${credentials}${host}/${encodeURIComponent(dbName)}?authSource=admin`;
}

// Retry with exponential backoff — Mongo can be briefly unavailable at deploy time.
async function connectWithRetry(log, uri) {
    let backoff = RETRY_CONFIG.initialBackoffMs;
    let lastError;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
        try {
            if (mongoose.connection.readyState === 1) return;
            await mongoose.connect(uri, MONGOOSE_OPTIONS);
            log.info({ service: SERVICE_NAME, event: "db.connected", attempt });
            return;
        } catch (err) {
            lastError = err;
            log.error({
                service: SERVICE_NAME,
                event: "db.error",
                err: err instanceof Error ? err.message : String(err),
                attempt,
                maxAttempts: RETRY_CONFIG.maxAttempts,
            });
            if (attempt === RETRY_CONFIG.maxAttempts) break;
            await sleep(backoff);
            backoff = Math.min(backoff * 2, RETRY_CONFIG.maxBackoffMs);
        }
    }

    throw lastError ?? new Error("MongoDB connection failed");
}

export async function initDatabase(log, app) {
    const uri = buildMongoUri();
    await connectWithRetry(log, uri);

    app.locals.mongo = {
        isReady: () => mongoose.connection.readyState === 1,

        async disconnect() {
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
            }
        },

        async ping() {
            if (mongoose.connection.readyState !== 1) return false;
            const db = mongoose.connection.db;
            if (!db) return false;
            await db.command({ ping: 1 });
            return true;
        },
    };
}
