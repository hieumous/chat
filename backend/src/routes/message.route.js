import express from "express";
import {
  getAllContacts,
  getChatPartners,
  getMessagesByUserId,
  sendMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  pinMessage,
  markConversationAsRead,
} from "../controllers/message.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

// the middlewares execute in order - so requests get rate-limited first, then authenticated.
// this is actually more efficient since unauthenticated requests get blocked by rate limiting before hitting the auth middleware.
router.use(arcjetProtection, protectRoute);

router.get("/contacts", getAllContacts);
router.get("/chats", getChatPartners);
router.patch("/read/:partnerId", markConversationAsRead);
router.post("/send/:id", sendMessage);
router.delete("/:messageId", deleteMessage);
router.post("/:messageId/reactions", addReaction);
router.delete("/:messageId/reactions", removeReaction);
router.patch("/:messageId/pin", pinMessage);
router.get("/:id", getMessagesByUserId);

export default router;
