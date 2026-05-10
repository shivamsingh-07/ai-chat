import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        sessionId: {
            type: String,
            required: true,
            index: true,
            maxlength: 128,
        },
        role: {
            type: String,
            required: true,
            enum: {
                values: ["user", "assistant"],
                message: "{VALUE} is not a valid role",
            },
            index: true,
        },
        content: {
            type: String,
            required: true,
            maxlength: 100_000,
            trim: true,
        },
        timestamp: {
            type: Date,
            required: true,
            default: () => new Date(),
            index: true,
        },
        latencyMs: {
            type: Number,
            default: null,
            min: 0,
            max: 3_600_000,
            validate: {
                validator(v) {
                    return v === null || v === undefined || Number.isFinite(v);
                },
            },
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

messageSchema.index({ sessionId: 1, timestamp: 1 });

export const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
