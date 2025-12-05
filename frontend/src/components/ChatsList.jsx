import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import { useAuthStore } from "../store/useAuthStore";

function ChatsList({ filterUnread = false }) {
  const { getMyChatPartners, chats, isUsersLoading, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();

  useEffect(() => {
    getMyChatPartners();
  }, [getMyChatPartners]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;
  
  const filteredChats = filterUnread 
    ? chats.filter(chat => chat.unreadCount > 0)
    : chats;
  
  if (filteredChats.length === 0) return <NoChatsFound />;

  return (
    <>
      {filteredChats.map((chat) => (
        <div
          key={chat._id}
          className="bg-cyan-50 p-4 rounded-lg cursor-pointer hover:bg-cyan-100 transition-colors border border-cyan-100 relative"
          onClick={() => setSelectedUser(chat)}
        >
          <div className="flex items-center gap-3">
            <div className={`avatar ${onlineUsers.includes(chat._id) ? "online" : "offline"} relative`}>
              <div className="size-12 rounded-full">
                <img src={chat.profilePic || "/avatar.png"} alt={chat.fullName} />
              </div>
              {chat.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                  {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-gray-900 font-medium truncate">{chat.fullName}</h4>
              {chat.lastMessage && (
                <p className="text-xs text-gray-600 truncate mt-0.5">
                  {chat.lastMessage.senderId?._id === chat._id ? '' : 'Bạn: '}
                  {chat.lastMessage.text || chat.lastMessage.image ? '[Hình ảnh]' : chat.lastMessage.file ? `[File] ${chat.lastMessage.file.fileName}` : ''}
                </p>
              )}
            </div>
            {chat.unreadCount > 0 && (
              <div className="flex-shrink-0">
                <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                  {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
export default ChatsList;
