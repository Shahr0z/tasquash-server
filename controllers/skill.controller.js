import mongoose from "mongoose";
import Skill from "../models/skill.model.js";
import TaskCategory from "../models/taskCategory.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";

const resolveCategoryId = async (category) => {
    if (category == null || category === "") return null;
    if (typeof category === "object" && category.code && category.title) {
        let doc = await TaskCategory.findOne({ code: category.code });
        if (!doc) {
            doc = await TaskCategory.create({
                code: category.code,
                title: category.title,
                description: category.description,
                pageLink: category.pageLink,
            });
        }
        return doc._id;
    }
    const id = typeof category === "object" ? category._id || category.id : category;
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid category id");
    return id;
};

const createSkill = asyncHandler(async (req, res) => {
    const { title, description, range, reward, deadLine, reach, category } = req.body;

    if (!title || !range || !reward || !deadLine) {
        throw new ApiError(400, "Required fields are missing");
    }

    const categoryId = category ? await resolveCategoryId(category) : null;

    const skill = await Skill.create({
        userId: req.user._id,
        title,
        description,
        range,
        reward,
        deadLine,
        reach,
        category: categoryId,
    });

    return res.status(201).json(
        new ApiResponse(201, skill, "Skill created successfully")
    );
});


const getUserSkills = asyncHandler(async (req, res) => {
    const skills = await Skill.find({ userId: req.user._id })
        .populate("category")
        .sort({ createdAt: -1 });

    return res.json(
        new ApiResponse(200, skills, "User skills fetched successfully")
    );
});

const getSkillById = asyncHandler(async (req, res) => {
    const { skillId } = req.params;

    const skill = await Skill.findOne({
        _id: skillId,
        userId: req.user._id,
    }).populate("category");

    if (!skill) {
        throw new ApiError(404, "Skill not found");
    }

    return res.json(
        new ApiResponse(200, skill, "Skill fetched successfully")
    );
});


const updateSkill = asyncHandler(async (req, res) => {
    const { skillId } = req.params;
    const updates = { ...req.body };
    if (updates.category !== undefined) {
        updates.category = await resolveCategoryId(updates.category);
    }

    const skill = await Skill.findOneAndUpdate(
        { _id: skillId, userId: req.user._id },
        { $set: updates },
        { new: true, runValidators: true }
    );

    if (!skill) {
        throw new ApiError(404, "Skill not found or unauthorized");
    }

    return res.json(
        new ApiResponse(200, skill, "Skill updated successfully")
    );
});



const deleteSkill = asyncHandler(async (req, res) => {
    const { skillId } = req.params;

    const skill = await Skill.findOneAndDelete({
        _id: skillId,
        userId: req.user._id,
    });

    if (!skill) {
        throw new ApiError(404, "Skill not found or unauthorized");
    }

    return res.json(
        new ApiResponse(200, {}, "Skill deleted successfully")
    );
});

export {
    createSkill,
    getUserSkills,
    getSkillById,
    updateSkill,
    deleteSkill,
};
