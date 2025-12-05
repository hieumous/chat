import { useState, useRef } from "react";
import { FileIcon, XIcon, UploadIcon } from "lucide-react";
import { isValidFileType, isValidFileSize, formatFileSize, getFileInfo, getAcceptString } from "../lib/fileUtils";
import { uploadToCloudinary, isCloudinaryFrontendConfigured } from "../lib/cloudinary";
import toast from "react-hot-toast";

function FileUpload({ onFileSelect, onRemove }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!isValidFileType(file.type)) {
      toast.error(`File type ${file.type} is not supported. Please select a supported file type.`);
      return;
    }

    // Validate file size (increased to 100MB for direct upload)
    const fileInfo = getFileInfo(file.type);
    const maxSize = fileInfo?.maxSize || 100 * 1024 * 1024; // Default 100MB for direct upload
    if (file.size > maxSize) {
      toast.error(`File is too large. Maximum size is ${formatFileSize(maxSize)}.`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Upload directly to Cloudinary if configured, otherwise fallback to base64
      if (isCloudinaryFrontendConfigured) {
        console.log("📤 Uploading file directly to Cloudinary...");
        
        const uploadResult = await uploadToCloudinary(
          file,
          'chatify/files',
          (progress) => {
            setUploadProgress(progress);
          }
        );

        const fileData = {
          fileUrl: uploadResult.secure_url, // URL from Cloudinary
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          uploaded: true, // Flag to indicate it's already uploaded
        };
        
        setSelectedFile(fileData);
        onFileSelect(fileData);
        setIsUploading(false);
        setUploadProgress(100);
        console.log("✅ File uploaded to Cloudinary:", uploadResult.secure_url);
      } else {
        // Fallback to base64 for backward compatibility
        console.log("⚠️ Cloudinary frontend not configured, using base64 fallback");
        
        const reader = new FileReader();
        
        reader.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentLoaded = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percentLoaded);
          }
        };

        reader.onerror = () => {
          toast.error("Failed to read file");
          setIsUploading(false);
          setUploadProgress(0);
        };

        reader.onloadend = () => {
          if (reader.result) {
            const fileData = {
              file: reader.result, // Base64
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              uploaded: false,
            };
            setSelectedFile(fileData);
            onFileSelect(fileData);
            setIsUploading(false);
            setUploadProgress(100);
          } else {
            toast.error("Failed to load file");
            setIsUploading(false);
            setUploadProgress(0);
          }
        };

        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error("File upload error:", error);
      toast.error(error.message || "Failed to upload file. Please try again.");
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onRemove();
  };

  const fileInfo = selectedFile ? getFileInfo(selectedFile.fileType) : null;

  // If file is already selected, show preview
  if (selectedFile) {
    const fileInfo = getFileInfo(selectedFile.fileType);
    return (
      <div className="bg-gray-50 border border-gray-300 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              fileInfo?.category === 'document' ? 'bg-blue-100 text-blue-600' :
              fileInfo?.category === 'video' ? 'bg-red-100 text-red-600' :
              fileInfo?.category === 'audio' ? 'bg-purple-100 text-purple-600' :
              fileInfo?.category === 'archive' ? 'bg-yellow-100 text-yellow-600' :
              'bg-gray-100 text-gray-600'
            }`}>
              <FileIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.fileName}</p>
              <p className="text-xs text-gray-600">{formatFileSize(selectedFile.fileSize)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="p-1 text-gray-500 hover:text-gray-700"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        
        {isUploading && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-cyan-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1 text-center">{uploadProgress}%</p>
          </div>
        )}
      </div>
    );
  }

  // Show upload button
  return (
    <div>
      <input
        type="file"
        accept={getAcceptString()}
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-600 hover:text-gray-900 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <UploadIcon className="w-5 h-5" />
        <span>Upload File</span>
      </button>
    </div>
  );
}

export default FileUpload;

