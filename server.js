import "dotenv/config";
import { buildApp } from "./app/app.js";

const PORT = Number(process.env.PORT) || 5000;
const NODE_ENV = process.env.NODE_ENV || "production";

console.log(JSON.stringify({ level: "info", event: "server.starting", port: PORT, nodeEnv: NODE_ENV }));

let app;
try {
    app = await buildApp();
} catch (err) {
    console.error(JSON.stringify({ level: "error", event: "server.error", err: err.message }));
    process.exit(1);
}

const { log: logger } = app;

const server = app.listen(PORT, "0.0.0.0", () => {
    logger.info({ event: "server.ready", port: PORT, nodeEnv: NODE_ENV });
});

server.on("error", (err) => {
    logger.error({ event: "server.error", err: err.message });
    process.exit(1);
});

async function shutdown(signal) {
    logger.info({ event: "server.shutdown", signal });
    try {
        await Promise.all([new Promise((resolve) => server.close(() => resolve())), app.locals.mongo.disconnect()]);
    } catch (err) {
        logger.error({ event: "server.error", err: err.message });
    }
    process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
