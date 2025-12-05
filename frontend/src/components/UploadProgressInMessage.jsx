import { useChatStore } from "../store/useChatStore";
import { RefreshCwIcon, AlertCircleIcon } from "lucide-react";
import { formatFileSize } from "../lib/fileUtils";

function UploadProgressInMessage({ messageId, fileName, fileSize }) {
  const { 
    uploadProgress, 
    isUploading, 
    uploadError, 
    pendingUpload,
    retryUpload 
  } = useChatStore();

  // Only show if this message is being uploaded
  if (!pendingUpload || pendingUpload.tempId !== messageId) {
    return null;
  }

  if (uploadError) {
    // Error state with retry button
    return (
      <div className="mt-2 p-2 bg-white bg-opacity-20 rounded-lg">
        <div className="flex items-center gap-2 text-white text-sm mb-2">
          <AlertCircleIcon className="w-4 h-4" />
          <span className="flex-1">{uploadError}</span>
        </div>
        <button
          onClick={retryUpload}
          className="w-full flex items-center justify-center gap-2 bg-white bg-opacity-30 hover:bg-opacity-40 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
        >
          <RefreshCwIcon className="w-4 h-4" />
          Gửi lại
        </button>
      </div>
    );
  }

  if (isUploading) {
    // Uploading state with progress bar
    return (
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between text-xs text-white text-opacity-90">
          <span>Đang tải lên...</span>
          <span>{uploadProgress}%</span>
        </div>
        {fileName && (
          <div className="text-xs text-white text-opacity-70 truncate">
            {fileName} ({formatFileSize(fileSize)})
          </div>
        )}
        <div className="w-full bg-white bg-opacity-20 rounded-full h-1.5">
          <div
            className="bg-white h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      </div>
    );
  }

  return null;
}

export default UploadProgressInMessage;

