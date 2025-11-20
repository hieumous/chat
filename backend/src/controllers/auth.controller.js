import { sendWelcomeEmail } from "../emails/emailHandlers.js";
import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { ENV } from "../lib/env.js";
import cloudinary, { isCloudinaryConfigured } from "../lib/cloudinary.js";

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;

  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // check if emailis valid: regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "Email already exists" });

    // 123456 => $dnjasdkasj_?dmsakmk
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    if (newUser) {
      // before CR:
      // generateToken(newUser._id, res);
      // await newUser.save();

      // after CR:
      // Persist user first, then issue auth cookie
      const savedUser = await newUser.save();
      generateToken(savedUser._id, res);

      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
      });

      try {
        await sendWelcomeEmail(savedUser.email, savedUser.fullName, ENV.CLIENT_URL);
      } catch (error) {
        console.error("Failed to send welcome email:", error);
      }
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.log("Error in signup controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    // never tell the client which one is incorrect: password or email

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) return res.status(400).json({ message: "Invalid credentials" });

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (error) {
    console.error("Error in login controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = (_, res) => {
  res.cookie("jwt", "", { maxAge: 0 });
  res.status(200).json({ message: "Logged out successfully" });
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    if (!profilePic) return res.status(400).json({ message: "Profile pic is required" });

    // Validate base64 image format
    if (!profilePic.startsWith("data:image/")) {
      return res.status(400).json({ message: "Invalid image format. Please select a valid image file." });
    }

    const userId = req.user._id;
    let profilePicUrl;

    // Check base64 size (max 2MB for profile pics)
    const base64Size = (profilePic.length * 3) / 4;
    const maxBase64Size = 2 * 1024 * 1024; // 2MB

    // For local development, always store in database
    // For production, use Cloudinary if configured
    const isLocal = process.env.NODE_ENV !== "production";
    
    if (isLocal || !isCloudinaryConfigured) {
      // Store base64 directly in database for local development
      if (base64Size > maxBase64Size) {
        return res.status(400).json({ 
          message: `Image is too large (${Math.round(base64Size / 1024 / 1024)}MB). Maximum size is 2MB.` 
        });
      }
      profilePicUrl = profilePic; // Store base64 directly in MongoDB
      console.log("📸 Profile picture stored as base64 in database (local mode)");
    } else {
      // Upload to Cloudinary in production if configured
      try {
        const uploadResponse = await cloudinary.uploader.upload(profilePic, {
          folder: "chatify/profiles",
          resource_type: "image",
          transformation: [
            { width: 400, height: 400, crop: "limit", quality: "auto" }
          ]
        });
        profilePicUrl = uploadResponse.secure_url;
        console.log("📸 Profile picture uploaded to Cloudinary");
      } catch (cloudinaryError) {
        console.error("Cloudinary upload error:", cloudinaryError);
        // Fallback to base64 if Cloudinary fails
        if (base64Size > maxBase64Size) {
          return res.status(400).json({ 
            message: `Image is too large (${Math.round(base64Size / 1024 / 1024)}MB). Maximum size is 2MB.` 
          });
        }
        console.warn("Cloudinary upload failed, storing as base64 instead");
        profilePicUrl = profilePic;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: profilePicUrl },
      { new: true }
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("Error in update profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
