import admin from "firebase-admin";
import fs from "fs";

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8")
  );
} else {
  const filePath = new URL("./test4fun-d78d9-firebase-adminsdk-fbsvc-a965815181.json", import.meta.url);
  serviceAccount = JSON.parse(fs.readFileSync(filePath));
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;