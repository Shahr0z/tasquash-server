import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import TaskCategory from "../models/taskCategory.model.js";

const createTaskCategory = asyncHandler(async (req, res) => {
    const { title, description, code, pageLink } = req.body;

    if (!title) {
        throw new ApiError(400, "Required fields are missing");
    }

    const taskCategory = await TaskCategory.create({
        title,
        description,
        code: code || undefined,
        pageLink: pageLink || undefined,
    });

    return res.status(201).json(
        new ApiResponse(201, taskCategory, "Task category created successfully")
    );
});

/** Find by code or create. Used when tagging task/skill from enlecs API result. */
const findOrCreateTaskCategory = asyncHandler(async (req, res) => {
    const { code, title, description, pageLink } = req.body;

    if (!code || !title) {
        throw new ApiError(400, "code and title are required");
    }

    let taskCategory = await TaskCategory.findOne({ code });
    if (!taskCategory) {
        taskCategory = await TaskCategory.create({
            code,
            title,
            description: description || undefined,
            pageLink: pageLink || undefined,
        });
    }

    return res.json(
        new ApiResponse(200, taskCategory, "Task category resolved")
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
    const { title, description, code, pageLink } = req.body;

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (code !== undefined) updates.code = code;
    if (pageLink !== undefined) updates.pageLink = pageLink;

    const taskCategory = await TaskCategory.findByIdAndUpdate(
        taskCategoryId,
        updates,
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
    findOrCreateTaskCategory,
    updateTaskCategory,
    deleteTaskCategory,
};