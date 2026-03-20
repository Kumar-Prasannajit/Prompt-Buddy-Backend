import mongoose, { Schema } from "mongoose";

const promptSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        rawPrompt: [{
            type: String,
            trim: true,
            required: true
        }],
        optimizedPrompt: [{
            type: String,
            trim: true,
            required: true
        }],
        category: {
            type: String,
            enum: ['code', 'creative', 'general'],
            default: 'general'
        }
    }, { timestamps: true }
)

export const Prompt = mongoose.model("Prompt", promptSchema);