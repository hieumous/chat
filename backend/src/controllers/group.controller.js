import Group from "../models/Group.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import ConversationRead from "../models/ConversationRead.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import cloudinary, { isCloudinaryConfigured, deleteFromCloudinary } from "../lib/cloudinary.js";
import { isValidFileType, isValidFileSize, formatFileSize, getFileInfo } from "../lib/fileUtils.js";

// Create a new group
export const createGroup = async (req, res) => {
  try {
    const { name, description, memberIds, groupPic, isPublic } = req.body;
    const adminId = req.user._id;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: "Group name is required" });
    }

    // Validate memberIds
    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ message: "memberIds must be an array" });
    }

    // Remove duplicates and admin from memberIds
    const uniqueMemberIds = [...new Set(memberIds.map(id => id.toString()))]
      .filter(id => id !== adminId.toString());

    // Verify all members exist
    if (uniqueMemberIds.length > 0) {
      const membersExist = await User.find({ 
        _id: { $in: uniqueMemberIds } 
      });
      
      if (membersExist.length !== uniqueMemberIds.length) {
        return res.status(400).json({ message: "One or more members not found" });
      }
    }

    let groupPicUrl = groupPic || "";
    if (groupPic && groupPic.startsWith("data:image/")) {
      try {
        // Check Cloudinary configuration
        if (!isCloudinaryConfigured) {
          return res.status(500).json({ 
            message: "Cloudinary is not configured. Please configure Cloudinary to upload images." 
          });
        }

        // Upload to Cloudinary only
        const uploadResponse = await cloudinary.uploader.upload(groupPic, {
          folder: "chatify/groups",
          resource_type: "image",
          transformation: [
            { width: 500, height: 500, crop: "limit", quality: "auto" }
          ]
        });
        groupPicUrl = uploadResponse.secure_url;
        console.log("📸 Group picture uploaded to Cloudinary:", uploadResponse.secure_url);
      } catch (error) {
        console.error("Cloudinary upload error:", error);
        return res.status(500).json({ 
          message: "Failed to upload image to Cloudinary. Please try again later.",
          error: error.message
        });
      }
    }

    const group = new Group({
      name: name.trim(),
      description: description?.trim() || "",
      adminId,
      members: [adminId, ...uniqueMemberIds],
      groupPic: groupPicUrl,
      isPublic: isPublic === true || isPublic === "true", // Support both boolean and string
    });

    await group.save();
    
    // Populate members and admin for response
    await group.populate("members", "fullName email profilePic");
    await group.populate("adminId", "fullName email profilePic");

    // Notify all members about the new group
    const memberSocketIds = uniqueMemberIds
      .map(id => getReceiverSocketId(id))
      .filter(Boolean);
    
    if (memberSocketIds.length > 0) {
      io.to(memberSocketIds).emit("newGroup", group);
    }

    res.status(201).json(group);
  } catch (error) {
    console.log("Error in createGroup:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all groups for the logged-in user
export const getMyGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    const groups = await Group.find({
      members: userId,
    })
      .populate("adminId", "fullName email profilePic")
      .populate("members", "fullName email profilePic")
      .sort({ updatedAt: -1 })
      .lean();

    // Get last read times for all groups
    const conversationReads = await ConversationRead.find({
      userId,
      groupId: { $in: groups.map(g => g._id) },
    });

    const readMap = new Map();
    conversationReads.forEach((cr) => {
      readMap.set(cr.groupId.toString(), cr.lastReadAt);
    });

    // Calculate unread count and last message for each group
    const groupsWithUnread = await Promise.all(
      groups.map(async (group) => {
        const lastReadAt = readMap.get(group._id.toString());
        
        // Count unread messages (messages sent by others after lastReadAt)
        const unreadCount = await Message.countDocuments({
          groupId: group._id,
          senderId: { $ne: userId }, // Exclude messages sent by current user
          createdAt: lastReadAt ? { $gt: lastReadAt } : { $exists: true },
          isDeleted: { $ne: true },
          deletedForSender: { $ne: true },
        });

        // Get last message for preview
        const lastMessage = await Message.findOne({
          groupId: group._id,
        })
          .sort({ createdAt: -1 })
          .populate("senderId", "fullName email profilePic")
          .lean();

        return {
          ...group,
          unreadCount,
          lastMessage: lastMessage
            ? {
                text: lastMessage.text,
                image: lastMessage.image,
                file: lastMessage.file,
                createdAt: lastMessage.createdAt,
                senderId: lastMessage.senderId,
              }
            : null,
        };
      })
    );

    // Sort by last message time (most recent first)
    groupsWithUnread.sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
    });

    res.status(200).json(groupsWithUnread);
  } catch (error) {
    console.log("Error in getMyGroups:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get messages for a specific group
export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    // Verify user is a member of the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!group.members.includes(userId)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const messages = await Message.find({ groupId })
      .populate("senderId", "fullName email profilePic")
      .populate({
        path: "replyTo",
        select: "text image file senderId",
        populate: {
          path: "senderId",
          select: "fullName email profilePic"
        },
        strictPopulate: false // Allow null/undefined replyTo
      })
      .sort({ createdAt: 1 })
      .lean(); // Use lean() for better performance and to handle Map conversion
    
    // Filter out messages deleted only for sender (if current user is the sender)
    const filteredMessages = messages.filter(msg => {
      // If message is deleted only for sender and current user is the sender, hide it
      if (msg.deletedForSender && msg.senderId._id.toString() === userId.toString()) {
        return false;
      }
      return true;
    });

    // Convert Map reactions to Object for each message
    const messagesWithReactions = filteredMessages.map(msg => {
      if (msg.reactions instanceof Map) {
        msg.reactions = Object.fromEntries(msg.reactions);
      } else if (msg.reactions && typeof msg.reactions === 'object') {
        // Already an object, but ensure it's a plain object
        msg.reactions = Object.fromEntries(Object.entries(msg.reactions));
      }
      return msg;
    });

    // Mark group conversation as read
    await ConversationRead.findOneAndUpdate(
      { userId, groupId },
      { 
        userId,
        groupId,
        lastReadAt: new Date() 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json(messagesWithReactions);
  } catch (error) {
    console.log("Error in getGroupMessages:", error);
    console.error("Full error:", error);
    res.status(500).json({ message: "Server error", details: error.message });
  }
};

// Send a message to a group
export const sendGroupMessage = async (req, res) => {
  try {
    const { text, image, file, fileUrl, fileName, fileType, fileSize, replyTo, call } = req.body;
    const { groupId } = req.params;
    const senderId = req.user._id;

    if (!text && !image && !file && !fileUrl && !call) {
      return res.status(400).json({ message: "Text, image, file, or call is required." });
    }

    // Verify group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!group.members.includes(senderId)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    let imageUrl;
    if (image) {
      try {
        if (!image.startsWith("data:image/")) {
          return res.status(400).json({ message: "Invalid image format. Please select a valid image file." });
        }

        // Check Cloudinary configuration
        if (!isCloudinaryConfigured) {
          return res.status(500).json({ 
            message: "Cloudinary is not configured. Please configure Cloudinary to upload images." 
          });
        }

        // Upload to Cloudinary only
        try {
          const uploadResponse = await cloudinary.uploader.upload(image, {
            folder: "chatify/messages",
            resource_type: "image",
            transformation: [
              { width: 1000, height: 1000, crop: "limit", quality: "auto" }
            ]
          });
          imageUrl = uploadResponse.secure_url;
          console.log("📸 Image uploaded to Cloudinary:", uploadResponse.secure_url);
        } catch (cloudinaryError) {
          console.error("Cloudinary upload error:", cloudinaryError);
          return res.status(500).json({ 
            message: "Failed to upload image to Cloudinary. Please try again later.",
            error: cloudinaryError.message
          });
        }
      } catch (error) {
        console.error("Image processing error:", error);
        return res.status(500).json({ 
          message: "Failed to process image. Please try again or check your image file." 
        });
      }
    }

    // Handle file upload
    let fileData = null;
    if ((file || fileUrl) && fileName && fileType && fileSize) {
      console.log("📁 Processing group file upload:", { fileName, fileType, fileSize, hasFileUrl: !!fileUrl, hasBase64: !!file });
      
      // Validate file type
      if (!isValidFileType(fileType)) {
        return res.status(400).json({ 
          message: `File type ${fileType} is not allowed. Please select a supported file type.` 
        });
      }

      // Validate file size
      if (!isValidFileSize(fileType, fileSize)) {
        const fileInfo = getFileInfo(fileType);
        return res.status(400).json({ 
          message: `File is too large. Maximum size for ${fileInfo.category} files is ${formatFileSize(fileInfo.maxSize)}.` 
        });
      }

      // If fileUrl is provided, file was already uploaded directly from frontend
      if (fileUrl) {
        console.log("📁 File already uploaded to Cloudinary from frontend:", fileUrl);
        fileData = {
          fileUrl,
          fileName,
          fileType,
          fileSize: parseInt(fileSize),
        };
        console.log("📁 File data created:", { fileName: fileData.fileName, fileType: fileData.fileType, fileSize: fileData.fileSize });
      } else if (file) {
        // Fallback: Upload base64 to Cloudinary (for backward compatibility)
        // Check Cloudinary configuration
        if (!isCloudinaryConfigured) {
          return res.status(500).json({ 
            message: "Cloudinary is not configured. Please configure Cloudinary to upload files." 
          });
        }

        // Upload to Cloudinary only
        let uploadedFileUrl;
        try {
          const resourceType = fileType.startsWith('video/') ? 'video' : 
                              fileType.startsWith('audio/') ? 'raw' : 'raw';
          
          // Calculate timeout based on file size (1MB = 10 seconds, min 60s, max 20 minutes for large videos)
          const fileSizeMB = fileSize / (1024 * 1024);
          const uploadTimeout = Math.min(1200000, Math.max(60000, fileSizeMB * 10000)); // 10s per MB, min 60s, max 20min
          
          console.log(`📤 Uploading ${fileSizeMB.toFixed(2)}MB file to Cloudinary (timeout: ${uploadTimeout/1000}s)...`);
          
          const uploadResponse = await cloudinary.uploader.upload(file, {
            folder: "chatify/files",
            resource_type: resourceType,
            public_id: fileName.replace(/\.[^/.]+$/, ""), // Remove extension
            timeout: uploadTimeout, // Set timeout for large files
            chunk_size: 6000000, // 6MB chunks for large files (helps with progress)
          });
          uploadedFileUrl = uploadResponse.secure_url;
          console.log(`📁 File uploaded to Cloudinary: ${fileName}`, uploadResponse.secure_url);
        } catch (cloudinaryError) {
          console.error("Cloudinary upload error:", cloudinaryError);
          
          // Check for network/DNS errors
          const isNetworkError = cloudinaryError.code === 'ENOTFOUND' || 
                                cloudinaryError.code === 'ECONNREFUSED' ||
                                cloudinaryError.code === 'ETIMEDOUT' ||
                                cloudinaryError.message?.includes('getaddrinfo') ||
                                cloudinaryError.message?.includes('Network Error');
          
          // Check for timeout errors
          const isTimeoutError = cloudinaryError.name === 'TimeoutError' || 
                                cloudinaryError.http_code === 499 ||
                                cloudinaryError.code === 'ECONNABORTED';
          
          if (isNetworkError) {
            return res.status(503).json({ 
              message: "Mất kết nối internet. Vui lòng kiểm tra kết nối và thử lại.",
              error: "Network error",
              code: "NETWORK_ERROR",
              retryable: true
            });
          }
          
          if (isTimeoutError) {
            return res.status(504).json({ 
              message: `File upload timeout. The file (${(fileSize / (1024 * 1024)).toFixed(2)}MB) is too large or connection is slow. Please try a smaller file or check your internet connection.`,
              error: cloudinaryError.message,
              code: "TIMEOUT_ERROR",
              retryable: true
            });
          }
          
          // Check for 413 Payload Too Large error
          if (cloudinaryError.http_code === 413) {
            return res.status(413).json({ 
              message: `File quá lớn (${(fileSize / (1024 * 1024)).toFixed(2)}MB). Cloudinary có giới hạn 100MB cho file upload. Vui lòng chọn file nhỏ hơn hoặc nén file trước khi upload.`,
              error: "File too large",
              code: "FILE_TOO_LARGE",
              retryable: false,
              maxSize: "100MB"
            });
          }
          
          return res.status(500).json({ 
            message: "Failed to upload file to Cloudinary. Please try again later.",
            error: cloudinaryError.message,
            code: "UPLOAD_ERROR",
            retryable: true
          });
        }

        fileData = {
          fileUrl: uploadedFileUrl,
          fileName,
          fileType,
          fileSize: parseInt(fileSize),
        };
        console.log("📁 File data created:", { fileName: fileData.fileName, fileType: fileData.fileType, fileSize: fileData.fileSize });
      }
    }

    const newMessage = new Message({
      senderId,
      groupId,
      text: text || "",
      image: imageUrl || "",
      file: fileData,
      replyTo: replyTo || undefined,
      call: call || undefined,
    });

    await newMessage.save();
    
    // Populate replyTo before sending
    if (newMessage.replyTo) {
      try {
        // Verify replyTo message exists before populating
        const replyToExists = await Message.exists({ _id: newMessage.replyTo });
        if (replyToExists) {
          await newMessage.populate({
            path: "replyTo",
            select: "text image file senderId",
            populate: {
              path: "senderId",
              select: "fullName email profilePic"
            },
            strictPopulate: false
          });
        } else {
          console.log("Warning: replyTo message not found, clearing replyTo");
          newMessage.replyTo = undefined;
        }
      } catch (populateError) {
        console.log("Warning: Could not populate replyTo:", populateError.message);
        // Continue without replyTo if populate fails
        newMessage.replyTo = undefined;
      }
    }
    await newMessage.populate("senderId", "fullName email profilePic");

    // Reload message to ensure all populated fields are available
    const populatedMessage = await Message.findById(newMessage._id)
      .populate("senderId", "fullName email profilePic")
      .populate({
        path: "replyTo",
        select: "text image file senderId",
        populate: {
          path: "senderId",
          select: "fullName email profilePic"
        },
        strictPopulate: false
      })
      .lean();

    // Notify all group members except the sender
    const memberSocketIds = group.members
      .filter(memberId => !memberId.equals(senderId))
      .map(memberId => getReceiverSocketId(memberId))
      .filter(Boolean);

    if (memberSocketIds.length > 0) {
      // Use lean() result directly for socket emission
      io.to(memberSocketIds).emit("newGroupMessage", populatedMessage);
    }

    // Use lean() result directly for response
    res.status(201).json(populatedMessage);
  } catch (error) {
    console.log("Error in sendGroupMessage:", error);
    res.status(500).json({ 
      error: "Internal server error",
      message: error.message || "Something went wrong while sending the message"
    });
  }
};

// Get group members
export const getGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId)
      .populate("adminId", "fullName email profilePic")
      .populate("members", "fullName email profilePic");

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Verify user is a member of the group
    if (!group.members.some(m => m._id.toString() === userId.toString())) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    res.status(200).json({
      members: group.members,
      admin: group.adminId,
      isPublic: group.isPublic,
      isAdmin: group.adminId._id.toString() === userId.toString(),
    });
  } catch (error) {
    console.log("Error in getGroupMembers:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add members to a group
export const addMembersToGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds } = req.body;
    const userId = req.user._id;

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ message: "memberIds must be a non-empty array" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Verify user is a member of the group
    const isMember = group.members.some(m => m.toString() === userId.toString());
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    // Check permissions: if private, only admin can add; if public, any member can add
    const isAdmin = group.adminId.toString() === userId.toString();
    if (!group.isPublic && !isAdmin) {
      return res.status(403).json({ message: "Only group admin can add members to private groups" });
    }

    // Remove duplicates and existing members
    const uniqueMemberIds = [...new Set(memberIds.map(id => id.toString()))]
      .filter(id => !group.members.some(m => m.toString() === id));

    if (uniqueMemberIds.length === 0) {
      return res.status(400).json({ message: "All users are already members of this group" });
    }

    // Verify all members exist
    const membersExist = await User.find({ _id: { $in: uniqueMemberIds } });
    if (membersExist.length !== uniqueMemberIds.length) {
      return res.status(400).json({ message: "One or more users not found" });
    }

    group.members.push(...uniqueMemberIds);
    await group.save();
    
    await group.populate("members", "fullName email profilePic");
    await group.populate("adminId", "fullName email profilePic");

    // Notify new members
    const newMemberSocketIds = uniqueMemberIds
      .map(id => getReceiverSocketId(id))
      .filter(Boolean);
    
    if (newMemberSocketIds.length > 0) {
      io.to(newMemberSocketIds).emit("addedToGroup", group);
    }

    // Notify existing members about new members
    const existingMemberSocketIds = group.members
      .filter(memberId => !uniqueMemberIds.includes(memberId.toString()) && !memberId.equals(userId))
      .map(memberId => getReceiverSocketId(memberId))
      .filter(Boolean);
    
    if (existingMemberSocketIds.length > 0) {
      io.to(existingMemberSocketIds).emit("groupUpdated", group);
    }

    res.status(200).json(group);
  } catch (error) {
    console.log("Error in addMembersToGroup:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Remove a member from a group
export const removeMemberFromGroup = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Only admin can remove members
    if (!group.adminId.equals(userId)) {
      return res.status(403).json({ message: "Only group admin can remove members" });
    }

    // Cannot remove admin
    if (group.adminId.toString() === memberId) {
      return res.status(400).json({ message: "Cannot remove group admin" });
    }

    // Check if member is in the group
    if (!group.members.some(m => m.toString() === memberId)) {
      return res.status(400).json({ message: "User is not a member of this group" });
    }

    group.members = group.members.filter(m => m.toString() !== memberId);
    await group.save();
    
    await group.populate("members", "fullName email profilePic");
    await group.populate("adminId", "fullName email profilePic");

    // Notify removed member
    const removedMemberSocketId = getReceiverSocketId(memberId);
    if (removedMemberSocketId) {
      io.to(removedMemberSocketId).emit("removedFromGroup", { groupId: group._id });
    }

    // Notify remaining members
    const memberSocketIds = group.members
      .map(memberId => getReceiverSocketId(memberId))
      .filter(Boolean);
    
    if (memberSocketIds.length > 0) {
      io.to(memberSocketIds).emit("groupUpdated", group);
    }

    res.status(200).json(group);
  } catch (error) {
    console.log("Error in removeMemberFromGroup:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Toggle group privacy (public/private)
// Delete/Recall group message
export const deleteGroupMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteOnlyForSender } = req.query; // Check if this is "delete only for sender"
    const userId = req.user._id;

    // Find the message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if message is a group message
    if (!message.groupId) {
      return res.status(400).json({ message: "This is not a group message" });
    }

    // Check if user is the sender
    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You can only delete your own messages" });
    }

    // If "delete only for sender", mark as deletedForSender and return early (don't notify group members)
    if (deleteOnlyForSender === 'true') {
      message.deletedForSender = true;
      await message.save();
      console.log(`🗑️ Group message ${messageId} marked as deleted for sender only`);
      
      return res.status(200).json({ 
        message: "Message deleted for you only",
        deletedForSender: true 
      });
    }

    // Check if message is already deleted
    if (message.isDeleted) {
      return res.status(400).json({ message: "Message already deleted" });
    }

    const hasImage = message.image && !message.image.startsWith('data:');
    const hasFile = message.file && message.file.fileUrl && !message.file.fileUrl.startsWith('data:');

    // If message has image or file (from Cloudinary), delete from Cloudinary and remove from database
    if (hasImage || hasFile) {
      // Delete image from Cloudinary if exists
      if (hasImage) {
        await deleteFromCloudinary(message.image);
      }

      // Delete file from Cloudinary if exists
      if (hasFile) {
        await deleteFromCloudinary(message.file.fileUrl);
      }

      // Remove message from database
      await Message.findByIdAndDelete(messageId);
      console.log(`🗑️ Group message ${messageId} deleted (had file/image)`);

      // Emit socket event to notify all group members
      const group = await Group.findById(message.groupId);
      if (group && group.members) {
        const memberSocketIds = group.members
          .map(memberId => {
            const id = memberId._id ? memberId._id.toString() : memberId.toString();
            return getReceiverSocketId(id);
          })
          .filter(Boolean);
        
        if (memberSocketIds.length > 0) {
          io.to(memberSocketIds).emit("groupMessageDeleted", { 
            messageId, 
            groupId: message.groupId,
            deleted: true 
          });
        }
      }

      return res.status(200).json({ 
        message: "Message deleted successfully",
        deleted: true 
      });
    } else {
      // If message is text only, mark as deleted but keep in database
      message.isDeleted = true;
      message.deletedAt = new Date();
      await message.save();
      console.log(`🗑️ Group message ${messageId} marked as deleted (text only)`);

      // Emit socket event to notify all group members
      const group = await Group.findById(message.groupId);
      if (group && group.members) {
        const memberSocketIds = group.members
          .map(memberId => {
            const id = memberId._id ? memberId._id.toString() : memberId.toString();
            return getReceiverSocketId(id);
          })
          .filter(Boolean);
        
        if (memberSocketIds.length > 0) {
          io.to(memberSocketIds).emit("groupMessageDeleted", { 
            messageId, 
            groupId: message.groupId,
            isDeleted: true,
            deletedAt: message.deletedAt 
          });
        }
      }

      return res.status(200).json({ 
        message: "Message recalled successfully",
        isDeleted: true,
        deletedAt: message.deletedAt
      });
    }
  } catch (error) {
    console.error("Error in deleteGroupMessage:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Add reaction to group message
export const addGroupReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji) {
      return res.status(400).json({ message: "Emoji is required" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if message is a group message
    if (!message.groupId) {
      return res.status(400).json({ message: "This is not a group message" });
    }

    // Check if user is a member of the group
    const group = await Group.findById(message.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!group.members.some(m => m.toString() === userId.toString())) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    // Add reaction
    const reactions = message.reactions || new Map();
    const userIds = reactions.get(emoji) || [];
    
    if (!userIds.includes(userId)) {
      userIds.push(userId);
      reactions.set(emoji, userIds);
      message.reactions = reactions;
      await message.save();
    }

    // Emit socket event to all group members
    const memberSocketIds = group.members
      .map(memberId => {
        const id = memberId._id ? memberId._id.toString() : memberId.toString();
        return getReceiverSocketId(id);
      })
      .filter(Boolean);
    
    if (memberSocketIds.length > 0) {
      io.to(memberSocketIds).emit("groupMessageReactionAdded", { 
        messageId, 
        groupId: message.groupId,
        emoji, 
        userId 
      });
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in addGroupReaction:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Remove reaction from group message
export const removeGroupReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji) {
      return res.status(400).json({ message: "Emoji is required" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if message is a group message
    if (!message.groupId) {
      return res.status(400).json({ message: "This is not a group message" });
    }

    // Check if user is a member of the group
    const group = await Group.findById(message.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!group.members.some(m => m.toString() === userId.toString())) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    // Remove reaction
    const reactions = message.reactions || new Map();
    const userIds = reactions.get(emoji) || [];
    const filteredUserIds = userIds.filter(id => id.toString() !== userId.toString());
    
    if (filteredUserIds.length === 0) {
      reactions.delete(emoji);
    } else {
      reactions.set(emoji, filteredUserIds);
    }
    
    message.reactions = reactions;
    await message.save();

    // Emit socket event to all group members
    const memberSocketIds = group.members
      .map(memberId => {
        const id = memberId._id ? memberId._id.toString() : memberId.toString();
        return getReceiverSocketId(id);
      })
      .filter(Boolean);
    
    if (memberSocketIds.length > 0) {
      io.to(memberSocketIds).emit("groupMessageReactionRemoved", { 
        messageId, 
        groupId: message.groupId,
        emoji, 
        userId 
      });
    }

    // Convert Map to Object for JSON response
    const messageObj = message.toObject();
    if (messageObj.reactions instanceof Map) {
      messageObj.reactions = Object.fromEntries(messageObj.reactions);
    }

    res.status(200).json(messageObj);
  } catch (error) {
    console.error("Error in removeGroupReaction:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const toggleGroupPrivacy = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    console.log("Toggle privacy request:", { groupId, userId });

    const group = await Group.findById(groupId);
    if (!group) {
      console.log("Group not found:", groupId);
      return res.status(404).json({ message: "Group not found" });
    }

    // Only admin can toggle privacy
    if (!group.adminId.equals(userId)) {
      console.log("User is not admin:", { userId, adminId: group.adminId });
      return res.status(403).json({ message: "Only group admin can change group privacy" });
    }

    // Toggle isPublic
    const oldPrivacy = group.isPublic;
    group.isPublic = !group.isPublic;
    await group.save();
    
    console.log("Privacy toggled:", { oldPrivacy, newPrivacy: group.isPublic, groupId: group._id });
    
    // Reload group to ensure we have fresh data
    const updatedGroup = await Group.findById(groupId)
      .populate("members", "fullName email profilePic")
      .populate("adminId", "fullName email profilePic");

    // Notify all members about the change
    const memberSocketIds = updatedGroup.members
      .map(member => {
        const memberId = member._id ? member._id.toString() : member.toString();
        return getReceiverSocketId(memberId);
      })
      .filter(Boolean);
    
    if (memberSocketIds.length > 0) {
      io.to(memberSocketIds).emit("groupUpdated", updatedGroup);
    }

    res.status(200).json(updatedGroup);
  } catch (error) {
    console.error("Error in toggleGroupPrivacy:", error);
    res.status(500).json({ 
      message: "Server error",
      error: error.message 
    });
  }
};

// Pin/Unpin group message
export const pinGroupMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (!message.groupId) {
      return res.status(400).json({ message: "This is not a group message" });
    }

    // Verify user is a member of the group
    const group = await Group.findById(message.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!group.members.includes(userId)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    // Toggle isPinned
    message.isPinned = !message.isPinned;
    await message.save();

    // Populate before sending
    await message.populate("senderId", "fullName email profilePic");
    if (message.replyTo) {
      await message.populate({
        path: "replyTo",
        select: "text image file senderId",
        populate: {
          path: "senderId",
          select: "fullName email profilePic"
        },
        strictPopulate: false
      });
    }

    // Get user who pinned the message
    const pinnedByUser = await User.findById(userId).select("fullName");
    
    // Notify all group members
    const memberSocketIds = group.members
      .map(memberId => getReceiverSocketId(memberId))
      .filter(Boolean);

    if (memberSocketIds.length > 0) {
      const messageToEmit = message.toObject ? message.toObject() : message;
      messageToEmit.pinnedBy = pinnedByUser?.fullName || "Ai đó";
      io.to(memberSocketIds).emit("groupMessagePinned", messageToEmit);
    }

    const messageResponse = message.toObject ? message.toObject() : message;
    res.status(200).json(messageResponse);
  } catch (error) {
    console.error("Error in pinGroupMessage:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Mark group conversation as read
export const markGroupAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId } = req.params;

    if (!groupId) {
      return res.status(400).json({ message: "Group ID is required" });
    }

    await ConversationRead.findOneAndUpdate(
      { userId, groupId },
      { 
        userId,
        groupId,
        lastReadAt: new Date() 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ message: "Group conversation marked as read" });
  } catch (error) {
    console.error("Error in markGroupAsRead:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

