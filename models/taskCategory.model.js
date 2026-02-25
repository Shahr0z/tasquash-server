import mongoose from "mongoose";

const taskCategorySchema = new mongoose.Schema({
    code: {
        type: String,
        unique: true,
        sparse: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    pageLink: {
        type: String,
    },
}, { timestamps: true });

const TaskCategory = mongoose.model("TaskCategory", taskCategorySchema);
export default TaskCategory;
