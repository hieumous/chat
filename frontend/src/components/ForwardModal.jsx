import { useState } from "react";
import { XIcon, SearchIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

function ForwardModal({ isOpen, onClose, message }) {
  const { allContacts, groups } = useChatStore();
  const { authUser } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [isForwarding, setIsForwarding] = useState(false);

  if (!isOpen || !message) return null;

  // Filter contacts and groups based on search
  const filteredContacts = allContacts.filter(
    (contact) =>
      contact._id !== authUser._id &&
      contact.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGroups = groups.filter((group) =>
    group.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleRecipient = (id, type) => {
    setSelectedRecipients((prev) => {
      const key = `${type}-${id}`;
      if (prev.some((r) => r.key === key)) {
        return prev.filter((r) => r.key !== key);
      }
      return [...prev, { key, id, type }];
    });
  };

  const handleForward = async () => {
    if (selectedRecipients.length === 0) {
      toast.error("Vui lòng chọn ít nhất một người nhận");
      return;
    }

    setIsForwarding(true);
    try {
      // Forward to each recipient
      for (const recipient of selectedRecipients) {
        const messageData = {
          text: message.text || "",
          image: message.image || "",
          ...(message.file && {
            fileUrl: message.file.fileUrl,
            fileName: message.file.fileName,
            fileType: message.file.fileType,
            fileSize: message.file.fileSize,
          }),
          forwardFrom: message._id, // Track original message
        };

        if (recipient.type === "user") {
          await axiosInstance.post(`/messages/send/${recipient.id}`, messageData);
        } else if (recipient.type === "group") {
          await axiosInstance.post(`/groups/${recipient.id}/send`, messageData);
        }
      }

      toast.success(`Đã chuyển tiếp tin nhắn đến ${selectedRecipients.length} người`);
      onClose();
      setSelectedRecipients([]);
      setSearchTerm("");
    } catch (error) {
      console.error("Forward error:", error);
      toast.error(error.response?.data?.message || "Không thể chuyển tiếp tin nhắn");
    } finally {
      setIsForwarding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Chuyển tiếp tin nhắn</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        {/* Recipients List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Contacts */}
            {filteredContacts.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Liên hệ</h3>
                <div className="space-y-1">
                  {filteredContacts.map((contact) => {
                    const key = `user-${contact._id}`;
                    const isSelected = selectedRecipients.some((r) => r.key === key);
                    return (
                      <button
                        key={contact._id}
                        onClick={() => handleToggleRecipient(contact._id, "user")}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                          isSelected
                            ? "bg-cyan-50 border border-cyan-200"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          {contact.profilePic ? (
                            <img
                              src={contact.profilePic}
                              alt={contact.fullName}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-gray-600 text-sm">
                              {contact.fullName?.charAt(0).toUpperCase() || "?"}
                            </span>
                          )}
                        </div>
                        <span className="flex-1 text-left text-sm text-gray-900">
                          {contact.fullName}
                        </span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-cyan-600 flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Groups */}
            {filteredGroups.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Nhóm</h3>
                <div className="space-y-1">
                  {filteredGroups.map((group) => {
                    const key = `group-${group._id}`;
                    const isSelected = selectedRecipients.some((r) => r.key === key);
                    return (
                      <button
                        key={group._id}
                        onClick={() => handleToggleRecipient(group._id, "group")}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                          isSelected
                            ? "bg-cyan-50 border border-cyan-200"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          {group.groupPic ? (
                            <img
                              src={group.groupPic}
                              alt={group.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-gray-600 text-sm">
                              {group.name?.charAt(0).toUpperCase() || "?"}
                            </span>
                          )}
                        </div>
                        <span className="flex-1 text-left text-sm text-gray-900">
                          {group.name}
                        </span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-cyan-600 flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredContacts.length === 0 && filteredGroups.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                Không tìm thấy kết quả
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Đã chọn: {selectedRecipients.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleForward}
              disabled={selectedRecipients.length === 0 || isForwarding}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isForwarding ? "Đang chuyển tiếp..." : "Chuyển tiếp"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForwardModal;

