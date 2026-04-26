import { generateOTP, saveOTP, verifyOTP, deleteOTP, markPhoneAsVerified, isPhoneVerified } from "../service/otpService.js";
import redis from "../config/redis.js";
import { jest } from "@jest/globals";
import NewUserTracker from "../modeles/newUserTracker.model.js";

// Mock the model so unit tests don't need real DB connection for background trackers
jest.mock("../modeles/newUserTracker.model.js", () => ({
  updateOne: jest.fn().mockResolvedValue({}),
}));

describe("Unit Tests: OTP Service", () => {
  beforeEach(async () => {
    await redis.flushall();
  });

  describe("generateOTP()", () => {
    it("should generate a 6 digit numerical OTP string", () => {
      const otp = generateOTP();
      expect(typeof otp).toBe("string");
      expect(otp.length).toBe(6);
      expect(Number(otp)).toBeGreaterThanOrEqual(100000);
    });
  });

  describe("saveOTP and verifyOTP", () => {
    it("should save an OTP into redis and verify correctly", async () => {
      const phone = "unitTestPhone";
      const otp = "123456";

      await saveOTP(phone, otp);

      const isCorrect = await verifyOTP(phone, "123456");
      expect(isCorrect).toBe(true);
      
      const isIncorrect = await verifyOTP(phone, "654321");
      expect(isIncorrect).toBe(false);
    });

    it("should enforce rate limiting for saving OTP (Too many OTP requests)", async () => {
      const phone = "spamPhone";
      
      // Request 5 normally
      for(let i = 0; i < 5; i++) {
        await saveOTP(phone, "000000");
      }
      
      // 6th should reject
      await expect(saveOTP(phone, "000000")).rejects.toThrow("Too many OTP requests");
    });
    
    it("should enforce brute force protection for verifying OTP (> 5 attempts)", async () => {
      const phone = "bruteForcePhone";
      await saveOTP(phone, "111111");

      for(let i = 0; i < 5; i++) {
        const attempt = await verifyOTP(phone, "wrong!");
        expect(attempt).toBe(false);
      }

      // 6th attempt should just return false and stop trying DB/Cache lookup
      const blockedAttempt = await verifyOTP(phone, "111111"); // Even the correct one
      expect(blockedAttempt).toBe(false);
    });
  });

  describe("deleteOTP", () => {
    it("should delete OTP from redis", async () => {
      await saveOTP("phoneDelete", "123");
      await deleteOTP("phoneDelete");
      
      const res = await redis.get("otp:phoneDelete");
      expect(res).toBeNull();
    });
  });

  describe("Verified Flags in Redis", () => {
    it("should mark phone as verified and check successfully", async () => {
      await markPhoneAsVerified("validPhone");
      const isVerified = await isPhoneVerified("validPhone");
      expect(isVerified).toBe(true);

      const notVerified = await isPhoneVerified("unknownPhone");
      expect(notVerified).toBe(false);
    });
  });
});
