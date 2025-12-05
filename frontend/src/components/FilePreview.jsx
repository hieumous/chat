import { useState } from "react";
import { 
  FileIcon, 
  DownloadIcon, 
  PlayIcon, 
  XIcon,
  FileTextIcon,
  VideoIcon,
  MusicIcon,
  ArchiveIcon
} from "lucide-react";
import { formatFileSize, getFileInfo, canPreviewInBrowser } from "../lib/fileUtils";

function FilePreview({ file, onClose, isInMessage = false, isMyMessage = false }) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInfo = file ? getFileInfo(file.fileType) : null;
  const canPreview = file ? canPreviewInBrowser(file.fileType) : false;

  const handleDownload = async () => {
    if (!file?.fileUrl) return;

    try {
      // If file is base64, create blob and download
      if (file.fileUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = file.fileUrl;
        link.download = file.fileName || 'file';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // If file is URL, fetch and download
        const response = await fetch(file.fileUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.fileName || `file-${Date.now()}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: open in new tab
      window.open(file.fileUrl, '_blank');
    }
  };

  const handlePreview = () => {
    setIsPreviewOpen(true);
  };

  if (!file) return null;

  const getIcon = () => {
    if (!fileInfo) return <FileIcon className="w-8 h-8" />;
    
    switch (fileInfo.category) {
      case 'document':
        return <FileTextIcon className="w-8 h-8" />;
      case 'video':
        return <VideoIcon className="w-8 h-8" />;
      case 'audio':
        return <MusicIcon className="w-8 h-8" />;
      case 'archive':
        return <ArchiveIcon className="w-8 h-8" />;
      default:
        return <FileIcon className="w-8 h-8" />;
    }
  };

  const getCategoryColor = () => {
    if (!fileInfo) return 'bg-gray-100 text-gray-600';
    
    switch (fileInfo.category) {
      case 'document':
        return 'bg-blue-100 text-blue-600';
      case 'video':
        return 'bg-red-100 text-red-600';
      case 'audio':
        return 'bg-purple-100 text-purple-600';
      case 'archive':
        return 'bg-yellow-100 text-yellow-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  // Styling for message bubble context
  if (isInMessage) {
    // For video files, show video preview directly in message bubble
    if (file.fileType?.startsWith('video/')) {
      return (
        <>
          <div className="relative rounded-lg overflow-hidden mb-2 group">
            <video
              src={file.fileUrl}
              controls
              className="w-full max-w-md h-auto rounded-lg"
              preload="metadata"
              onClick={(e) => {
                e.stopPropagation();
                // Open video in fullscreen modal
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4';
                modal.onclick = (e) => {
                  if (e.target === modal) {
                    document.body.removeChild(modal);
                  }
                };
                
                const video = document.createElement('video');
                video.src = file.fileUrl;
                video.controls = true;
                video.className = 'max-w-full max-h-[90vh] rounded-lg';
                video.autoplay = true;
                
                const closeBtn = document.createElement('button');
                closeBtn.className = 'absolute top-4 right-4 p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 z-10';
                closeBtn.innerHTML = '✕';
                closeBtn.onclick = () => {
                  video.pause();
                  document.body.removeChild(modal);
                };
                
                const downloadBtn = document.createElement('button');
                downloadBtn.className = 'absolute bottom-4 right-4 p-3 bg-cyan-600 text-white rounded-full hover:bg-cyan-700 z-10 flex items-center gap-2';
                downloadBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Tải về';
                downloadBtn.onclick = (e) => {
                  e.stopPropagation();
                  const link = document.createElement('a');
                  link.href = file.fileUrl;
                  link.download = file.fileName || `video-${Date.now()}.mp4`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                };
                
                modal.appendChild(video);
                modal.appendChild(closeBtn);
                modal.appendChild(downloadBtn);
                document.body.appendChild(modal);
              }}
            />
            <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                className={`p-1.5 rounded-full transition-colors backdrop-blur-sm ${
                  isMyMessage 
                    ? 'bg-black bg-opacity-50 text-white hover:bg-opacity-70' 
                    : 'bg-white bg-opacity-80 text-gray-900 hover:bg-opacity-100'
                }`}
                title="Tải video về"
              >
                <DownloadIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className={`text-xs ${isMyMessage ? 'text-white text-opacity-80' : 'text-gray-600'}`}>
            {file.fileName} • {formatFileSize(file.fileSize)}
          </p>
        </>
      );
    }

    // For audio files, show audio player
    if (file.fileType?.startsWith('audio/')) {
      return (
        <>
          <div className={`p-3 rounded-lg ${isMyMessage ? 'bg-white bg-opacity-20 backdrop-blur-sm' : 'bg-gray-100'}`}>
            <audio
              src={file.fileUrl}
              controls
              className="w-full mb-2"
            />
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate text-sm ${isMyMessage ? 'text-white' : 'text-gray-900'}`}>
                  {file.fileName}
                </p>
                <p className={`text-xs mt-0.5 ${isMyMessage ? 'text-white text-opacity-80' : 'text-gray-600'}`}>
                  {formatFileSize(file.fileSize)}
                </p>
              </div>
              <button
                onClick={handleDownload}
                className={`p-1.5 rounded transition-colors ${
                  isMyMessage 
                    ? 'text-white hover:bg-white hover:bg-opacity-20' 
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
                title="Download"
              >
                <DownloadIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      );
    }

    // For other files (documents, archives, etc.), show icon + info
    return (
      <>
        <div className={`p-3 rounded-lg ${isMyMessage ? 'bg-white bg-opacity-20 backdrop-blur-sm' : 'bg-gray-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 ${getCategoryColor()} rounded-lg p-2 flex items-center justify-center`}>
              {getIcon()}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate text-sm ${isMyMessage ? 'text-white' : 'text-gray-900'}`}>
                {file.fileName}
              </p>
              <p className={`text-xs mt-0.5 ${isMyMessage ? 'text-white text-opacity-80' : 'text-gray-600'}`}>
                {formatFileSize(file.fileSize)}
              </p>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {canPreview && (
                <button
                  onClick={handlePreview}
                  className={`p-1.5 rounded transition-colors ${
                    isMyMessage 
                      ? 'text-white hover:bg-white hover:bg-opacity-20' 
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                  title="Preview"
                >
                  <PlayIcon className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleDownload}
                className={`p-1.5 rounded transition-colors ${
                  isMyMessage 
                    ? 'text-white hover:bg-white hover:bg-opacity-20' 
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
                title="Download"
              >
                <DownloadIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Preview Modal */}
        {isPreviewOpen && canPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto relative">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="absolute top-4 right-4 z-10 p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700"
              >
                <XIcon className="w-5 h-5" />
              </button>
              
              <div className="p-4">
                {file.fileType.startsWith('video/') && (
                  <video
                    src={file.fileUrl}
                    controls
                    className="w-full h-auto max-h-[80vh]"
                  />
                )}
                
                {file.fileType.startsWith('audio/') && (
                  <div className="p-8">
                    <audio
                      src={file.fileUrl}
                      controls
                      className="w-full"
                    />
                  </div>
                )}
                
                {file.fileType === 'application/pdf' && (
                  <iframe
                    src={file.fileUrl}
                    className="w-full h-[80vh] border-0"
                    title={file.fileName}
                  />
                )}
                
                {file.fileType === 'text/plain' && (
                  <div className="p-4">
                    <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-lg overflow-auto max-h-[80vh]">
                      {file.fileUrl.startsWith('data:') 
                        ? atob(file.fileUrl.split(',')[1])
                        : 'Loading...'}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Default styling (for non-message context)
  return (
    <>
      <div className={`p-4 rounded-lg border ${getCategoryColor()} border-opacity-50`}>
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 ${getCategoryColor()} rounded-lg p-3`}>
            {getIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{file.fileName}</p>
            <p className="text-sm text-gray-600">{formatFileSize(file.fileSize)}</p>
            {fileInfo && (
              <p className="text-xs text-gray-500 mt-1">{fileInfo.label || fileInfo.category}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canPreview && (
              <button
                onClick={handlePreview}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Preview"
              >
                <PlayIcon className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleDownload}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Download"
            >
              <DownloadIcon className="w-4 h-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Remove"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {isPreviewOpen && canPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto relative">
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700"
            >
              <XIcon className="w-5 h-5" />
            </button>
            
            <div className="p-4">
              {file.fileType.startsWith('video/') && (
                <video
                  src={file.fileUrl}
                  controls
                  className="w-full h-auto max-h-[80vh]"
                />
              )}
              
              {file.fileType.startsWith('audio/') && (
                <div className="p-8">
                  <audio
                    src={file.fileUrl}
                    controls
                    className="w-full"
                  />
                </div>
              )}
              
              {file.fileType === 'application/pdf' && (
                <iframe
                  src={file.fileUrl}
                  className="w-full h-[80vh] border-0"
                  title={file.fileName}
                />
              )}
              
              {file.fileType === 'text/plain' && (
                <div className="p-4">
                  <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-lg overflow-auto max-h-[80vh]">
                    {file.fileUrl.startsWith('data:') 
                      ? atob(file.fileUrl.split(',')[1])
                      : 'Loading...'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default FilePreview;

