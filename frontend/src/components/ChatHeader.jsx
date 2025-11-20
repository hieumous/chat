import { XIcon, PhoneIcon, VideoIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useCallStore } from "../store/useCallStore";

function ChatHeader() {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { startCall } = useCallStore();
  const isOnline = onlineUsers.includes(selectedUser._id);

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape") setSelectedUser(null);
    };

    window.addEventListener("keydown", handleEscKey);

    // cleanup function
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [setSelectedUser]);

  return (
    <div
      className="flex justify-between items-center bg-white border-b
   border-gray-300 max-h-[84px] px-6 flex-1"
    >
      <div className="flex items-center space-x-3">
        <div className={`avatar ${isOnline ? "online" : "offline"}`}>
          <div className="w-12 rounded-full">
            <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
          </div>
        </div>

        <div>
          <h3 className="text-gray-900 font-medium">{selectedUser.fullName}</h3>
          <p className="text-gray-600 text-sm">{isOnline ? "Online" : "Offline"}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Audio Call Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Audio call button clicked", selectedUser);
            startCall(selectedUser._id, "audio");
          }}
          disabled={!isOnline}
          className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Audio Call"
        >
          <PhoneIcon className="w-5 h-5" />
        </button>

        {/* Video Call Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Video call button clicked", selectedUser);
            startCall(selectedUser._id, "video");
          }}
          disabled={!isOnline}
          className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Video Call"
        >
          <VideoIcon className="w-5 h-5" />
        </button>

        {/* Close Button */}
        <button onClick={() => setSelectedUser(null)}>
          <XIcon className="w-5 h-5 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer" />
        </button>
      </div>
    </div>
  );
}
export default ChatHeader;
