import mongoose from "mongoose";

const skillSchema = new mongoose.Schema({
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
    range: {
        type: Number,
        required: true,
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
        enum: ["active", "inactive"],
        default: "active"
    }

}, { timestamps: true });

const Skill = mongoose.model("Skill", skillSchema);
export default Skill;
