import mongoose, { Schema } from "mongoose";

const promptModel = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        rawPrompt: {
            type: String,
            trim: true,
            required: true
        },
        enhancedPrompt: {
            type: String,
            trim: true,
            required: true
        },
        category: {
            type: String,
            enum: ['code', 'creative', 'general', 'development', 'image'],
            default: 'general'
        },
        isPublic: {
            type: Boolean,
            default: false,
        }
    }, { timestamps: true }
)

export const Prompt = mongoose.model("Prompt", promptModel);