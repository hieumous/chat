import { RefreshCwIcon, XIcon, AlertCircleIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { formatFileSize } from "../lib/fileUtils";

function UploadProgress() {
  const { 
    uploadProgress, 
    isUploading, 
    uploadError, 
    pendingUpload,
    retryUpload 
  } = useChatStore();

  // Only show if there's no message-specific progress (for non-file uploads or errors)
  if (!isUploading && !uploadError) return null;
  if (pendingUpload && pendingUpload.tempId) return null; // Message-specific progress will show in message bubble

  const fileName = pendingUpload?.messageData?.fileName || 
                   pendingUpload?.messageData?.file?.fileName || 
                   "file";
  const fileSize = pendingUpload?.messageData?.fileSize || 
                   pendingUpload?.messageData?.file?.fileSize || 0;

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
      <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-4">
        {uploadError ? (
          // Error state with retry button
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircleIcon className="w-5 h-5" />
              <p className="font-medium text-sm">{uploadError}</p>
            </div>
            
            {pendingUpload && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span className="truncate flex-1">{fileName}</span>
                  <span className="ml-2">{formatFileSize(fileSize)}</span>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={retryUpload}
                    className="flex-1 flex items-center justify-center gap-2 bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium"
                  >
                    <RefreshCwIcon className="w-4 h-4" />
                    Gửi lại
                  </button>
                  <button
                    onClick={() => useChatStore.setState({ 
                      uploadError: null, 
                      pendingUpload: null,
                      uploadProgress: 0 
                    })}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Uploading state with progress bar
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-900">Đang tải lên...</span>
              <span className="text-gray-600">{uploadProgress}%</span>
            </div>
            
            {pendingUpload && (
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span className="truncate flex-1">{fileName}</span>
                <span className="ml-2">{formatFileSize(fileSize)}</span>
              </div>
            )}
            
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-cyan-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadProgress;

