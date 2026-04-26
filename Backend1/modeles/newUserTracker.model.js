import mongoose from "mongoose";

const newUserTrackerSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: ["otp-requested", "otp-sent", "otp-verified", "signup-completed", "failed"],
    default: "otp-requested",
    index:true
  },
  otp:{type:String},
  deviceInfo: { type: String, default: "unknown" },
  ipAddress: String,
  completedAt: Date,

}, { timestamps: true });

export default mongoose.model("NewUserTracker", newUserTrackerSchema);
