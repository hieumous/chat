import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import { UsersIcon } from "lucide-react";

function GroupsList({ filterUnread = false }) {
  const { getMyGroups, groups, isGroupsLoading, setSelectedGroup } = useChatStore();

  useEffect(() => {
    getMyGroups();
  }, [getMyGroups]);

  if (isGroupsLoading) return <UsersLoadingSkeleton />;
  
  const filteredGroups = filterUnread 
    ? groups.filter(group => group.unreadCount > 0)
    : groups;
  
  if (filteredGroups.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <UsersIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No groups yet</p>
        <p className="text-sm">Create a group to start chatting</p>
      </div>
    );
  }

  return (
    <>
      {filteredGroups.map((group) => (
        <div
          key={group._id}
          className="bg-cyan-50 p-4 rounded-lg cursor-pointer hover:bg-cyan-100 transition-colors border border-cyan-100 relative"
          onClick={() => setSelectedGroup(group)}
        >
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 flex items-center justify-center overflow-hidden relative">
              {group.groupPic ? (
                <img src={group.groupPic} alt={group.name} className="w-full h-full object-cover" />
              ) : (
                <UsersIcon className="w-6 h-6 text-white" />
              )}
              {group.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                  {group.unreadCount > 99 ? '99+' : group.unreadCount}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-gray-900 font-medium truncate">{group.name}</h4>
              {group.lastMessage ? (
                <p className="text-xs text-gray-600 truncate mt-0.5">
                  {group.lastMessage.senderId?.fullName || 'Someone'}: {group.lastMessage.text || group.lastMessage.image ? '[Hình ảnh]' : group.lastMessage.file ? `[File] ${group.lastMessage.file.fileName}` : ''}
                </p>
              ) : (
                <p className="text-xs text-gray-600 truncate">
                  {group.members?.length || 0} members
                </p>
              )}
            </div>
            {group.unreadCount > 0 && (
              <div className="flex-shrink-0">
                <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                  {group.unreadCount > 99 ? '99+' : group.unreadCount}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

export default GroupsList;

