import { Router } from "express";
import { createTaskCategory, deleteTaskCategory, getAllTaskCategories, updateTaskCategory } from "../controllers/taskCategory.controller.js";


const router = Router();
router.post("/", createTaskCategory);
router.get("/", getAllTaskCategories);
router.put("/:taskCategoryId", updateTaskCategory);
router.delete("/:taskCategoryId", deleteTaskCategory);

export default router;
