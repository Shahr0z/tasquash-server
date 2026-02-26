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
    /** Optional: 'Recruiter' | 'Quasher' (task creator role). Can also be derived from userId.role. */
    userRole: {
        type: String,
        enum: ["Recruiter", "Quasher"],
        default: "Recruiter"
    },
    /** Optional: distance (e.g. km). */
    distance: {
        type: Number,
        default: null
    },
    /** Optional: competence domain label (can align with category). */
    competenceDomain: {
        type: String,
        default: null
    },
    /** Optional: recruiter comment on the task. */
    recruiterComment: {
        type: String,
        default: null
    },
    /** Optional: recruiter rating at task creation (float). */
    recruiterRating: {
        type: Number,
        default: null
    },

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

/** Closed flag derived from status (for API compatibility). */
taskSchema.virtual("closed").get(function () {
    return this.status === "closed";
});

taskSchema.virtual("offers", {
    ref: "Offer",
    localField: "_id",
    foreignField: "taskId"
});

const Task = mongoose.model("Task", taskSchema);
export default Task;
