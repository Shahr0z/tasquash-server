import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,

    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TaskCategory",
        required: true,
    },
    range: {
        min: {
            type: Number,
            required: true,
        },
        max: {
            type: Number,
            required: true,
        }
    },
    reward: {
        type: Number,
        required: true,
    },
    deadLine: {
        type: Date,
        required: true,
    },
    reach: {
        type: String,
        enum: ["local", "regional", "global"],
        default: "local"
    },
    status: {
        type: String,
        enum: ["open", "closed", "inProgress", "deadlineUpdated", "completed", "cancelled", "conflict"],
        default: "open"
    },
    attachments: [
        {
            type: String
        }
    ],


}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

taskSchema.virtual("offers", {
    ref: "Offer",
    localField: "_id",
    foreignField: "taskId"
});

const Task = mongoose.model("Task", taskSchema);
export default Task;
