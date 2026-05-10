import { errorResponseSchema } from "./common.schema.js";

export const postChatSchema = {
    params: {
        type: "object",
        required: ["sessionId"],
        properties: {
            sessionId: { $ref: "uuidSessionId#" },
        },
    },
    body: {
        type: "object",
        required: ["message"],
        properties: {
            message: { type: "string", minLength: 1, maxLength: 100_000 },
        },
    },
    response: {
        200: {
            type: "object",
            required: ["reply", "latencyMs"],
            properties: {
                reply: { type: "string" },
                latencyMs: { type: "number" },
            },
        },
        400: errorResponseSchema,
        404: errorResponseSchema,
        424: errorResponseSchema,
        500: errorResponseSchema,
        502: errorResponseSchema,
        504: errorResponseSchema,
    },
};
