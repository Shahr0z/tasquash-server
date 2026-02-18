import { Router } from "express";
import { verifyJWT } from "../middleware/user.middleware.js";
import { createTask, deleteTask, getAllTasks, getQuashedTasks, getTaskById, getUserTasks, updateTask } from "../controllers/task.controller.js";

import upload from "../middleware/s3.middleware.js";

const router = Router();
router.post("/", verifyJWT, upload.array("attachments"), createTask);
router.get("/all", verifyJWT, getAllTasks);
router.get("/", verifyJWT, getUserTasks);
router.get("/quashed", verifyJWT, getQuashedTasks);
router.get("/:taskId", verifyJWT, getTaskById);
router.put("/:taskId", verifyJWT, updateTask);
router.delete("/:taskId", verifyJWT, deleteTask);

export default router;
