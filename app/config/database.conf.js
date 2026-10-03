import mongoose from "mongoose";
import { SERVICE_NAME } from "./app.conf.js";

const RETRY_BACKOFF_MS = [5_000, 10_000, 15_000, 30_000];

const MONGOOSE_OPTIONS = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    family: 4,
};

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function errMessage(err) {
    return err instanceof Error ? err.message : String(err);
}

function backoffForAttempt(attempt) {
    return RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)];
}

function isConnected() {
    return mongoose.connection.readyState === 1;
}

function buildMongoUri() {
    const host = process.env.MONGO_HOST;
    const db = process.env.MONGO_DB;
    const user = process.env.MONGO_USER;
    const password = process.env.MONGO_PASSWORD;

    if (!host) throw new Error("MONGO_HOST is required");
    if (!db) throw new Error("MONGO_DB is required");

    const dbName = String(db)
        .trim()
        .replace(/^\/+|\/+$/g, "");
    if (!dbName) throw new Error("MONGO_DB must be a non-empty database name");

    const credentials = user && password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@` : "";

    return `mongodb://${credentials}${host}/${encodeURIComponent(dbName)}?authSource=admin`;
}

/**
 * Start Mongo in the background. Failures and disconnects retry forever
 * (5s, 10s, 15s, then 30s) and never crash the process.
 */
export async function initDatabase(log, app) {
    const uri = buildMongoUri();
    let stopped = false;
    let connecting = false;

    async function connectLoop(reason) {
        if (stopped || connecting) return;
        connecting = true;
        let attempt = 0;

        log.info({ service: SERVICE_NAME, event: "db.reconnect.start", reason });

        try {
            while (!stopped && !isConnected()) {
                attempt += 1;
                try {
                    if (mongoose.connection.readyState !== 0) {
                        await mongoose.disconnect().catch(() => {});
                    }
                    await mongoose.connect(uri, MONGOOSE_OPTIONS);
                    log.info({ service: SERVICE_NAME, event: "db.connected", attempt, reason });
                    return;
                } catch (err) {
                    const nextRetryMs = backoffForAttempt(attempt);
                    log.error({
                        service: SERVICE_NAME,
                        event: "db.error",
                        err: errMessage(err),
                        attempt,
                        reason,
                        nextRetryMs,
                    });
                    await sleep(nextRetryMs);
                }
            }
        } finally {
            connecting = false;
        }
    }

    mongoose.connection.on("error", (err) => {
        log.error({ service: SERVICE_NAME, event: "db.error", err: errMessage(err) });
    });

    mongoose.connection.on("disconnected", () => {
        if (stopped) return;
        log.warn({ service: SERVICE_NAME, event: "db.disconnected" });
        void connectLoop("disconnected");
    });

    app.locals.mongo = {
        isReady: isConnected,

        async disconnect() {
            stopped = true;
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
            }
        },

        async ping() {
            if (!isConnected()) return false;
            const db = mongoose.connection.db;
            if (!db) return false;
            await db.command({ ping: 1 });
            return true;
        },
    };

    void connectLoop("startup");
}
