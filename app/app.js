import path from "node:path";
import express from "express";
import pino from "pino";
import { createRootLoggerOptions } from "./config/app.conf.js";
import { initDatabase } from "./config/database.conf.js";
import { registerCoreMiddleware, notFoundMiddleware, errorHandlerMiddleware } from "./middleware.js";
import { mountRoutes } from "./routes.js";

const noopMongo = {
    isReady: () => false,
    ping: async () => false,
    disconnect: async () => {},
};

/**
 * Build the Express application.
 * @param {object} [opts]
 * @param {boolean} [opts.withDatabase=true] - Connect to MongoDB.
 * @param {boolean} [opts.withStatic=true]  - Serve static assets from public/.
 * @param {object}  [opts.mongo]            - Custom mongo stub for testing.
 */
export async function buildApp(opts = {}) {
    const { withDatabase = true, withStatic = true, mongo = null } = opts;
    const logger = pino(createRootLoggerOptions());
    const app = express();

    app.disable("x-powered-by");
    app.log = app.locals.rootLogger = logger;

    if (withDatabase) {
        await initDatabase(logger, app);
    } else {
        app.locals.mongo = mongo ?? noopMongo;
    }

    registerCoreMiddleware(app);
    mountRoutes(app);

    if (withStatic) {
        app.use(express.static(path.join(import.meta.dirname, "public")));
    }

    app.use(notFoundMiddleware);
    app.use(errorHandlerMiddleware);

    return app;
}
