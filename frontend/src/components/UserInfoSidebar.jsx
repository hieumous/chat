import { useState } from "react";
import { 
  BellIcon, 
  PinIcon, 
  SearchIcon,
  XIcon,
  ImageIcon,
  VideoIcon
} from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";

function UserInfoSidebar({ onClose }) {
  const { selectedUser, messages } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const [selectedMedia, setSelectedMedia] = useState(null);

  if (!selectedUser) return null;

  const isOnline = onlineUsers.includes(selectedUser._id);

  // Filter messages to get images and videos
  const mediaMessages = messages
    .filter(msg => {
      if (msg.isDeleted) return false;
      // Check for image
      if (msg.image) return true;
      // Check for video/image file
      if (msg.file) {
        const fileType = msg.file.fileType || '';
        return fileType.startsWith('image/') || fileType.startsWith('video/');
      }
      return false;
    })
    .slice(0, 6); // Show max 6 items

  const getMediaUrl = (msg) => {
    if (msg.image) return msg.image;
    if (msg.file?.fileUrl) return msg.file.fileUrl;
    if (msg.file) return msg.file; // fallback for base64
    return null;
  };

  const getMediaType = (msg) => {
    if (msg.image) return 'image';
    if (msg.file?.fileType?.startsWith('video/')) return 'video';
    if (msg.file?.fileType?.startsWith('image/')) return 'image';
    return 'image'; // default
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Thông tin</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <XIcon className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* User Profile */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col items-center">
            <div className={`relative w-20 h-20 rounded-full mb-3 ${isOnline ? "online" : "offline"}`}>
              <div className="w-20 h-20 rounded-full overflow-hidden">
                <img 
                  src={selectedUser.profilePic || "/avatar.png"} 
                  alt={selectedUser.fullName} 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{selectedUser.fullName}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {isOnline ? "Online" : "Offline"}
            </p>
            {selectedUser.email && (
              <p className="text-xs text-gray-500 mt-1">{selectedUser.email}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-b border-gray-200">
          <div className="grid grid-cols-2 gap-3">
            <button className="flex flex-col items-center gap-2 p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <BellIcon className="w-5 h-5 text-gray-600" />
              <span className="text-xs text-gray-700">Tắt thông báo</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <PinIcon className="w-5 h-5 text-gray-600" />
              <span className="text-xs text-gray-700">Ghim hội thoại</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <SearchIcon className="w-5 h-5 text-gray-600" />
              <span className="text-xs text-gray-700">Tìm kiếm</span>
            </button>
          </div>
        </div>

        {/* Shared Media */}
        <div className="p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Ảnh/Video</h4>
          <div className="grid grid-cols-3 gap-2">
            {mediaMessages.length > 0 ? (
              mediaMessages.map((msg) => {
                const mediaUrl = getMediaUrl(msg);
                const mediaType = getMediaType(msg);
                if (!mediaUrl) return null;

                return (
                  <div
                    key={msg._id}
                    className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative group"
                    onClick={() => setSelectedMedia({ url: mediaUrl, type: mediaType })}
                  >
                    {mediaType === 'image' ? (
                      <img 
                        src={mediaUrl} 
                        alt="Shared media" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : (
                      <video 
                        src={mediaUrl} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    )}
                    <div className="hidden absolute inset-0 bg-gray-100 items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    </div>
                    {mediaType === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                        <VideoIcon className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              // Show placeholders if no media
              [1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-gray-400" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Media Preview Modal */}
        {selectedMedia && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedMedia(null)}
          >
            <button
              onClick={() => setSelectedMedia(null)}
              className="absolute top-4 right-4 p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 z-10"
            >
              <XIcon className="w-5 h-5" />
            </button>
            
            <div className="max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
              {selectedMedia.type === 'image' ? (
                <img 
                  src={selectedMedia.url} 
                  alt="Preview" 
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <video 
                  src={selectedMedia.url} 
                  controls
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserInfoSidebar;

