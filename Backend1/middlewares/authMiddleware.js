import { verifyFirebaseToken } from "../service/firebaseService.js";
import User from "../modeles/user.model.js";

export const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
    }

    const decoded = await verifyFirebaseToken(token);

    const user = await User.findById(decoded.uid);

    if (!user) {
      return res.status(404).json({ success: false, message: "Unauthorized: User not found" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ success: false, message: `Forbidden: Your account is ${user.status}` });
    }

    req.user = user;

    next();

  } catch (err) {
    res.status(401).json({ success: false, message: "Unauthorized: Invalid or expired token" });
  }
};