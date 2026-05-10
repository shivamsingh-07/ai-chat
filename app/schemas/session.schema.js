import { uuidPattern, errorResponseSchema } from "./common.schema.js";

export const createSessionSchema = {
    response: {
        201: {
            type: "object",
            required: ["sessionId"],
            properties: {
                sessionId: { type: "string", pattern: uuidPattern },
            },
        },
    },
};

export const listMessagesSchema = {
    params: {
        type: "object",
        required: ["sessionId"],
        properties: {
            sessionId: { $ref: "uuidSessionId#" },
        },
    },
    response: {
        200: {
            type: "object",
            required: ["messages"],
            properties: {
                messages: {
                    type: "array",
                    items: {
                        type: "object",
                        required: ["role", "content", "timestamp"],
                        properties: {
                            role: { type: "string", enum: ["user", "assistant"] },
                            content: { type: "string" },
                            timestamp: { type: "string" },
                            latencyMs: { anyOf: [{ type: "number" }, { type: "null" }] },
                        },
                    },
                },
            },
        },
        404: errorResponseSchema,
    },
};
