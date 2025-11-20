import { v2 as cloudinary } from "cloudinary";
import { ENV } from "./env.js";

// Check if Cloudinary is configured
const isCloudinaryConfigured = 
  ENV.CLOUDINARY_CLOUD_NAME && 
  ENV.CLOUDINARY_API_KEY && 
  ENV.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
    api_key: ENV.CLOUDINARY_API_KEY,
    api_secret: ENV.CLOUDINARY_API_SECRET,
  });
  console.log("✅ Cloudinary configured successfully");
} else {
  console.warn("⚠️  Cloudinary not configured. Image uploads will be stored as base64 in database.");
  console.warn("   To enable Cloudinary, add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your .env file");
}

export default cloudinary;
export { isCloudinaryConfigured };
