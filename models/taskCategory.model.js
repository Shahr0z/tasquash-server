import mongoose from "mongoose";

const taskCategorySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },

}, { timestamps: true });

const TaskCategory = mongoose.model("TaskCategory", taskCategorySchema);
export default TaskCategory;
