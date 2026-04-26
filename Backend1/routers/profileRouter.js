import { Router } from "express";
import { updateProfile, adminUpdateUserProfile, updateUserStatus } from "../countrollers/profileController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { adminProtect } from "../middlewares/adminMiddleware.js";

const router = Router();

// User routes
router.put("/", protect, updateProfile);
router.patch("/status", protect, updateUserStatus);

// Admin routes
router.put("/admin/:userId", protect, adminProtect, adminUpdateUserProfile);

export default router;
