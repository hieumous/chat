import { Server } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [ENV.CLIENT_URL],
    credentials: true,
  },
});

// apply authentication middleware to all socket connections
io.use(socketAuthMiddleware);

// we will use this function to check if the user is online or not
export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// this is for storig online users
const userSocketMap = {}; // {userId:socketId}

io.on("connection", (socket) => {
  console.log("A user connected", socket.user.fullName);

  const userId = socket.userId;
  userSocketMap[userId] = socket.id;

  // io.emit() is used to send events to all connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // with socket.on we listen for events from clients
  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.user.fullName);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });

  // Call events
  socket.on("callUser", (data) => {
    const { userToCall, signalData, from, name, callType } = data;
    const receiverSocketId = userSocketMap[userToCall];

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("incomingCall", {
        signal: signalData,
        from,
        name,
        callType,
      });
      console.log(`Call initiated from ${name} to user ${userToCall}`);
    } else {
      // User is offline
      io.to(socket.id).emit("userOffline", { message: "User is offline" });
    }
  });

  socket.on("answerCall", (data) => {
    const { signal, to } = data;
    const receiverSocketId = userSocketMap[to];

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("callAccepted", signal);
      console.log(`Call answered by user ${to}`);
    }
  });

  socket.on("rejectCall", (data) => {
    const { to } = data;
    const receiverSocketId = userSocketMap[to];

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("callRejected");
      console.log(`Call rejected by user ${to}`);
    }
  });

  socket.on("endCall", (data) => {
    const { to } = data;
    const receiverSocketId = userSocketMap[to];

    console.log(`📞 End call request from ${socket.user.fullName} (${userId}) to user ${to}`);
    console.log(`   Receiver socketId: ${receiverSocketId || 'NOT FOUND'}`);
    console.log(`   Available users in map:`, Object.keys(userSocketMap));
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("callEnded");
      console.log(`✅ Call ended event sent to user ${to} (socketId: ${receiverSocketId})`);
    } else {
      console.log(`❌ User ${to} is not online or not found in userSocketMap`);
      console.log(`   Current userSocketMap:`, userSocketMap);
    }
  });

  // Typing indicators for one-on-one chat
  socket.on("typing", (data) => {
    const { to } = data;
    const receiverSocketId = userSocketMap[to];

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userTyping", {
        from: userId,
        name: socket.user.fullName,
      });
    }
  });

  socket.on("stopTyping", (data) => {
    const { to } = data;
    const receiverSocketId = userSocketMap[to];

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userStopTyping", {
        from: userId,
      });
    }
  });

  // Group typing indicators
  socket.on("groupTyping", (data) => {
    const { groupId } = data;
    // Get all members of the group and emit to them except the sender
    // Note: In a real implementation, you'd need to store group memberships
    // For now, we'll emit to all connected users and let the client filter
    socket.broadcast.emit("userTypingInGroup", {
      groupId,
      from: userId,
      name: socket.user.fullName,
    });
  });

  socket.on("stopGroupTyping", (data) => {
    const { groupId } = data;
    socket.broadcast.emit("userStopTypingInGroup", {
      groupId,
      from: userId,
    });
  });
});

export { io, app, server };
