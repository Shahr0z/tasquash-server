import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import TaskCategory from "../models/taskCategory.model.js";

const createTaskCategory = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if (!title) {
        throw new ApiError(400, "Required fields are missing");
    }

    const taskCategory = await TaskCategory.create({
        title,
        description,
    });

    return res.status(201).json(
        new ApiResponse(201, taskCategory, "Task category created successfully")
    );
});

const getAllTaskCategories = asyncHandler(async (req, res) => {
    const taskCategories = await TaskCategory.find().sort({ createdAt: -1 });

    return res.json(
        new ApiResponse(200, taskCategories, "Task categories fetched successfully")
    );
});



const updateTaskCategory = asyncHandler(async (req, res) => {
    const { taskCategoryId } = req.params;
    const { title, description } = req.body;

    const taskCategory = await TaskCategory.findByIdAndUpdate(
        taskCategoryId,
        { title, description },
        { new: true, runValidators: true }
    );

    if (!taskCategory) {
        throw new ApiError(404, "Task category not found");
    }

    return res.json(
        new ApiResponse(200, taskCategory, "Task category updated successfully")
    );
});

const deleteTaskCategory = asyncHandler(async (req, res) => {
    const { taskCategoryId } = req.params;

    const taskCategory = await TaskCategory.findByIdAndDelete(taskCategoryId);

    if (!taskCategory) {
        throw new ApiError(404, "Task category not found");
    }

    return res.json(
        new ApiResponse(200, {}, "Task category deleted successfully")
    );
});

export {
    createTaskCategory,
    getAllTaskCategories,
    updateTaskCategory,
    deleteTaskCategory,
};