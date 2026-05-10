import { buildApp } from "../../app/app.js";
import { createNoopMongo, createHealthyMongo } from "./mock-mongo.js";

/**
 * Real routes + middleware, no Mongoose connect, no static files.
 * Pass `mongo` to stub `app.locals.mongo` (e.g. `createHealthyMongo()` for ready checks).
 */
export async function createRouteIntegrationApp(options = {}) {
    const { mongo } = options;
    return buildApp({
        withDatabase: false,
        withStatic: false,
        mongo: mongo ?? createNoopMongo(),
    });
}

export { createNoopMongo, createHealthyMongo };
