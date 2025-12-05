import mongoose from "mongoose";

const conversationReadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // For one-on-one chats
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // For group chats
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Ensure either partnerId or groupId is present (but not both)
conversationReadSchema.pre("save", function (next) {
  if (!this.partnerId && !this.groupId) {
    return next(new Error("Either partnerId or groupId must be provided"));
  }
  if (this.partnerId && this.groupId) {
    return next(new Error("Cannot have both partnerId and groupId"));
  }
  next();
});

// Compound index for efficient queries
// Use partial index to avoid duplicate key errors with null values
// Only index documents where the field exists and is an ObjectId
conversationReadSchema.index(
  { userId: 1, partnerId: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { partnerId: { $exists: true, $type: "objectId" } }
  }
);
conversationReadSchema.index(
  { userId: 1, groupId: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { groupId: { $exists: true, $type: "objectId" } }
  }
);

const ConversationRead = mongoose.model("ConversationRead", conversationReadSchema);

export default ConversationRead;

