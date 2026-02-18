import mongoose from "mongoose";

const offerSchema = new mongoose.Schema({
    taskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    deadLine: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending",
    },
    message: {
        type: String,
    }
}, { timestamps: true });

const Offer = mongoose.model("Offer", offerSchema);
export default Offer;
