import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const sessionSchema = new mongoose.Schema(
    {
        sessionId: {
            type: String,
            required: true,
            unique: true,
            index: true,
            default: () => uuidv4(),
            validate: {
                validator(v) {
                    return typeof v === "string" && v.length > 0 && v.length <= 128;
                },
                message: "sessionId must be a non-empty string",
            },
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

sessionSchema.index({ updatedAt: -1 });

export const Session = mongoose.models.Session || mongoose.model("Session", sessionSchema);
