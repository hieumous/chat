import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    groupPic: {
      type: String,
      default: "",
    },
    isPublic: {
      type: Boolean,
      default: false, // Default to private (only admin can add members)
    },
  },
  { timestamps: true }
);

// Ensure admin is always in members array
groupSchema.pre("save", function (next) {
  if (this.isNew || this.isModified("adminId")) {
    if (!this.members.includes(this.adminId)) {
      this.members.push(this.adminId);
    }
  }
  next();
});

const Group = mongoose.model("Group", groupSchema);

export default Group;

