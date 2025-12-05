// File type validation and utilities

// Allowed file types
export const ALLOWED_FILE_TYPES = {
  // Documents
  'application/pdf': { category: 'document', icon: 'pdf', maxSize: 10 * 1024 * 1024 }, // 10MB
  'application/msword': { category: 'document', icon: 'doc', maxSize: 10 * 1024 * 1024 }, // 10MB
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { category: 'document', icon: 'docx', maxSize: 10 * 1024 * 1024 }, // 10MB
  'application/vnd.ms-excel': { category: 'document', icon: 'xls', maxSize: 10 * 1024 * 1024 }, // 10MB
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { category: 'document', icon: 'xlsx', maxSize: 10 * 1024 * 1024 }, // 10MB
  'application/vnd.ms-powerpoint': { category: 'document', icon: 'ppt', maxSize: 10 * 1024 * 1024 }, // 10MB
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { category: 'document', icon: 'pptx', maxSize: 10 * 1024 * 1024 }, // 10MB
  'text/plain': { category: 'document', icon: 'txt', maxSize: 5 * 1024 * 1024 }, // 5MB
  
  // Archives
  'application/zip': { category: 'archive', icon: 'zip', maxSize: 50 * 1024 * 1024 }, // 50MB
  'application/x-rar-compressed': { category: 'archive', icon: 'rar', maxSize: 50 * 1024 * 1024 }, // 50MB
  'application/x-7z-compressed': { category: 'archive', icon: '7z', maxSize: 50 * 1024 * 1024 }, // 50MB
  
  // Videos
  // Note: With direct upload, we can support up to 100MB (Cloudinary limit)
  // Base64 fallback is limited to 75MB to account for encoding overhead
  'video/mp4': { category: 'video', icon: 'mp4', maxSize: 100 * 1024 * 1024 }, // 100MB for direct upload
  'video/mpeg': { category: 'video', icon: 'mpeg', maxSize: 100 * 1024 * 1024 }, // 100MB
  'video/quicktime': { category: 'video', icon: 'mov', maxSize: 100 * 1024 * 1024 }, // 100MB
  'video/x-msvideo': { category: 'video', icon: 'avi', maxSize: 100 * 1024 * 1024 }, // 100MB
  'video/webm': { category: 'video', icon: 'webm', maxSize: 100 * 1024 * 1024 }, // 100MB
  
  // Audio
  'audio/mpeg': { category: 'audio', icon: 'mp3', maxSize: 20 * 1024 * 1024 }, // 20MB
  'audio/wav': { category: 'audio', icon: 'wav', maxSize: 20 * 1024 * 1024 }, // 20MB
  'audio/ogg': { category: 'audio', icon: 'ogg', maxSize: 20 * 1024 * 1024 }, // 20MB
  'audio/webm': { category: 'audio', icon: 'webm', maxSize: 20 * 1024 * 1024 }, // 20MB
  'audio/x-m4a': { category: 'audio', icon: 'm4a', maxSize: 20 * 1024 * 1024 }, // 20MB
};

// Get file info from MIME type
export function getFileInfo(mimeType) {
  return ALLOWED_FILE_TYPES[mimeType] || null;
}

// Validate file type
export function isValidFileType(mimeType) {
  return mimeType in ALLOWED_FILE_TYPES;
}

// Validate file size
export function isValidFileSize(mimeType, fileSize) {
  const fileInfo = getFileInfo(mimeType);
  if (!fileInfo) return false;
  return fileSize <= fileInfo.maxSize;
}

// Get file extension from MIME type
export function getFileExtension(mimeType) {
  const fileInfo = getFileInfo(mimeType);
  return fileInfo ? fileInfo.icon : 'file';
}

// Format file size for display
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Check if file can be previewed in browser
export function canPreviewInBrowser(mimeType) {
  const previewableTypes = [
    'application/pdf',
    'image/',
    'video/',
    'audio/',
    'text/plain',
  ];
  
  return previewableTypes.some(type => mimeType.startsWith(type));
}

