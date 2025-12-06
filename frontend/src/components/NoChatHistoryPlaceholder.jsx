import { MessageCircleIcon } from "lucide-react";

const NoChatHistoryPlaceholder = ({ name }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <div className="w-16 h-16 bg-gradient-to-br from-cyan-100 to-cyan-50 rounded-full flex items-center justify-center mb-5">
        <MessageCircleIcon className="size-8 text-cyan-600" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-3">
        Bắt đầu cuộc trò chuyện với {name}
      </h3>
      <div className="flex flex-col space-y-3 max-w-md mb-5">
        <p className="text-gray-600 text-sm">
          Đây là khởi đầu cuộc trò chuyện của bạn. Gửi tin nhắn để bắt đầu trò chuyện!
        </p>
        <div className="h-px w-32 bg-gradient-to-r from-transparent via-cyan-300 to-transparent mx-auto"></div>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        <button className="px-4 py-2 text-xs font-medium text-cyan-700 bg-cyan-100 rounded-full hover:bg-cyan-200 transition-colors">
          👋 Xin chào
        </button>
        <button className="px-4 py-2 text-xs font-medium text-cyan-700 bg-cyan-100 rounded-full hover:bg-cyan-200 transition-colors">
          🤝 Bạn khỏe không?
        </button>
        <button className="px-4 py-2 text-xs font-medium text-cyan-700 bg-cyan-100 rounded-full hover:bg-cyan-200 transition-colors">
          📅 Gặp nhau sớm nhé?
        </button>
      </div>
    </div>
  );
};

export default NoChatHistoryPlaceholder;
