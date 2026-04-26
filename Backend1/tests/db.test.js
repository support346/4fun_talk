import mongoose from "mongoose";
import User from "../modeles/user.model.js";
import NewUserTracker from "../modeles/newUserTracker.model.js";

describe("Database & Model Tests", () => {
  afterEach(async () => {
    // Already cleaned by setup.js globally, but isolated check
    await User.deleteMany({});
    await NewUserTracker.deleteMany({});
  });

  describe("User Model validations", () => {
    it("should successfully create a valid user", async () => {
      const validUser = new User({
        username: "testuserDB",
        phone: "9999999999",
        role: "user",
      });
      const savedUser = await validUser.save();
      expect(savedUser._id).toBeDefined();
      expect(savedUser.username).toBe("testuserDB");
      // Test default values
      expect(savedUser.status).toBe("active");
      expect(savedUser.userCurrentStatus).toBe("offline");
      expect(savedUser.isVerified).toBe(false);
    });

    it("should fail validation if required fields are missing", async () => {
      const userWithoutRequired = new User({
        email: "test@example.com",
      });

      let err;
      try {
        await userWithoutRequired.save();
      } catch (error) {
        err = error;
      }
      
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors.username).toBeDefined();
      expect(err.errors.phone).toBeDefined();
    });

    it("should enforce enum validation for gender and roles", async () => {
      const invalidGenderUser = new User({
        username: "baddata",
        phone: "1111111111",
        gender: "unknown", // invalid enum
        role: "superadmin" // invalid enum
      });

      let err;
      try {
        await invalidGenderUser.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors.role).toBeDefined();
      expect(err.errors.gender).toBeDefined();
    });

    it("should enforce uniqueness on username and phone", async () => {
      await User.create({ username: "uniqueAdmin", phone: "0000000000" });
      
      const duplicateUser = new User({ username: "uniqueAdmin", phone: "1111111111" });
      let err1;
      try { await duplicateUser.save(); } catch (e) { err1 = e; }
      expect(err1.code).toBe(11000); // MongoDB Duplicate Key Error
      
      const duplicatePhone = new User({ username: "otherAdmin", phone: "0000000000" });
      let err2;
      try { await duplicatePhone.save(); } catch (e) { err2 = e; }
      expect(err2.code).toBe(11000);
    });
  });

  describe("NewUserTracker validations", () => {
    it("should create tracker with defaults", async () => {
      const validTracker = new NewUserTracker({ phone: "000" });
      const savedTracker = await validTracker.save();
      expect(savedTracker.status).toBe("otp-requested");
      expect(savedTracker.deviceInfo).toBe("unknown");
    });
  });
});
