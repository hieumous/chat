import express from "express";
import {
  createGroup,
  getMyGroups,
  getGroupMessages,
  sendGroupMessage,
  getGroupMembers,
  addMembersToGroup,
  removeMemberFromGroup,
  toggleGroupPrivacy,
  deleteGroupMessage,
  addGroupReaction,
  removeGroupReaction,
  pinGroupMessage,
  markGroupAsRead,
} from "../controllers/group.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

// the middlewares execute in order - so requests get rate-limited first, then authenticated.
router.use(arcjetProtection, protectRoute);

router.post("/create", createGroup);
router.get("/my-groups", getMyGroups);
// Specific routes should come before parameterized routes
router.delete("/messages/:messageId", deleteGroupMessage);
router.post("/messages/:messageId/reactions", addGroupReaction);
router.delete("/messages/:messageId/reactions", removeGroupReaction);
router.patch("/messages/:messageId/pin", pinGroupMessage);
router.patch("/read/:groupId", markGroupAsRead);
router.patch("/:groupId/toggle-privacy", toggleGroupPrivacy);
router.get("/:groupId/members", getGroupMembers);
router.get("/:groupId/messages", getGroupMessages);
router.post("/:groupId/send", sendGroupMessage);
router.post("/:groupId/add-members", addMembersToGroup);
router.delete("/:groupId/members/:memberId", removeMemberFromGroup);

export default router;

