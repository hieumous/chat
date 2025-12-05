// File utilities for frontend

// Allowed file types mapping
export const ALLOWED_FILE_TYPES = {
  // Documents
  'application/pdf': { category: 'document', icon: 'pdf', maxSize: 10 * 1024 * 1024, label: 'PDF' },
  'application/msword': { category: 'document', icon: 'doc', maxSize: 10 * 1024 * 1024, label: 'DOC' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { category: 'document', icon: 'docx', maxSize: 10 * 1024 * 1024, label: 'DOCX' },
  'application/vnd.ms-excel': { category: 'document', icon: 'xls', maxSize: 10 * 1024 * 1024, label: 'XLS' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { category: 'document', icon: 'xlsx', maxSize: 10 * 1024 * 1024, label: 'XLSX' },
  'application/vnd.ms-powerpoint': { category: 'document', icon: 'ppt', maxSize: 10 * 1024 * 1024, label: 'PPT' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { category: 'document', icon: 'pptx', maxSize: 10 * 1024 * 1024, label: 'PPTX' },
  'text/plain': { category: 'document', icon: 'txt', maxSize: 5 * 1024 * 1024, label: 'TXT' },
  
  // Archives
  'application/zip': { category: 'archive', icon: 'zip', maxSize: 50 * 1024 * 1024, label: 'ZIP' },
  'application/x-rar-compressed': { category: 'archive', icon: 'rar', maxSize: 50 * 1024 * 1024, label: 'RAR' },
  'application/x-7z-compressed': { category: 'archive', icon: '7z', maxSize: 50 * 1024 * 1024, label: '7Z' },
  
  // Videos
  // Note: With direct upload, we can support up to 100MB (Cloudinary limit)
  // Base64 fallback is limited to 75MB to account for encoding overhead
  'video/mp4': { category: 'video', icon: 'mp4', maxSize: 100 * 1024 * 1024, label: 'MP4' },
  'video/mpeg': { category: 'video', icon: 'mpeg', maxSize: 100 * 1024 * 1024, label: 'MPEG' },
  'video/quicktime': { category: 'video', icon: 'mov', maxSize: 100 * 1024 * 1024, label: 'MOV' },
  'video/x-msvideo': { category: 'video', icon: 'avi', maxSize: 100 * 1024 * 1024, label: 'AVI' },
  'video/webm': { category: 'video', icon: 'webm', maxSize: 100 * 1024 * 1024, label: 'WEBM' },
  
  // Audio
  'audio/mpeg': { category: 'audio', icon: 'mp3', maxSize: 20 * 1024 * 1024, label: 'MP3' },
  'audio/wav': { category: 'audio', icon: 'wav', maxSize: 20 * 1024 * 1024, label: 'WAV' },
  'audio/ogg': { category: 'audio', icon: 'ogg', maxSize: 20 * 1024 * 1024, label: 'OGG' },
  'audio/webm': { category: 'audio', icon: 'webm', maxSize: 20 * 1024 * 1024, label: 'WEBM' },
  'audio/x-m4a': { category: 'audio', icon: 'm4a', maxSize: 20 * 1024 * 1024, label: 'M4A' },
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

// Get file icon component name
export function getFileIcon(mimeType) {
  const fileInfo = getFileInfo(mimeType);
  if (!fileInfo) return 'file';
  return fileInfo.icon;
}

// Get accept string for file input
export function getAcceptString() {
  const types = Object.keys(ALLOWED_FILE_TYPES);
  // Also include images
  types.push('image/*');
  return types.join(',');
}

