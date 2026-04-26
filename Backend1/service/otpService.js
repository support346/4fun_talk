import redis from "../config/redis.js";
import User from '../modeles/user.model.js'
import NewUserTracker from '../modeles/newUserTracker.model.js'




export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const saveOTP = async (phone, otp) => {
  const count = await redis.incr(`otp_count:${phone}`);

  if (count === 1) {
    await redis.expire(`otp_count:${phone}`, 300);
  }

  if (count > 5) {
    throw new Error("Too many OTP requests");
  }

  // 🔥 Store ONLY in Redis
  await redis.set(`otp:${phone}`, otp, "EX", 300);

  // 🧠 Optional: async log (don't block API)
  NewUserTracker.updateOne(
    { phone },
    { status: "otp-sent" },
    { upsert: true }
  ).catch(() => {});
};

export const verifyOTP = async (phone, otp) => {
  const attempts = await redis.incr(`otp_attempts:${phone}`);

  if (attempts === 1) {
    await redis.expire(`otp_attempts:${phone}`, 300);
  }

  if (attempts > 5) return false;

  const storedOtp = await redis.get(`otp:${phone}`);

  return storedOtp === otp;
};

export const deleteOTP = async (phone) => {
  await Promise.all([
    redis.del(`otp:${phone}`),
    redis.del(`otp_attempts:${phone}`)
  ]);

  // 🔥 async log only
  NewUserTracker.updateOne(
    { phone },
    { $unset: { otp: "", expiresAt: "" } }
  ).catch(() => {});
};

export const markPhoneAsVerified = async (phone) => {
  await redis.set(`verified_phone:${phone}`, "true", "EX", 900);

  // async DB update
  NewUserTracker.updateOne(
    { phone },
    { status: "otp-verified" }
  ).catch(() => {});
};

export const isPhoneVerified = async (phone) => {
  const val = await redis.get(`verified_phone:${phone}`);
  return val === "true";
};

export const deleteVerifiedPhone = async (phone) => {
  await redis.del(`verified_phone:${phone}`);

  // ❌ don't delete record
  await NewUserTracker.updateOne(
    { phone },
    { status: "signup-completed" }
  );

  return true;
};