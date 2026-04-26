import request from "supertest";
import User from "../modeles/user.model.js";
import NewUserTracker from "../modeles/newUserTracker.model.js";
import { jest } from "@jest/globals";
import redis from "../config/redis.js";

jest.unstable_mockModule("../service/smsService.js", () => ({
  sendOTP: jest.fn().mockResolvedValue({ Status: "Success" }),
}));

jest.unstable_mockModule("../service/firebaseService.js", () => ({
  createFirebaseToken: jest.fn().mockResolvedValue("mocked_token"),
  verifyFirebaseToken: jest.fn().mockResolvedValue({ uid: "mocked_uid" }),
}));

const { app } = await import("../server.js");

describe("Auth Routes", () => {
  beforeAll(async () => {
    // Clear redis
    await redis.flushall();
  });

  it("should send an OTP successfully", async () => {
    const response = await request(app)
      .post("/api/auth/send-otp")
      .send({ phone: "1234567890" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const tracker = await NewUserTracker.findOne({ phone: "1234567890" });
    expect(tracker).toBeTruthy();
    expect(tracker.status).toBe("otp-sent");
  });

  it("should fail to verify with wrong OTP", async () => {
    const response = await request(app)
      .post("/api/auth/verify-otp")
      .send({ phone: "1234567890", otp: "000000" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid OTP");
  });

  it("should verify correct OTP and ask for signup", async () => {
    // Grab the OTP from redis directly since it's mocked
    const otp = await redis.get("otp:1234567890");

    const response = await request(app)
      .post("/api/auth/verify-otp")
      .send({ phone: "1234567890", otp });

    expect(response.status).toBe(200);
    expect(response.body.actionRequired).toBe("SIGNUP");
  });

  it("should signup user successfully", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .send({
        phone: "1234567890",
        username: "testuser",
        dob: "2000-01-01",
        gender: "male",
        motherTongue: "English",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.firebaseToken).toBe("mocked_token");
    expect(response.body.user.username).toBe("testuser");
  });
});
