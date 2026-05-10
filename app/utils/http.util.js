import { SERVICE_NAME } from "../config/app.conf.js";

/** Errors with `.statusCode` are turned into HTTP responses by `errorHandlerMiddleware`. */
export function createHttpError(statusCode, message) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

/** Common fields for controller logs (keeps log JSON shape stable across routes). */
export function baseLogFields(request, extra = {}) {
    return {
        service: SERVICE_NAME,
        requestId: request.id,
        sessionId: request.params?.sessionId ?? null,
        ...extra,
    };
}
