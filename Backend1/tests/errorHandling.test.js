import request from "supertest";

const { app } = await import("../server.js");

describe("Error Handling & Edge Cases Tests", () => {
  
  it("should return a 404 for an invalid route", async () => {
    const response = await request(app).get("/api/xyz-unknown");
    // Standard express 404
    expect(response.status).toBe(404);
  });

  it("should capture syntax errors in the global error handler", async () => {
    // Malformed JSON should throw a SyntaxError caught by express.json()
    // passed to our specific error handler
    const response = await request(app)
      .post("/api/auth/send-otp")
      .set("Content-Type", "application/json")
      .send("{ malformed json ]");
    
    expect(response.status).toBe(400); // Express json parser sets 400
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/Unexpected token|JSON/i); 
  });
});
