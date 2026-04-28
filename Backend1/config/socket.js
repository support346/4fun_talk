import { Server } from "socket.io";
import User from "../modeles/user.model.js";

let io;
const onlineUsers = new Map(); 

export const initSocket = (server) => {
  io = new Server(server, {});

  io.use(async (socket, next) => {
    try {
      // 🔐 pass token from client
      const { userId } = socket.handshake.auth;

      if (!userId) {
        return next(new Error("Unauthorized"));
      }

      socket.userId = userId;
      next();
    } catch (err) {
      next(new Error("Auth failed"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;

    console.log("User connected:", userId);

    // ✅ Track online
    onlineUsers.set(userId, socket.id);

    await User.updateOne(
      { _id: userId },
      {
        userCurrentStatus: "online",
        lastSeen: new Date(),
      }
    );

    // 🔔 Broadcast unified status change → online
    io.emit("user:statusChange", { userId, status: "online" });

    // ============================
    // 📞 CALL EVENTS
    // ============================

    // 👉 Call user
    socket.on("call:initiate", ({ toUserId }) => {
      const targetSocket = onlineUsers.get(toUserId);

      if (targetSocket) {
        io.to(targetSocket).emit("call:incoming", {
          fromUserId: userId,
        });
      }
    });

    // 👉 Accept call
    socket.on("call:accept", ({ toUserId }) => {
      const targetSocket = onlineUsers.get(toUserId);

      if (targetSocket) {
        io.to(targetSocket).emit("call:accepted", {
          by: userId,
        });
      }

      // 🔥 Update both users to incall & broadcast
      User.updateMany(
        { _id: { $in: [userId, toUserId] } },
        { userCurrentStatus: "incall" }
      );
      io.emit("user:statusChange", { userId, status: "incall" });
      io.emit("user:statusChange", { userId: toUserId, status: "incall" });
    });

    // 👉 End call
    socket.on("call:end", async ({ toUserId }) => {
      const targetSocket = onlineUsers.get(toUserId);

      if (targetSocket) {
        io.to(targetSocket).emit("call:ended", {
          by: userId,
        });
      }

      await User.updateMany(
        { _id: { $in: [userId, toUserId] } },
        {
          userCurrentStatus: "online",
          lastSeen: new Date(),
        }
      );
      // 🔔 Broadcast both users back to online
      io.emit("user:statusChange", { userId, status: "online" });
      io.emit("user:statusChange", { userId: toUserId, status: "online" });
    });

    // ============================
    // 🔌 DISCONNECT
    // ============================
    socket.on("disconnect", async () => {
      console.log("User disconnected:", userId);

      onlineUsers.delete(userId);

      await User.updateOne(
        { _id: userId },
        {
          userCurrentStatus: "offline",
          lastSeen: new Date(),
        }
      );

      // 🔔 Broadcast unified status change → offline
      io.emit("user:statusChange", { userId, status: "offline" });
    });
  });

  return io;
};

export const getIO = () => io;
export const getOnlineUsers = () => onlineUsers;