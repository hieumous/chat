import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getAllContacts, getMessagesByUserId, sendMessage } from "../controllers/message.controller.js";

const router = express.Router();

// Tất cả các route tin nhắn đều cần đăng nhập
router.use(protectRoute);

// Lấy danh sách user (contacts) để hiển thị bên sidebar
router.get("/users", getAllContacts);

// Lấy lịch sử tin nhắn với một user cụ thể (:id)
router.get("/:id", getMessagesByUserId);

// Gửi tin nhắn cho một user (:id)
router.post("/send/:id", sendMessage);

export default router;