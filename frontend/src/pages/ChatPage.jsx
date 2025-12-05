import { useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import ChatsList from "../components/ChatsList";
import GroupsList from "../components/GroupsList";
import ContactList from "../components/ContactList";
import ChatContainer from "../components/ChatContainer";
import CreateGroupModal from "../components/CreateGroupModal";
import NoConversationPlaceholder from "../components/NoConversationPlaceholder";
import GroupInfoSidebar from "../components/GroupInfoSidebar";
import UserInfoSidebar from "../components/UserInfoSidebar";
import { PlusIcon, MessageSquareIcon, UsersIcon, CalendarIcon, CloudIcon, CameraIcon, FileIcon, SettingsIcon, SearchIcon } from "lucide-react";

function ChatPage() {
  const { activeTab, selectedUser, selectedGroup, getAllContacts, setActiveTab, chats, groups } = useChatStore();
  const { authUser } = useAuthStore();
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [chatFilter, setChatFilter] = useState("all"); // "all" or "unread"

  // Calculate total unread counts
  const totalUnreadChats = chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
  const totalUnreadGroups = groups.reduce((sum, group) => sum + (group.unreadCount || 0), 0);

  useEffect(() => {
    if (activeTab === "contacts" || activeTab === "groups") {
      getAllContacts();
    }
  }, [activeTab, getAllContacts]);

  return (
    <div className="relative w-full h-screen flex">
      {/* LEFT NAVIGATION BAR */}
      <div className="w-16 bg-gray-50 border-r border-gray-200 flex flex-col items-center py-4 gap-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 flex items-center justify-center overflow-hidden cursor-pointer">
          <img 
            src={authUser?.profilePic || "/avatar.png"} 
            alt="Profile" 
            className="w-full h-full object-cover"
          />
        </div>
        <button
          onClick={() => setActiveTab("chats")}
          className={`p-2 rounded-lg transition-colors relative ${
            activeTab === "chats" ? "bg-cyan-100 text-cyan-600" : "text-gray-600 hover:bg-gray-100"
          }`}
          title="Tin nhắn"
        >
          <MessageSquareIcon className="w-5 h-5" />
          {totalUnreadChats > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-5 flex items-center justify-center px-1 leading-none">
              {totalUnreadChats > 99 ? '99+' : totalUnreadChats}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("contacts")}
          className={`p-2 rounded-lg transition-colors ${
            activeTab === "contacts" ? "bg-cyan-100 text-cyan-600" : "text-gray-600 hover:bg-gray-100"
          }`}
          title="Danh bạ"
        >
          <UsersIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => setActiveTab("groups")}
          className={`p-2 rounded-lg transition-colors relative ${
            activeTab === "groups" ? "bg-cyan-100 text-cyan-600" : "text-gray-600 hover:bg-gray-100"
          }`}
          title="Nhóm"
        >
          <UsersIcon className="w-5 h-5" />
          {totalUnreadGroups > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-5 flex items-center justify-center px-1 leading-none">
              {totalUnreadGroups > 99 ? '99+' : totalUnreadGroups}
            </span>
          )}
        </button>
        <div className="flex-1" />
        <button
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          title="Cài đặt"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>

      {/* LEFT SIDEBAR - Chat List */}
      <div className="w-80 bg-white flex flex-col border-r border-gray-200">
        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm"
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        {/* Tabs */}
        {activeTab === "chats" && (
          <div className="px-4 pt-2 border-b border-gray-200">
            <div className="flex gap-1">
              <button
                onClick={() => setChatFilter("all")}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  chatFilter === "all" 
                    ? "bg-cyan-50 text-cyan-600" 
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setChatFilter("unread")}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  chatFilter === "unread" 
                    ? "bg-cyan-50 text-cyan-600" 
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Chưa đọc
              </button>
            </div>
          </div>
        )}

        {/* Create Group Button */}
        {activeTab === "groups" && (
          <div className="px-4 pt-4 pb-2">
            <button
              onClick={() => setIsCreateGroupModalOpen(true)}
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg px-4 py-2 font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <PlusIcon className="w-4 h-4" />
              Tạo nhóm
            </button>
          </div>
        )}

        {/* Chat/Group/Contact List */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "chats" && <ChatsList filterUnread={chatFilter === "unread"} />}
          {activeTab === "groups" && <GroupsList filterUnread={chatFilter === "unread"} />}
          {activeTab === "contacts" && <ContactList />}
        </div>
      </div>

      {/* CENTER - Chat Area */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        {selectedUser || selectedGroup ? (
          <>
            <ChatContainer 
              onToggleRightSidebar={() => setShowRightSidebar(!showRightSidebar)}
              showRightSidebar={showRightSidebar}
            />
          </>
        ) : (
          <NoConversationPlaceholder />
        )}
      </div>

      {/* RIGHT SIDEBAR - Group/User Info */}
      {showRightSidebar && (selectedUser || selectedGroup) && (
        <div className="w-80 flex-shrink-0 border-l border-gray-200 animate-in slide-in-from-right duration-300">
          {selectedGroup ? (
            <GroupInfoSidebar onClose={() => setShowRightSidebar(false)} />
          ) : (
            <UserInfoSidebar onClose={() => setShowRightSidebar(false)} />
          )}
        </div>
      )}

      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
      />
    </div>
  );
}
export default ChatPage;
