import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Offer from "../models/offer.model.js";
import Task from "../models/task.model.js";

const createOffer = asyncHandler(async (req, res) => {
    const { taskId, amount, deadLine, message } = req.body;

    if (!taskId || !amount || !deadLine) {
        throw new ApiError(400, "Required fields are missing");
    }

    const task = await Task.findById(taskId);

    if (task.status === "inProgress" || task.status === "completed" || task.status === "cancelled") {
        throw new ApiError(400, "Task is not open");
    }
    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    if (task.userId.toString() === req.user._id.toString()) {
        throw new ApiError(400, "You cannot make an offer on your own task");
    }

    const existingOffer = await Offer.findOne({ taskId, userId: req.user._id });
    if (existingOffer) {
        throw new ApiError(400, "You have already made an offer on this task");
    }

    const offer = await Offer.create({
        taskId,
        userId: req.user._id,
        amount,
        deadLine,
        message,
    });


    return res.status(201).json(
        new ApiResponse(201, offer, "Offer created successfully")
    );
});

const getTaskOffers = asyncHandler(async (req, res) => {
    const { taskId } = req.params;

    const offers = await Offer.find({ taskId }).populate("userId", "fullName email avatar");

    return res.json(
        new ApiResponse(200, offers, "Task offers fetched successfully")
    );
});

const acceptOffer = asyncHandler(async (req, res) => {
    const { offerId } = req.params;

    const offer = await Offer.findById(offerId);
    if (!offer) {
        throw new ApiError(404, "Offer not found");
    }

    const task = await Task.findById(offer.taskId);
    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    if (task.userId.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to accept offers for this task");
    }

    offer.status = "accepted";
    await offer.save();

    task.status = "inProgress";
    await task.save();

    // Reject all other offers for this task so only one person is hired
    await Offer.updateMany(
        { taskId: offer.taskId, _id: { $ne: offer._id }, status: "pending" },
        { $set: { status: "rejected" } }
    );

    return res.json(
        new ApiResponse(200, offer, "Offer accepted successfully")
    );
});

const rejectOffer = asyncHandler(async (req, res) => {
    const { offerId } = req.params;

    const offer = await Offer.findById(offerId);
    if (!offer) {
        throw new ApiError(404, "Offer not found");
    }

    const task = await Task.findById(offer.taskId);
    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    if (task.userId.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to reject offers for this task");
    }

    offer.status = "rejected";
    await offer.save();


    const offerIndex = task.offers.findIndex(
        (o) => o.userId.toString() === offer.userId.toString() && Math.abs(o.amount - offer.amount) < 0.01
    );

    if (offerIndex !== -1) {
        task.offers[offerIndex].status = "rejected";
        await task.save();
    }

    return res.json(
        new ApiResponse(200, offer, "Offer rejected successfully")
    );
});

export {
    createOffer,
    getTaskOffers,
    acceptOffer,
    rejectOffer
};
