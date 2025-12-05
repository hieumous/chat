import 'dotenv/config';
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import cors from "cors";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import groupRoutes from "./routes/group.route.js";
import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";
import { app, server } from "./lib/socket.js";

const __dirname = path.resolve();

const PORT = ENV.PORT || 3000;

// Increased limit to support large file uploads (videos up to 100MB)
// Base64 encoding increases size by ~33%, so 200MB should cover 100MB files
// Note: Cloudinary has a 100MB limit for signed uploads, may need unsigned upload preset for larger files
app.use(express.json({ limit: "200mb" })); // req.body - increased for large file uploads
app.use(express.urlencoded({ extended: true, limit: "200mb" })); // for form data
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

// make ready for deployment
if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (_, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

// Increase server timeout for large file uploads (20 minutes)
server.timeout = 1200000; // 20 minutes in milliseconds

server.listen(PORT, () => {
  console.log("Server running on port: " + PORT);
  connectDB();
});
