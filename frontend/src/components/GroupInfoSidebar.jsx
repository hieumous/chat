import { useState } from "react";
import { 
  BellIcon, 
  PinIcon, 
  UserPlusIcon, 
  SettingsIcon,
  UsersIcon,
  LinkIcon,
  CopyIcon,
  ShareIcon,
  ImageIcon,
  VideoIcon,
  XIcon
} from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import GroupMembersModal from "./GroupMembersModal";
import toast from "react-hot-toast";

function GroupInfoSidebar({ onClose }) {
  const { selectedGroup, messages } = useChatStore();
  const { authUser } = useAuthStore();
  const [showJoinLink, setShowJoinLink] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showGroupMembersModal, setShowGroupMembersModal] = useState(false);

  if (!selectedGroup) return null;

  const isAdmin = selectedGroup.admin?._id === authUser._id || selectedGroup.admin === authUser._id;

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

  const handleCopyLink = () => {
    // TODO: Generate join link
    const link = `zalo.me/g/${selectedGroup._id}`;
    navigator.clipboard.writeText(link);
    toast.success("Đã copy link");
  };

  const handleShareLink = () => {
    // TODO: Share link
    toast.success("Đã chia sẻ link");
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Thông tin nhóm</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <XIcon className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Group Profile */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 flex items-center justify-center overflow-hidden mb-3">
              {selectedGroup.groupPic ? (
                <img src={selectedGroup.groupPic} alt={selectedGroup.name} className="w-full h-full object-cover" />
              ) : (
                <UsersIcon className="w-10 h-10 text-white" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{selectedGroup.name}</h3>
            {selectedGroup.description && (
              <p className="text-sm text-gray-600 mt-1 text-center">{selectedGroup.description}</p>
            )}
          </div>
        </div>

        {/* Group Actions */}
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
            <button 
              onClick={() => setShowGroupMembersModal(true)}
              className="flex flex-col items-center gap-2 p-3 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <UserPlusIcon className="w-5 h-5 text-gray-600" />
              <span className="text-xs text-gray-700">Thêm thành viên</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <SettingsIcon className="w-5 h-5 text-gray-600" />
              <span className="text-xs text-gray-700">Quản lý nhóm</span>
            </button>
          </div>
        </div>

        {/* Group Members */}
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Thành viên nhóm</h4>
          <p className="text-xs text-gray-600 mb-3">
            {selectedGroup.members?.length || 0} thành viên
          </p>
          
          {/* Join Link */}
          <div className="mb-3">
            <p className="text-xs text-gray-600 mb-2">Link tham gia nhóm</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-700 truncate">
                  zalo.me/g/{selectedGroup._id.slice(-8)}
                </p>
              </div>
              <button
                onClick={handleCopyLink}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Copy link"
              >
                <CopyIcon className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={handleShareLink}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Chia sẻ link"
              >
                <ShareIcon className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Members List */}
          <div className="space-y-2">
            {selectedGroup.members?.slice(0, 10).map((member) => (
              <div key={member._id || member} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 flex items-center justify-center overflow-hidden">
                  {member.profilePic ? (
                    <img src={member.profilePic} alt={member.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-sm font-medium">
                      {member.fullName?.charAt(0) || "U"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {member.fullName || "Unknown"}
                    {selectedGroup.admin?._id === member._id || selectedGroup.admin === member._id ? (
                      <span className="ml-2 text-xs text-cyan-600">(Admin)</span>
                    ) : null}
                  </p>
                </div>
              </div>
            ))}
            {selectedGroup.members?.length > 10 && (
              <p className="text-xs text-gray-500 text-center py-2">
                +{selectedGroup.members.length - 10} thành viên khác
              </p>
            )}
          </div>
        </div>

        {/* Group Board */}
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Bảng tin nhóm</h4>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
              <p className="text-sm text-gray-700">Danh sách nhắc hẹn</p>
            </button>
            <button className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
              <p className="text-sm text-gray-700">Ghi chú, ghim, bình chọn</p>
            </button>
          </div>
        </div>

        {/* Photos/Videos */}
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

      {/* Group Members Modal */}
      <GroupMembersModal
        isOpen={showGroupMembersModal}
        onClose={() => setShowGroupMembersModal(false)}
        group={selectedGroup}
      />
    </div>
  );
}

export default GroupInfoSidebar;

