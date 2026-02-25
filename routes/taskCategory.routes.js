import { Router } from "express";
import { createTaskCategory, deleteTaskCategory, getAllTaskCategories, findOrCreateTaskCategory, updateTaskCategory } from "../controllers/taskCategory.controller.js";


const router = Router();
router.post("/", createTaskCategory);
router.post("/find-or-create", findOrCreateTaskCategory);
router.get("/", getAllTaskCategories);
router.put("/:taskCategoryId", updateTaskCategory);
router.delete("/:taskCategoryId", deleteTaskCategory);

export default router;
