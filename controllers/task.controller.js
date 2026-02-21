import mongoose from "mongoose";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Task from "../models/task.model.js";
import Offer from "../models/offer.model.js";

const TASK_POPULATE_CONFIG = [
    { path: "userId", select: "fullName email avatar" },
    { path: "category" },
    {
        path: "offers",
        populate: {
            path: "userId",
            select: "fullName email avatar",
        },
    },
];

const withTaskRelations = (query) => {
    TASK_POPULATE_CONFIG.forEach((populateConfig) => {
        query = query.populate(populateConfig);
    });
    return query;
};

const ensureObjectId = (value, label) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new ApiError(400, `Invalid ${label || "identifier"}`);
    }
};

const normalizeRange = (input, { required = false } = {}) => {
    if (input === undefined || input === null || input === "") {
        if (required) {
            throw new ApiError(400, "Range is required");
        }
        return undefined;
    }

    let min;
    let max;

    if (typeof input === "number" || (typeof input === "string" && input.trim() !== "" && !Array.isArray(input))) {
        const parsed = Number(input);
        if (Number.isNaN(parsed)) {
            throw new ApiError(400, "Range must be a numeric value");
        }
        min = 0;
        max = parsed;
    } else if (Array.isArray(input)) {
        if (input.length === 0) {
            throw new ApiError(400, "Range array cannot be empty");
        }
        min = Number(input[0]);
        max = Number(input[input.length - 1]);
    } else if (typeof input === "object") {
        min = Number(input.min ?? input[0] ?? 0);
        max = Number(input.max ?? input[1] ?? min);
    } else {
        throw new ApiError(400, "Unsupported range format");
    }

    if (Number.isNaN(min) || Number.isNaN(max)) {
        throw new ApiError(400, "Range must contain valid numbers");
    }

    if (min > max) {
        [min, max] = [max, min];
    }

    return { min, max };
};

const parseDeadline = (value, { required = false } = {}) => {
    if (!value) {
        if (required) {
            throw new ApiError(400, "Deadline is required");
        }
        return undefined;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new ApiError(400, "Invalid deadline date");
    }
    return date;
};

const parseReward = (value, { required = false } = {}) => {
    if (value === undefined || value === null || value === "") {
        if (required) {
            throw new ApiError(400, "Reward is required");
        }
        return undefined;
    }
    const reward = Number(value);
    if (Number.isNaN(reward)) {
        throw new ApiError(400, "Reward must be a numeric value");
    }
    return reward;
};

const sanitizeReach = (reach) => {
    if (!reach) return undefined;
    const allowed = ["local", "regional", "global"];
    return allowed.includes(reach) ? reach : undefined;
};

const collectAttachments = (files = []) => {
    if (!Array.isArray(files) || files.length === 0) {
        return [];
    }
    return files
        .map((file) => file?.location || file?.path)
        .filter(Boolean);
};

const createTask = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "Unauthorized request");
    }

    let { title, description, range, reward, deadLine, category, reach } = req.body;
    if (typeof range === "string") {
        try {
            range = JSON.parse(range);
        } catch (_) {
            // leave range as-is for normalizeRange to reject
        }
    }

    if (!title || !title.trim()) {
        throw new ApiError(400, "Title is required");
    }
    if (!category) {
        throw new ApiError(400, "Category is required");
    }
    ensureObjectId(category, "category id");

    const normalizedRange = normalizeRange(range, { required: true });
    const normalizedDeadline = parseDeadline(deadLine, { required: true });
    const normalizedReward = parseReward(reward, { required: true });
    const attachments = collectAttachments(req.files);

    const task = await Task.create({
        userId,
        title: title.trim(),
        description,
        range: normalizedRange,
        reward: normalizedReward,
        deadLine: normalizedDeadline,
        category,
        reach: sanitizeReach(reach) ?? "local",
        attachments,
    });

    const populatedTask = await withTaskRelations(Task.findById(task._id));

    return res.status(201).json(new ApiResponse(201, populatedTask, "Task created successfully"));
});

