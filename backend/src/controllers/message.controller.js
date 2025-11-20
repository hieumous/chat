import cloudinary, { isCloudinaryConfigured } from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

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
    });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!text && !image) {
      return res.status(400).json({ message: "Text or image is required." });
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

        // Check if base64 is too large (limit to 5MB for database storage)
        const base64Size = (image.length * 3) / 4;
        const maxBase64Size = 5 * 1024 * 1024; // 5MB

        // For local development, always store in database
        // For production, use Cloudinary if configured
        const isLocal = process.env.NODE_ENV !== "production";
        
        if (isLocal || !isCloudinaryConfigured) {
          // Store base64 directly in database for local development
          if (base64Size > maxBase64Size) {
            return res.status(400).json({ 
              message: `Image is too large (${Math.round(base64Size / 1024 / 1024)}MB). Maximum size is 5MB.` 
            });
          }
          imageUrl = image; // Store base64 directly in MongoDB
          console.log("📸 Image stored as base64 in database (local mode)");
        } else {
          // Upload to Cloudinary in production if configured
          try {
            const uploadResponse = await cloudinary.uploader.upload(image, {
              folder: "chatify/messages",
              resource_type: "image",
              transformation: [
                { width: 1000, height: 1000, crop: "limit", quality: "auto" }
              ]
            });
            imageUrl = uploadResponse.secure_url;
            console.log("📸 Image uploaded to Cloudinary");
          } catch (cloudinaryError) {
            console.error("Cloudinary upload error:", cloudinaryError);
            // Fallback to base64 if Cloudinary fails
            if (base64Size > maxBase64Size) {
              return res.status(400).json({ 
                message: `Image is too large (${Math.round(base64Size / 1024 / 1024)}MB). Maximum size is 5MB.` 
              });
            }
            console.warn("Cloudinary upload failed, storing as base64 instead");
            imageUrl = image; // Store base64 directly
          }
        }
      } catch (error) {
        console.error("Image processing error:", error);
        return res.status(500).json({ 
          message: "Failed to process image. Please try again or check your image file." 
        });
      }
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text: text || "",
      image: imageUrl || "",
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    console.error("Full error:", error);
    res.status(500).json({ 
      error: "Internal server error",
      message: error.message || "Something went wrong while sending the message"
    });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    // find all the messages where the logged-in user is either sender or receiver
    const messages = await Message.find({
      $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
    });

    const chatPartnerIds = [
      ...new Set(
        messages.map((msg) =>
          msg.senderId.toString() === loggedInUserId.toString()
            ? msg.receiverId.toString()
            : msg.senderId.toString()
        )
      ),
    ];

    const chatPartners = await User.find({ _id: { $in: chatPartnerIds } }).select("-password");

    res.status(200).json(chatPartners);
  } catch (error) {
    console.error("Error in getChatPartners: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
