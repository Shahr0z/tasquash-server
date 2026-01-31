import { Router } from "express";
import { verifyJWT } from "../middleware/user.middleware.js";
import { createSkill, deleteSkill, getSkillById, getUserSkills, updateSkill } from "../controllers/skill.controller.js";

const router = Router();
router.post("/", verifyJWT, createSkill);
router.get("/", verifyJWT, getUserSkills);
router.get("/:skillId", verifyJWT, getSkillById);
router.put("/:skillId", verifyJWT, updateSkill);
router.delete("/:skillId", verifyJWT, deleteSkill);

export default router;
