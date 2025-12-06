import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    text: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    image: {
      type: String,
    },
    file: {
      fileUrl: {
        type: String,
      },
      fileName: {
        type: String,
      },
      fileType: {
        type: String, // MIME type: application/pdf, video/mp4, etc.
      },
      fileSize: {
        type: Number, // Size in bytes
      },
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    deletedForSender: {
      type: Boolean,
      default: false,
    },
    reactions: {
      type: Map,
      of: [mongoose.Schema.Types.ObjectId], // Array of user IDs who reacted with this emoji
      default: {},
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    forwardFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isStarred: {
      type: Boolean,
      default: false,
    },
    call: {
      callType: {
        type: String,
        enum: ["video", "audio"],
      },
      duration: {
        type: Number, // Duration in seconds
      },
      status: {
        type: String,
        enum: ["missed", "answered", "rejected"],
      },
    },
  },
  { timestamps: true }
);

// Validation to ensure either receiverId or groupId is present (but not both)
messageSchema.pre("validate", function (next) {
  if (!this.receiverId && !this.groupId) {
    return next(new Error("Either receiverId or groupId must be provided"));
  }
  if (this.receiverId && this.groupId) {
    return next(new Error("Cannot have both receiverId and groupId"));
  }
  next();
});

const Message = mongoose.model("Message", messageSchema);

export default Message;
