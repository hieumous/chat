import cloudinary, { isCloudinaryConfigured, deleteFromCloudinary } from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import ConversationRead from "../models/ConversationRead.js";
import { isValidFileType, isValidFileSize, formatFileSize, getFileInfo } from "../lib/fileUtils.js";

export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.log("Error in getAllContacts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMessagesByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userToChatId } = req.params;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    })
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
      .lean(); // Use lean() for better performance and to handle Map conversion
    
    // Filter out messages deleted only for sender (if current user is the sender)
    const filteredMessages = messages.filter(msg => {
      // If message is deleted only for sender and current user is the sender, hide it
      if (msg.deletedForSender && msg.senderId._id.toString() === myId.toString()) {
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

    // Mark conversation as read
    await ConversationRead.findOneAndUpdate(
      { userId: myId, partnerId: userToChatId },
      { 
        userId: myId,
        partnerId: userToChatId,
        lastReadAt: new Date() 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json(messagesWithReactions);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    console.error("Full error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, file, fileUrl, fileName, fileType, fileSize, replyTo } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!text && !image && !file && !fileUrl) {
      return res.status(400).json({ message: "Text, image, or file is required." });
    }
    if (senderId.equals(receiverId)) {
      return res.status(400).json({ message: "Cannot send messages to yourself." });
    }
    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found." });
    }

    let imageUrl;
    if (image) {
      try {
        // Validate base64 image format
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
      console.log("📁 Processing file upload:", { fileName, fileType, fileSize, hasFileUrl: !!fileUrl, hasBase64: !!file });
      
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
      receiverId,
      text: text || "",
      image: imageUrl || "",
      file: fileData,
      replyTo: replyTo || undefined,
    });

    await newMessage.save();
    
    // Populate replyTo and senderId before sending
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
    
    // Populate senderId
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
    
    console.log("💾 Message saved:", { 
      hasText: !!populatedMessage.text, 
      hasImage: !!populatedMessage.image, 
      hasFile: !!populatedMessage.file,
      file: populatedMessage.file 
    });

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      // Use lean() result directly for socket emission
      io.to(receiverSocketId).emit("newMessage", populatedMessage);
    }

    // Use lean() result directly for response
    res.status(201).json(populatedMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    console.error("Full error:", error);
    res.status(500).json({ 
      error: "Internal server error",
      message: error.message || "Something went wrong while sending the message"
    });
  }
};

// Add reaction to message
export const addReaction = async (req, res) => {
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

    // Check if user has access to this message
    const isSender = message.senderId.toString() === userId.toString();
    const isReceiver = message.receiverId && message.receiverId.toString() === userId.toString();
    
    if (!isSender && !isReceiver) {
      return res.status(403).json({ message: "You don't have access to this message" });
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

    // Emit socket event
    const receiverSocketId = getReceiverSocketId(message.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageReactionAdded", { messageId, emoji, userId });
    }

    // Convert Map to Object for JSON response
    const messageObj = message.toObject();
    if (messageObj.reactions instanceof Map) {
      messageObj.reactions = Object.fromEntries(messageObj.reactions);
    }

    res.status(200).json(messageObj);
  } catch (error) {
    console.error("Error in addReaction:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Remove reaction from message
export const removeReaction = async (req, res) => {
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

    // Check if user has access to this message
    const isSender = message.senderId.toString() === userId.toString();
    const isReceiver = message.receiverId && message.receiverId.toString() === userId.toString();
    
    if (!isSender && !isReceiver) {
      return res.status(403).json({ message: "You don't have access to this message" });
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

    // Emit socket event
    const receiverSocketId = getReceiverSocketId(message.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageReactionRemoved", { messageId, emoji, userId });
    }

    // Convert Map to Object for JSON response
    const messageObj = message.toObject();
    if (messageObj.reactions instanceof Map) {
      messageObj.reactions = Object.fromEntries(messageObj.reactions);
    }

    res.status(200).json(messageObj);
  } catch (error) {
    console.error("Error in removeReaction:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    // find all the messages where the logged-in user is either sender or receiver
    // Exclude group messages (only one-on-one chats)
    const messages = await Message.find({
      $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
      groupId: { $exists: false }, // Only one-on-one messages
    });

    const chatPartnerIds = [
      ...new Set(
        messages
          .filter((msg) => msg.receiverId) // Ensure receiverId exists
          .map((msg) =>
            msg.senderId.toString() === loggedInUserId.toString()
              ? msg.receiverId.toString()
              : msg.senderId.toString()
          )
      ),
    ];

    const chatPartners = await User.find({ _id: { $in: chatPartnerIds } }).select("-password");

    // Get last read times for all conversations
    const conversationReads = await ConversationRead.find({
      userId: loggedInUserId,
      partnerId: { $in: chatPartnerIds },
    });

    const readMap = new Map();
    conversationReads.forEach((cr) => {
      readMap.set(cr.partnerId.toString(), cr.lastReadAt);
    });

    // Calculate unread count for each partner
    const chatPartnersWithUnread = await Promise.all(
      chatPartners.map(async (partner) => {
        const lastReadAt = readMap.get(partner._id.toString());
        
        // Count unread messages (messages sent by partner after lastReadAt)
        const unreadCount = await Message.countDocuments({
          senderId: partner._id,
          receiverId: loggedInUserId,
          createdAt: lastReadAt ? { $gt: lastReadAt } : { $exists: true },
          isDeleted: { $ne: true },
          deletedForSender: { $ne: true },
        });

        // Get last message for preview
        const lastMessage = await Message.findOne({
          $or: [
            { senderId: loggedInUserId, receiverId: partner._id },
            { senderId: partner._id, receiverId: loggedInUserId },
          ],
        })
          .sort({ createdAt: -1 })
          .lean();

        return {
          ...partner.toObject(),
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
    chatPartnersWithUnread.sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
    });

    res.status(200).json(chatPartnersWithUnread);
  } catch (error) {
    console.error("Error in getChatPartners: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete/Recall message
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteOnlyForSender } = req.query; // Check if this is "delete only for sender"
    const userId = req.user._id;

    // Find the message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if user is the sender
    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You can only delete your own messages" });
    }

    // If "delete only for sender", mark as deletedForSender and return early (don't notify receiver)
    if (deleteOnlyForSender === 'true') {
      message.deletedForSender = true;
      await message.save();
      console.log(`🗑️ Message ${messageId} marked as deleted for sender only`);
      
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
      console.log(`🗑️ Message ${messageId} deleted (had file/image)`);

      // Emit socket event to notify receiver
      const receiverSocketId = getReceiverSocketId(message.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messageDeleted", { messageId, deleted: true });
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
      console.log(`🗑️ Message ${messageId} marked as deleted (text only)`);

      // Emit socket event to notify receiver
      const receiverSocketId = getReceiverSocketId(message.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messageDeleted", { 
          messageId, 
          isDeleted: true,
          deletedAt: message.deletedAt 
        });
      }

      return res.status(200).json({ 
        message: "Message recalled successfully",
        isDeleted: true,
        deletedAt: message.deletedAt
      });
    }
  } catch (error) {
    console.error("Error in deleteMessage:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Pin/Unpin message
export const pinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if user is the sender or receiver
    const isSender = message.senderId.toString() === userId.toString();
    const isReceiver = message.receiverId && message.receiverId.toString() === userId.toString();
    
    if (!isSender && !isReceiver) {
      return res.status(403).json({ message: "You can only pin messages in your conversations" });
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
    
    // Populate receiverId and senderId for socket emission
    await message.populate("receiverId", "fullName email profilePic");
    
    // Notify both users
    const receiverSocketId = getReceiverSocketId(message.receiverId);
    const senderSocketId = getReceiverSocketId(message.senderId);
    
    const messageToEmit = message.toObject ? message.toObject() : message;
    messageToEmit.pinnedBy = pinnedByUser?.fullName || "Ai đó";
    // Ensure receiverId and senderId are included
    if (!messageToEmit.receiverId) {
      messageToEmit.receiverId = message.receiverId;
    }
    if (!messageToEmit.senderId) {
      messageToEmit.senderId = message.senderId;
    }
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messagePinned", messageToEmit);
    }
    if (senderSocketId) {
      io.to(senderSocketId).emit("messagePinned", messageToEmit);
    }

    res.status(200).json(messageToEmit);
  } catch (error) {
    console.error("Error in pinMessage:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Mark conversation as read
export const markConversationAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { partnerId } = req.params;

    if (!partnerId) {
      return res.status(400).json({ message: "Partner ID is required" });
    }

    await ConversationRead.findOneAndUpdate(
      { userId, partnerId },
      { 
        userId,
        partnerId,
        lastReadAt: new Date() 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ message: "Conversation marked as read" });
  } catch (error) {
    console.error("Error in markConversationAsRead:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
