import User from "../modeles/user.model.js";
import { getIO } from "../config/socket.js";

// 👉 USER UPDATES OWN PROFILE
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;  
    const updates = req.body;
    
    // Prevent updating restricted fields
    delete updates.phone;
    delete updates.role;
    delete updates.isVerified;
    delete updates.firebaseUid;
    delete updates.status;             // account status — admin only
    delete updates.userCurrentStatus;  // real-time status — use PATCH /status

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (updates.username && updates.username !== user.username) {
      // check interval
      if (user.lastUsernameUpdate) {
        const daysSinceLastUpdate = (new Date() - new Date(user.lastUsernameUpdate)) / (1000 * 60 * 60 * 24);
        if (daysSinceLastUpdate < 10) {
          return res.status(403).json({ success: false, message: `You can only change your username once every 10 days. Please wait ${Math.ceil(10 - daysSinceLastUpdate)} more days.` });
        }
      }

      // Check if username unique
      const existingUser = await User.findOne({ username: updates.username });
      if (existingUser) {
        return res.status(409).json({ success: false, message: "Username is already taken" });
      }

      updates.lastUsernameUpdate = new Date();
    }

    Object.assign(user, updates);
    await user.save();

    res.status(200).json({ success: true, message: "Profile updated successfully", user });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
};

// 👉 ADMIN UPDATES ANY PROFILE
export const adminUpdateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body; // Admin can update phone, role, status, etc.

    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Admin updates username without restrictions
    if (updates.username && updates.username !== user.username) {
      const existingUser = await User.findOne({ username: updates.username });
      if (existingUser) {
        return res.status(409).json({ success: false, message: "Username is already taken" });
      }
    }

    Object.assign(user, updates);
    await user.save();

    res.status(200).json({ success: true, message: "User updated successfully by admin", user });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
};

// 👉 UPDATE USER CURRENT STATUS
export const updateUserStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { userCurrentStatus } = req.body;

    if (!["online", "offline", "incall"].includes(userCurrentStatus)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.userCurrentStatus = userCurrentStatus;
    user.lastSeen = new Date();
    await user.save();

    const io = getIO();
    if (io) {
      io.emit("user:statusChange", { userId, status: userCurrentStatus });
    }

    res.status(200).json({ success: true, message: "Status updated successfully", user });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
};
