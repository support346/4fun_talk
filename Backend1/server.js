import express from "express";
import env from "dotenv";
import cors from "cors";
import helmet from "helmet";
import http from "http";
import cookieParser from 'cookie-parser'
import connection from "./connections/dbConnect.js";
import authRouter from "./routers/authRouter.js";
import profileRouter from "./routers/profileRouter.js";
import { initSocket } from "./config/socket.js";
import { resetAllUsersToOffline, startStatusUpdater } from "./service/statusUpdater.js";
env.config();

const app = express();

app.use(
  cors({
    origin: process.env.NODE_ENV === "production" ? process.env.ALLOWED_ORIGINS?.split(",") : "*",
    methods: ["POST", "GET", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(helmet());

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

const server = http.createServer(app);

initSocket(server);
const startServer = async () => {
  try {
    await connection();
    console.log("Database connected");

    // Initialize the automatic status synchronization system
    await resetAllUsersToOffline();
    startStatusUpdater();

    server.listen(process.env.PORT || 3000, () => {
      console.log(` Server running at http://localhost:${process.env.PORT || 3000}`);
    });

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== "test") {
  startServer();
}

export { app, server };