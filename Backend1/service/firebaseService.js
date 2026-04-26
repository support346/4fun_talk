import admin from "../config/firebase.js";

export const createFirebaseToken = async (user) => {
  return await admin.auth().createCustomToken(user._id.toString(), {
    role: user.role,
  });
};

export const verifyFirebaseToken = async (token) => {
  return await admin.auth().verifyIdToken(token);
};