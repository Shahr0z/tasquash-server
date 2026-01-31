import Skill from "../models/skill.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";


const createSkill = asyncHandler(async (req, res) => {
    const { title, description, range, reward, deadLine, reach } = req.body;

    if (!title || !range || !reward || !deadLine) {
        throw new ApiError(400, "Required fields are missing");
    }

    const skill = await Skill.create({
        userId: req.user._id,
        title,
        description,
        range,
        reward,
        deadLine,
        reach,
    });

    return res.status(201).json(
        new ApiResponse(201, skill, "Skill created successfully")
    );
});


const getUserSkills = asyncHandler(async (req, res) => {
    const skills = await Skill.find({ userId: req.user._id }).sort({ createdAt: -1 });

    return res.json(
        new ApiResponse(200, skills, "User skills fetched successfully")
    );
});

const getSkillById = asyncHandler(async (req, res) => {
    const { skillId } = req.params;

    const skill = await Skill.findOne({
        _id: skillId,
        userId: req.user._id,
    });

    if (!skill) {
        throw new ApiError(404, "Skill not found");
    }

    return res.json(
        new ApiResponse(200, skill, "Skill fetched successfully")
    );
});


const updateSkill = asyncHandler(async (req, res) => {
    const { skillId } = req.params;

    const skill = await Skill.findOneAndUpdate(
        { _id: skillId, userId: req.user._id },
        { $set: req.body },
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
