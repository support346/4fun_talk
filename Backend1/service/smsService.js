import axios from "axios";
import env from 'dotenv'
env.config()

const API_KEY = process.env.API_KEY;

export const sendOTP = async (phone, otp) => {
  try {
    const url = `https://2factor.in/API/V1/${API_KEY}/SMS/${phone}/${otp}`;

    const response = await axios.get(url);

    if (response.data.Status !== "Success") {
      throw new Error("2Factor API failed");
    }

    return response.data;
  } catch (err) {
    console.error("SMS ERROR:", err.response?.data || err.message);
    throw new Error("Failed to send OTP");
  }
};
