import User from "../modeles/user.model.js";
import NewUserTracker from "../modeles/newUserTracker.model.js";
import { generateOTP, saveOTP, verifyOTP, deleteOTP, markPhoneAsVerified, isPhoneVerified, deleteVerifiedPhone } from "../service/otpService.js";
import { sendOTP } from "../service/smsService.js";
import { createFirebaseToken } from "../service/firebaseService.js";
import redis from "../config/redis.js";

// 👉 SEND OTP
export const sendOtpController = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone is required",
      });
    }

    const otp = generateOTP();

    await saveOTP(phone, otp); 
    await sendOTP(phone, otp);

    await NewUserTracker.create({
      phone,
      status: "otp-sent",
      deviceInfo: req.headers["user-agent"],
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};

export const verifyOtpController = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone and OTP are required",
      });
    }

    // ✅ STEP 1: Fast OTP check (Redis)
    const isValid = await verifyOTP(phone, otp);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // 🔥 Fire & forget (non-blocking)
    deleteOTP(phone).catch(() => {});

    // ✅ STEP 2: Fetch minimal user (FASTER)
    const user = await User.findOne({ phone })
      .select("_id phone status userCurrentStatus")
      .lean();

    // 👉 New user
    if (!user) {
      markPhoneAsVerified(phone).catch(() => {});
      NewUserTracker.updateOne(
        { phone },
        { status: "otp-verified" },
        { sort: { createdAt: -1 } }
      ).catch(() => {});

      return res.status(200).json({
        success: true,
        message: "User not found. Proceed to signup.",
        actionRequired: "SIGNUP",
      });
    }

    // 🚫 Block check
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: `User is ${user.status}`,
      });
    }

    // ✅ STEP 3: Update user status (non-blocking)
    User.updateOne(
      { _id: user._id },
      { userCurrentStatus: "online", lastSeen: new Date() }
    ).catch(() => {});

    // 🚀 STEP 4: TRY REDIS CACHE FIRST (VERY FAST)
    let firebaseToken = await redis.get(`firebase:${user._id}`);

    if (!firebaseToken) {
      // ⚠️ Generate token only if not cached
      firebaseToken = await createFirebaseToken(user);

      // ✅ Cache token (1 hour)
      await redis.set(
        `firebase:${user._id}`,
        firebaseToken,
        "EX",
        3600
      );
    }

    // 🍪 Set cookie
    res.cookie("token", firebaseToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // ✅ FINAL RESPONSE (FAST NOW)
    return res.status(200).json({
      success: true,
      message: "Authentication successful",
      user,
      firebaseToken,
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};
// 👉 SIGNUP
export const signupController = async (req, res) => {
  try {
    const {
      phone,
      username,
      dob,
      gender,
      motherTongue,
      avatar,
    } = req.body;

    if (!phone || !username || !dob || !gender || !motherTongue) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    const isVerified = await isPhoneVerified(phone);

    if (!isVerified) {
      return res.status(403).json({
        success: false,
        message: "Phone not verified via OTP",
      });
    }

    let user;

    try {
      // 🔥 No pre-check → avoids race condition
      user = await User.create({
        phone,
        username,
        dob,
        gender,
        motherTongue,
        avatar,
        isVerified: true,
        userCurrentStatus: "online",
        lastSeen: new Date(),
      });

    } catch (err) {
      // 🔥 Duplicate handling (phone/username)
      if (err.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "User already exists",
        });
      }
      throw err;
    }

    await deleteVerifiedPhone(phone);

    await NewUserTracker.findOneAndUpdate(
      { phone },
      {
        status: "signup-completed",
        completedAt: new Date(),
      },
      { sort: { createdAt: -1 } }
    );

    const firebaseToken = await createFirebaseToken(user);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user,
      firebaseToken,
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};