const getUserTasks = asyncHandler(async (req, res) => {
    const tasksQuery = withTaskRelations(Task.find({ userId: req.user._id }).sort({ createdAt: -1 }));
    const tasks = await tasksQuery;
    return res.json(new ApiResponse(200, tasks, "User tasks fetched successfully"));
});

const getAllTasks = asyncHandler(async (req, res) => {
    const tasksQuery = withTaskRelations(Task.find().sort({ createdAt: -1 }));
    const tasks = await tasksQuery;
    return res.json(new ApiResponse(200, tasks, "All tasks fetched successfully"));
});

const getTaskById = asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    ensureObjectId(taskId, "task id");

    const taskQuery = withTaskRelations(Task.findById(taskId));
    const task = await taskQuery;

    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    return res.json(new ApiResponse(200, task, "Task fetched successfully"));
});

const updateTask = asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    ensureObjectId(taskId, "task id");

    const updates = {};

    if (req.body.title !== undefined) {
        if (!req.body.title.trim()) {
            throw new ApiError(400, "Title cannot be empty");
        }
        updates.title = req.body.title.trim();
    }

    if (req.body.description !== undefined) {
        updates.description = req.body.description;
    }

    if (req.body.range !== undefined) {
        updates.range = normalizeRange(req.body.range, { required: true });
    }

    if (req.body.reward !== undefined) {
        updates.reward = parseReward(req.body.reward, { required: true });
    }

    if (req.body.deadLine !== undefined) {
        updates.deadLine = parseDeadline(req.body.deadLine, { required: true });
    }

    if (req.body.category !== undefined) {
        ensureObjectId(req.body.category, "category id");
        updates.category = req.body.category;
    }

    if (req.body.reach !== undefined) {
        const sanitizedReach = sanitizeReach(req.body.reach);
        if (!sanitizedReach) {
            throw new ApiError(400, "Invalid reach value");
        }
        updates.reach = sanitizedReach;
    }

    if (req.body.status !== undefined) {
        const allowedStatuses = ["open", "closed", "inProgress", "deadlineUpdated", "completed", "cancelled", "conflict"];
        if (!allowedStatuses.includes(req.body.status)) {
            throw new ApiError(400, "Invalid task status");
        }
        updates.status = req.body.status;
    }

    const attachments = collectAttachments(req.files);
    if (attachments.length > 0) {
        updates.attachments = attachments;
    }

    if (Object.keys(updates).length === 0) {
        throw new ApiError(400, "No valid fields provided for update");
    }

    const existingTask = await Task.findById(taskId).select("userId");
    if (!existingTask) {
        throw new ApiError(404, "Task not found");
    }

    const isOwner = existingTask.userId.toString() === req.user._id.toString();
    const acceptedOffer = await Offer.findOne({
        taskId,
        userId: req.user._id,
        status: "accepted",
    });
    const isAcceptedQuasher = !!acceptedOffer;

    if (!isOwner && !isAcceptedQuasher) {
        throw new ApiError(403, "You are not authorized to update this task");
    }

    const taskQuery = withTaskRelations(
        Task.findOneAndUpdate(
            { _id: taskId },
            updates,
            {
                new: true,
                runValidators: true,
            }
        )
    );

    const task = await taskQuery;

    return res.json(new ApiResponse(200, task, "Task updated successfully"));
});

const deleteTask = asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    ensureObjectId(taskId, "task id");

    const task = await Task.findOneAndDelete({
        _id: taskId,
        userId: req.user._id,
    });

    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    return res.json(new ApiResponse(200, { _id: taskId }, "Task deleted successfully"));
});

const getQuashedTasks = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const tasks = await Task.find({
        status: { $in: ["inProgress", "completed"] }
    })
        .populate({
            path: "offers",
            match: {
                status: "accepted",
                userId: userId
            }
        })
        .sort({ createdAt: -1 });


    const filteredTasks = tasks.filter(task => task.offers.length > 0);

    return res.json(
        new ApiResponse(200, filteredTasks, "Quashed tasks fetched successfully")
    );
});


export { createTask, getUserTasks, getTaskById, updateTask, deleteTask, getAllTasks, getQuashedTasks };