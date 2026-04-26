import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, unique: true, required: true },
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, sparse: true },

    dob: Date,
    gender: { type: String, enum: ["male", "female", "other"] },
    motherTongue: String,
    avatar: String,

    role: {
      type: String,
      enum: ["user", "host", "admin"],
      default: "user",
    },

    status: {
      type: String,
      enum: ["active", "blocked", "suspended"],
      default: "active",
      index: true,
    },

    userCurrentStatus: {
      type: String,
      enum: ["online", "offline", "incall"],
      default: "offline",
      index: true,
    },

    currentCallId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Call",
      default: null,
    },

    lastSeen: {
      type: Date,
      default: null,
      index: true,
    },

    redeemFirstoffer: { type: Boolean, default: true },

    isVerified: { type: Boolean, default: false },

    firebaseUid: { type: String, index: true },

    lastUsernameUpdate: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ status: 1, userCurrentStatus: 1 });

export default mongoose.model("User", userSchema);