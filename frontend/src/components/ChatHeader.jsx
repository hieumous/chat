import { XIcon, PhoneIcon, VideoIcon, UsersIcon, PinIcon, XCircleIcon, SearchIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useCallStore } from "../store/useCallStore";
import GroupMembersModal from "./GroupMembersModal";

function ChatHeader({ onToggleRightSidebar = () => {} }) {
  const { selectedUser, selectedGroup, setSelectedUser, setSelectedGroup, pinnedMessages, scrollToMessage, pinMessage } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { startCall } = useCallStore();
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showAllPinned, setShowAllPinned] = useState(false);
  
  const isUserChat = !!selectedUser;
  const isGroupChat = !!selectedGroup;
  const isOnline = selectedUser ? onlineUsers.includes(selectedUser._id) : false;

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape") {
        if (selectedUser) setSelectedUser(null);
        if (selectedGroup) setSelectedGroup(null);
      }
    };

    window.addEventListener("keydown", handleEscKey);

    // cleanup function
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [setSelectedUser, setSelectedGroup, selectedUser, selectedGroup]);

  if (!isUserChat && !isGroupChat) {
    return null;
  }

  return (
    <div className="bg-white border-b border-gray-300">
      {/* Main Header */}
      <div
        className="flex justify-between items-center px-6 flex-1"
        style={{ minHeight: '84px' }}
      >
        <div className="flex items-center space-x-3">
        {isUserChat ? (
          <>
            <div className={`avatar ${isOnline ? "online" : "offline"}`}>
              <div className="w-12 rounded-full">
                <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
              </div>
            </div>
            <div>
              <h3 className="text-gray-900 font-medium">{selectedUser.fullName}</h3>
              <p className="text-gray-600 text-sm">{isOnline ? "Online" : "Offline"}</p>
            </div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 flex items-center justify-center overflow-hidden">
              {selectedGroup.groupPic ? (
                <img src={selectedGroup.groupPic} alt={selectedGroup.name} className="w-full h-full object-cover" />
              ) : (
                <UsersIcon className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h3 className="text-gray-900 font-medium">{selectedGroup.name}</h3>
              <p className="text-gray-600 text-sm">
                {selectedGroup.members?.length || 0} members
              </p>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isUserChat && (
          <>
            {/* Video Call Button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startCall(selectedUser._id, "video");
              }}
              disabled={!isOnline}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Video Call"
            >
              <VideoIcon className="w-5 h-5" />
            </button>
            {/* Search Button */}
            <button
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              title="Tìm kiếm"
            >
              <SearchIcon className="w-5 h-5" />
            </button>
          </>
        )}

        {isGroupChat && (
          <>
            {/* Video Call Button */}
            <button
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              title="Video Call"
            >
              <VideoIcon className="w-5 h-5" />
            </button>
            {/* Search Button */}
            <button
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              title="Tìm kiếm"
            >
              <SearchIcon className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Toggle Right Sidebar Button */}
        <button
          onClick={onToggleRightSidebar}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          title="Thông tin"
        >
          <UsersIcon className="w-5 h-5" />
        </button>
      </div>
      </div>

      {/* Pinned Messages Bar - Below Header */}
      {pinnedMessages && pinnedMessages.length > 0 && (
        <div className="px-6 py-1.5 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0">
              <PinIcon className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <p className="text-xs text-gray-600 flex-shrink-0">Tin nhắn</p>
            <div className="flex-1 min-w-0">
              {/* Show only first pinned message */}
              {pinnedMessages[0] && (
                <div
                  key={pinnedMessages[0]._id}
                  className="group relative w-full px-2 py-1 bg-white rounded-lg border border-gray-200 hover:border-cyan-500 hover:bg-cyan-50 transition-colors"
                >
                  <button
                    onClick={() => scrollToMessage(pinnedMessages[0]._id)}
                    className="w-full text-left pr-6"
                    title="Click to scroll to message"
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-gray-900 font-medium truncate">
                        {pinnedMessages[0].senderId?.fullName || "Unknown"}: {pinnedMessages[0].text || (pinnedMessages[0].image ? "📷 Hình ảnh" : pinnedMessages[0].file ? `📎 ${pinnedMessages[0].file.fileName}` : "Tin nhắn")}
                      </p>
                      {pinnedMessages[0].pinnedBy && (
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          (Ghim bởi {pinnedMessages[0].pinnedBy})
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      pinMessage(pinnedMessages[0]._id, isGroupChat);
                    }}
                    className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-gray-200 rounded-full"
                    title="Hủy ghim"
                  >
                    <XCircleIcon className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>
              )}
              
              {/* Dropdown button if there are more pinned messages */}
              {pinnedMessages.length > 1 && (
                <button
                  onClick={() => setShowAllPinned(!showAllPinned)}
                  className="mt-1 w-full px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  {showAllPinned ? (
                    <>
                      <ChevronUpIcon className="w-3.5 h-3.5" />
                      <span>Ẩn {pinnedMessages.length - 1} tin nhắn khác</span>
                    </>
                  ) : (
                    <>
                      <ChevronDownIcon className="w-3.5 h-3.5" />
                      <span>Xem thêm {pinnedMessages.length - 1} tin nhắn</span>
                    </>
                  )}
                </button>
              )}
              
              {/* Show all pinned messages when dropdown is open */}
              {showAllPinned && pinnedMessages.length > 1 && (
                <div className="mt-1 space-y-1">
                  {pinnedMessages.slice(1).map((msg) => (
                    <div
                      key={msg._id}
                      className="group relative w-full px-2 py-1 bg-white rounded-lg border border-gray-200 hover:border-cyan-500 hover:bg-cyan-50 transition-colors"
                    >
                      <button
                        onClick={() => scrollToMessage(msg._id)}
                        className="w-full text-left pr-6"
                        title="Click to scroll to message"
                      >
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs text-gray-900 font-medium truncate">
                            {msg.senderId?.fullName || "Unknown"}: {msg.text || (msg.image ? "📷 Hình ảnh" : msg.file ? `📎 ${msg.file.fileName}` : "Tin nhắn")}
                          </p>
                          {msg.pinnedBy && (
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              (Ghim bởi {msg.pinnedBy})
                            </span>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          pinMessage(msg._id, isGroupChat);
                        }}
                        className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-gray-200 rounded-full"
                        title="Hủy ghim"
                      >
                        <XCircleIcon className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Group Members Modal */}
      {isGroupChat && (
        <GroupMembersModal
          isOpen={showMembersModal}
          onClose={() => setShowMembersModal(false)}
          group={selectedGroup}
        />
      )}
    </div>
  );
}
export default ChatHeader;
