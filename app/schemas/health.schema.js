export const liveSchema = {
    response: {
        200: {
            type: "object",
            required: ["status"],
            properties: {
                status: { type: "string", enum: ["live"] },
            },
        },
    },
};

export const readySchema = {
    response: {
        200: {
            type: "object",
            required: ["status", "checks"],
            properties: {
                status: { type: "string", enum: ["ready"] },
                checks: {
                    type: "object",
                    required: ["mongo", "ollama"],
                    properties: {
                        mongo: { type: "boolean" },
                        ollama: { type: "boolean" },
                    },
                },
            },
        },
        503: {
            type: "object",
            required: ["status", "checks"],
            properties: {
                status: { type: "string", enum: ["not_ready"] },
                checks: {
                    type: "object",
                    required: ["mongo", "ollama"],
                    properties: {
                        mongo: { type: "boolean" },
                        ollama: { type: "boolean" },
                    },
                },
            },
        },
    },
};
