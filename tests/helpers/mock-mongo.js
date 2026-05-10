/** Minimal `app.locals.mongo` for tests when the real DB is not started. */
export function createNoopMongo() {
    return {
        isReady: () => false,
        async disconnect() {},
        async ping() {
            return false;
        },
    };
}

export function createHealthyMongo() {
    return {
        isReady: () => true,
        async disconnect() {},
        async ping() {
            return true;
        },
    };
}
