// Cloudinary configuration for direct frontend uploads
// Note: For security, we should use unsigned upload preset
// The upload preset should be created in Cloudinary Dashboard

export const CLOUDINARY_CONFIG = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '',
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '',
};

// Check if Cloudinary is configured for frontend uploads
export const isCloudinaryFrontendConfigured = 
  CLOUDINARY_CONFIG.cloudName && CLOUDINARY_CONFIG.uploadPreset;

// Debug log to help troubleshoot configuration
if (import.meta.env.DEV) {
  console.log('🔧 Cloudinary Frontend Config:', {
    cloudName: CLOUDINARY_CONFIG.cloudName || '❌ Not set',
    uploadPreset: CLOUDINARY_CONFIG.uploadPreset || '❌ Not set',
    configured: isCloudinaryFrontendConfigured ? '✅ Yes' : '❌ No'
  });
}

// Upload file directly to Cloudinary from frontend
export const uploadToCloudinary = async (file, folder = 'chatify/files', onProgress = null) => {
  if (!isCloudinaryFrontendConfigured) {
    throw new Error('Cloudinary is not configured for frontend uploads. Please configure VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env file.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  formData.append('folder', folder);
  
  // Determine resource type based on file type
  if (file.type.startsWith('video/')) {
    formData.append('resource_type', 'video');
  } else if (file.type.startsWith('audio/')) {
    formData.append('resource_type', 'raw');
  } else {
    formData.append('resource_type', 'raw');
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentCompleted = Math.round((e.loaded * 100) / e.total);
          onProgress(percentCompleted);
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({
            secure_url: response.secure_url,
            public_id: response.public_id,
            bytes: response.bytes,
          });
        } catch (error) {
          reject(new Error('Failed to parse Cloudinary response'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error?.message || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was aborted'));
    });

    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`);
    xhr.send(formData);
  });
};

// Upload image directly to Cloudinary
export const uploadImageToCloudinary = async (file, folder = 'chatify/messages', onProgress = null) => {
  if (!isCloudinaryFrontendConfigured) {
    throw new Error('Cloudinary is not configured for frontend uploads.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  formData.append('folder', folder);
  formData.append('resource_type', 'image');
  // Note: transformation parameter is not allowed with unsigned upload presets
  // If you need transformations, configure them in the upload preset settings in Cloudinary Dashboard

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentCompleted = Math.round((e.loaded * 100) / e.total);
          onProgress(percentCompleted);
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({
            secure_url: response.secure_url,
            public_id: response.public_id,
          });
        } catch (error) {
          reject(new Error('Failed to parse Cloudinary response'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error?.message || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was aborted'));
    });

    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`);
    xhr.send(formData);
  });
};

