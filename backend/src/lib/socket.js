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
// Áp dụng middleware xác thực cho tất cả các kết nối socket
io.use(socketAuthMiddleware);
// Dùng hàm này để lấy socketId của người nhận (check xem có online không)
export function getReceiverSocketId(userId) {
return userSocketMap[userId];
}
// Chỗ này lưu danh sách user đang online, dạng {userId: socketId}
const userSocketMap = {}; // {userId:socketId}
io.on("connection", (socket) => {
console.log("A user connected", socket.user.fullName);
const userId = socket.userId;
userSocketMap[userId] = socket.id;
// io.emit() là gửi sự kiện cho TẤT CẢ client đang kết nối
io.emit("getOnlineUsers", Object.keys(userSocketMap));
// socket.on là LẮNG NGHE sự kiện từ client (cụ thể là client này)
socket.on("disconnect", () => {
console.log("A user disconnected", socket.user.fullName);
delete userSocketMap[userId];
io.emit("getOnlineUsers", Object.keys(userSocketMap));
});
});
export { io, app, server };