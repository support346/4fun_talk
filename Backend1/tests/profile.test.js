import request from "supertest";
import mongoose from "mongoose";
import User from "../modeles/user.model.js";
import redis from "../config/redis.js";
import { jest } from "@jest/globals";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock Socket.io so profileController's io.emit() doesn't throw in tests
jest.unstable_mockModule("../config/socket.js", () => ({
  initSocket: jest.fn(),
  getIO: jest.fn(() => ({
    emit: jest.fn(),
  })),
  getOnlineUsers: jest.fn(() => new Map()),
}));

// Mock auth middleware — injects the logged-in user per test via a shared ref
const mockUser = { current: null };

jest.unstable_mockModule("../middlewares/authMiddleware.js", () => ({
  protect: async (req, res, next) => {
    if (mockUser.current) {
      req.user = mockUser.current;
      return next();
    }
    res.status(401).json({ success: false, message: "Unauthorized" });
  },
}));

// Import app AFTER mocks are registered
const { app } = await import("../server.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createUser = (overrides = {}) =>
  User.create({
    phone: `99${Math.random().toString().slice(2, 10)}`,
    username: `user_${Math.random().toString(36).slice(2, 8)}`,
    status: "active",
    isVerified: false,
    userCurrentStatus: "offline",
    role: "user",
    ...overrides,
  });

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("Profile API — Integration Tests", () => {
  beforeEach(async () => {
    await redis.flushall();
    await User.deleteMany({});
    mockUser.current = null;
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PUT /api/profile  — User updates own profile
  // ══════════════════════════════════════════════════════════════════════════

  describe("PUT /api/profile — updateProfile", () => {
    it("should update allowed fields successfully", async () => {
      const user = await createUser();
      mockUser.current = user;

      const res = await request(app)
        .put("/api/profile")
        .set("Authorization", "Bearer MOCK")
        .send({ avatar: "https://example.com/avatar.png", motherTongue: "Tamil" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.avatar).toBe("https://example.com/avatar.png");
      expect(res.body.user.motherTongue).toBe("Tamil");
    });

    it("should silently drop restricted fields (phone, role, isVerified, status)", async () => {
      const user = await createUser({ role: "user", status: "active", isVerified: false });
      mockUser.current = user;

      const res = await request(app)
        .put("/api/profile")
        .set("Authorization", "Bearer MOCK")
        .send({
          phone: "0000000000",
          role: "admin",
          isVerified: true,
          status: "blocked",
          avatar: "allowed",
        });

      expect(res.status).toBe(200);
      expect(res.body.user.phone).toBe(user.phone);
      expect(res.body.user.role).toBe("user");
      expect(res.body.user.isVerified).toBe(false);
      expect(res.body.user.status).toBe("active");
      expect(res.body.user.avatar).toBe("allowed"); // this should still update
    });

    it("should silently drop userCurrentStatus field (status only via /status endpoint)", async () => {
      const user = await createUser({ userCurrentStatus: "offline" });
      mockUser.current = user;

      const res = await request(app)
        .put("/api/profile")
        .set("Authorization", "Bearer MOCK")
        .send({ userCurrentStatus: "online", avatar: "x" });

      expect(res.status).toBe(200);
      // userCurrentStatus should remain offline — it's deleted in controller
      expect(res.body.user.userCurrentStatus).toBe("offline");
    });

    it("should allow username change if 10-day cooldown has passed", async () => {
      const oldDate = new Date(Date.now() - 11 * 24 * 60 * 60 * 1000); // 11 days ago
      const user = await createUser({ username: "oldname", lastUsernameUpdate: oldDate });
      mockUser.current = user;

      const res = await request(app)
        .put("/api/profile")
        .set("Authorization", "Bearer MOCK")
        .send({ username: "newname" });

      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe("newname");
    });

    it("should block username change within the 10-day cooldown period", async () => {
      const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      const user = await createUser({ username: "recentname", lastUsernameUpdate: recentDate });
      mockUser.current = user;

      const res = await request(app)
        .put("/api/profile")
        .set("Authorization", "Bearer MOCK")
        .send({ username: "trychange" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/10 days/i);
    });

    it("should reject a username that is already taken by another user", async () => {
      await createUser({ username: "takenname", phone: "1111111111" });

      const user = await createUser({ username: "myname", phone: "2222222222" });
      mockUser.current = user;

      const res = await request(app)
        .put("/api/profile")
        .set("Authorization", "Bearer MOCK")
        .send({ username: "takenname" });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already taken/i);
    });

    it("should return 401 when no auth token provided", async () => {
      const res = await request(app)
        .put("/api/profile")
        .send({ avatar: "x" });

      expect(res.status).toBe(401);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PATCH /api/profile/status  — Real-time status update
  // ══════════════════════════════════════════════════════════════════════════

  describe("PATCH /api/profile/status — updateUserStatus", () => {
    it("should update status to online", async () => {
      const user = await createUser({ userCurrentStatus: "offline" });
      mockUser.current = user;

      const res = await request(app)
        .patch("/api/profile/status")
        .set("Authorization", "Bearer MOCK")
        .send({ userCurrentStatus: "online" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.userCurrentStatus).toBe("online");
    });

    it("should update status to offline", async () => {
      const user = await createUser({ userCurrentStatus: "online" });
      mockUser.current = user;

      const res = await request(app)
        .patch("/api/profile/status")
        .set("Authorization", "Bearer MOCK")
        .send({ userCurrentStatus: "offline" });

      expect(res.status).toBe(200);
      expect(res.body.user.userCurrentStatus).toBe("offline");
    });

    it("should update status to incall", async () => {
      const user = await createUser({ userCurrentStatus: "online" });
      mockUser.current = user;

      const res = await request(app)
        .patch("/api/profile/status")
        .set("Authorization", "Bearer MOCK")
        .send({ userCurrentStatus: "incall" });

      expect(res.status).toBe(200);
      expect(res.body.user.userCurrentStatus).toBe("incall");
    });

    it("should reject an invalid status value", async () => {
      const user = await createUser();
      mockUser.current = user;

      const res = await request(app)
        .patch("/api/profile/status")
        .set("Authorization", "Bearer MOCK")
        .send({ userCurrentStatus: "hacking" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid status value");
    });

    it("should reject an empty status value", async () => {
      const user = await createUser();
      mockUser.current = user;

      const res = await request(app)
        .patch("/api/profile/status")
        .set("Authorization", "Bearer MOCK")
        .send({ userCurrentStatus: "" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid status value");
    });

    it("should update lastSeen timestamp on status change", async () => {
      const user = await createUser({ userCurrentStatus: "offline", lastSeen: null });
      mockUser.current = user;

      const res = await request(app)
        .patch("/api/profile/status")
        .set("Authorization", "Bearer MOCK")
        .send({ userCurrentStatus: "online" });

      expect(res.status).toBe(200);
      expect(res.body.user.lastSeen).not.toBeNull();
    });

    it("should persist the status change in the database", async () => {
      const user = await createUser({ userCurrentStatus: "offline" });
      mockUser.current = user;

      await request(app)
        .patch("/api/profile/status")
        .set("Authorization", "Bearer MOCK")
        .send({ userCurrentStatus: "incall" });

      const refreshed = await User.findById(user._id);
      expect(refreshed.userCurrentStatus).toBe("incall");
    });

    it("should return 401 when unauthenticated", async () => {
      const res = await request(app)
        .patch("/api/profile/status")
        .send({ userCurrentStatus: "online" });

      expect(res.status).toBe(401);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PUT /api/profile/admin/:userId  — Admin updates any user profile
  // ══════════════════════════════════════════════════════════════════════════

  describe("PUT /api/profile/admin/:userId — adminUpdateUserProfile", () => {
    it("should allow admin to update any user's profile including restricted fields", async () => {
      const targetUser = await createUser({ phone: "3333333333", username: "targetuser" });
      const admin = await createUser({ phone: "4444444444", username: "adminuser", role: "admin" });
      mockUser.current = admin;

      const res = await request(app)
        .put(`/api/profile/admin/${targetUser._id}`)
        .set("Authorization", "Bearer MOCK")
        .send({
          status: "blocked",
          role: "host",
          avatar: "admin-set-avatar",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.status).toBe("blocked");
      expect(res.body.user.role).toBe("host");
      expect(res.body.user.avatar).toBe("admin-set-avatar");
    });

    it("should return 404 when admin tries to update a non-existent user", async () => {
      const admin = await createUser({ phone: "5555555555", username: "admin2", role: "admin" });
      mockUser.current = admin;
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .put(`/api/profile/admin/${fakeId}`)
        .set("Authorization", "Bearer MOCK")
        .send({ status: "blocked" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it("should reject a regular (non-admin) user from accessing admin route", async () => {
      const targetUser = await createUser({ phone: "6666666666", username: "victim" });
      const regularUser = await createUser({ phone: "7777777777", username: "attacker", role: "user" });
      mockUser.current = regularUser;

      const res = await request(app)
        .put(`/api/profile/admin/${targetUser._id}`)
        .set("Authorization", "Bearer MOCK")
        .send({ status: "blocked" });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not authorized as an admin/i);
    });

    it("should reject duplicate username even for admin updates", async () => {
      const existingUser = await createUser({ phone: "8888888888", username: "existing" });
      const targetUser = await createUser({ phone: "9999999999", username: "original" });
      const admin = await createUser({ phone: "1010101010", username: "superadmin", role: "admin" });
      mockUser.current = admin;

      const res = await request(app)
        .put(`/api/profile/admin/${targetUser._id}`)
        .set("Authorization", "Bearer MOCK")
        .send({ username: "existing" });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already taken/i);
    });

    it("should allow admin to suspend a user", async () => {
      const targetUser = await createUser({ phone: "2020202020", username: "suspendme" });
      const admin = await createUser({ phone: "3030303030", username: "adminsusp", role: "admin" });
      mockUser.current = admin;

      const res = await request(app)
        .put(`/api/profile/admin/${targetUser._id}`)
        .set("Authorization", "Bearer MOCK")
        .send({ status: "suspended" });

      expect(res.status).toBe(200);
      expect(res.body.user.status).toBe("suspended");
    });

    it("should return 401 when unauthenticated request hits admin route", async () => {
      const targetUser = await createUser({ phone: "4040404040", username: "randuser" });

      const res = await request(app)
        .put(`/api/profile/admin/${targetUser._id}`)
        .send({ status: "blocked" });

      expect(res.status).toBe(401);
    });
  });
});
