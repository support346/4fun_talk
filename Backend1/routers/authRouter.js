import { Router } from "express";
import { sendOtpController, verifyOtpController, signupController } from "../countrollers/authCountroller.js";

const router = Router();

router.post("/send-otp", sendOtpController);
router.post("/verify-otp", verifyOtpController);
router.post("/signup", signupController);

export default router;