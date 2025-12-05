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

// Extract public_id from Cloudinary URL
export const extractPublicIdFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{version}/{folder}/{public_id}.{format}
  // Example: https://res.cloudinary.com/daqvp7og1/image/upload/v1764948253/chatify/messages/izyxyezhzpmobunjk4or.png
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
};

// Delete file from Cloudinary
export const deleteFromCloudinary = async (url) => {
  if (!isCloudinaryConfigured) {
    console.warn("⚠️ Cloudinary not configured, cannot delete file");
    return false;
  }

  try {
    const publicId = extractPublicIdFromUrl(url);
    if (!publicId) {
      console.warn("⚠️ Could not extract public_id from URL:", url);
      return false;
    }

    // Determine resource type from URL
    let resourceType = 'image';
    if (url.includes('/video/upload/')) {
      resourceType = 'video';
    } else if (url.includes('/raw/upload/')) {
      resourceType = 'raw';
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    if (result.result === 'ok' || result.result === 'not found') {
      console.log(`✅ File deleted from Cloudinary: ${publicId}`);
      return true;
    } else {
      console.warn(`⚠️ Failed to delete file from Cloudinary: ${result.result}`);
      return false;
    }
  } catch (error) {
    console.error("❌ Error deleting file from Cloudinary:", error);
    return false;
  }
};

export default cloudinary;
export { isCloudinaryConfigured };
