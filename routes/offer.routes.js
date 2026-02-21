import { Router } from "express";
import { verifyJWT } from "../middleware/user.middleware.js";
import { createOffer, getTaskOffers, acceptOffer, rejectOffer, withdrawOffer } from "../controllers/offer.controller.js";

const router = Router();

router.post("/", verifyJWT, createOffer);
router.get("/task/:taskId", verifyJWT, getTaskOffers);
router.put("/:offerId/accept", verifyJWT, acceptOffer);
router.put("/:offerId/reject", verifyJWT, rejectOffer);
router.put("/:offerId/withdraw", verifyJWT, withdrawOffer);

export default router;
