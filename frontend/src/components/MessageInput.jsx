import { useRef, useState, useEffect } from "react";
import useKeyboardSound from "../hooks/useKeyboardSound";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";
import { ImageIcon, SendIcon, XIcon, PaperclipIcon } from "lucide-react";
import FileUpload from "./FileUpload";
import { uploadImageToCloudinary, isCloudinaryFrontendConfigured } from "../lib/cloudinary";

function MessageInput() {
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const { 
    sendMessage, 
    sendGroupMessage,
    isSoundEnabled, 
    selectedUser, 
    selectedGroup,
    emitTyping, 
    emitStopTyping,
    emitGroupTyping,
    emitStopGroupTyping,
    replyingTo,
    clearReplyingTo,
  } = useChatStore();
  const { authUser } = useAuthStore();

  const isUserChat = !!selectedUser;
  const isGroupChat = !!selectedGroup;

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview && !selectedFile) return;
    if (isSoundEnabled) playRandomKeyStrokeSound();

    // Stop typing indicator when sending
    if (isUserChat) {
      emitStopTyping(selectedUser._id);
    } else if (isGroupChat) {
      emitStopGroupTyping(selectedGroup._id);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    const messageData = {
      text: text.trim(),
      image: imagePreview,
      ...(selectedFile && {
        // If file was already uploaded to Cloudinary, send fileUrl. Otherwise send base64 file.
        fileUrl: selectedFile.uploaded ? selectedFile.fileUrl : undefined,
        file: selectedFile.uploaded ? undefined : selectedFile.file, // Base64 fallback
        fileName: selectedFile.fileName,
        fileType: selectedFile.fileType,
        fileSize: selectedFile.fileSize,
      }),
    };

    if (isUserChat) {
      sendMessage(messageData);
    } else if (isGroupChat) {
      sendGroupMessage(selectedGroup._id, messageData);
    }

    setText("");
    setImagePreview("");
    setSelectedFile(null);
    clearReplyingTo(); // Clear reply after sending
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Handle typing indicator
  useEffect(() => {
    if ((!isUserChat && !isGroupChat) || !text.trim()) {
      // Stop typing if text is empty
      if (isUserChat) {
        emitStopTyping(selectedUser._id);
      } else if (isGroupChat) {
        emitStopGroupTyping(selectedGroup._id);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      return;
    }

    // Emit typing event
    if (isUserChat) {
      emitTyping(selectedUser._id);
    } else if (isGroupChat) {
      emitGroupTyping(selectedGroup._id);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (isUserChat) {
        emitStopTyping(selectedUser._id);
      } else if (isGroupChat) {
        emitStopGroupTyping(selectedGroup._id);
      }
      typingTimeoutRef.current = null;
    }, 2000);

    // Cleanup on unmount
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [text, isUserChat, isGroupChat, selectedUser, selectedGroup, emitTyping, emitStopTyping, emitGroupTyping, emitStopGroupTyping]);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file hình ảnh");
      return;
    }

    // Check file size (max 10MB for direct upload)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      toast.error("Kích thước hình ảnh phải nhỏ hơn 10MB");
      return;
    }

    try {
      // Upload directly to Cloudinary if configured
      if (isCloudinaryFrontendConfigured) {
        const uploadResult = await uploadImageToCloudinary(file, 'chatify/messages');
        setImagePreview(uploadResult.secure_url); // Store URL instead of base64
      } else {
        // Fallback to base64
        const reader = new FileReader();
        reader.onerror = () => {
          toast.error("Không thể đọc file hình ảnh");
        };
        reader.onloadend = () => {
          if (reader.result) {
            setImagePreview(reader.result);
          } else {
            toast.error("Không thể tải hình ảnh");
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error(error.message || "Không thể tải lên hình ảnh. Vui lòng thử lại.");
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="p-4 border-t border-gray-300">
      {/* Image Preview */}
      {imagePreview && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-gray-300"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-white hover:bg-gray-700"
              type="button"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* File Preview */}
      {selectedFile && (
        <div className="max-w-3xl mx-auto mb-3">
          <FileUpload
            onFileSelect={setSelectedFile}
            onRemove={() => setSelectedFile(null)}
          />
        </div>
      )}

      {/* Reply Preview */}
      {replyingTo && (
        <div className="max-w-3xl mx-auto mb-2 p-3 bg-gray-50 border-l-4 border-cyan-600 rounded-lg flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-cyan-600 font-medium mb-1">
              Trả lời {replyingTo.senderId?.fullName || "Unknown"}
            </div>
            <div className="text-sm text-gray-700 truncate">
              {replyingTo.text || (replyingTo.image ? "📷 Hình ảnh" : replyingTo.file?.fileName || "File")}
            </div>
          </div>
          <button
            type="button"
            onClick={clearReplyingTo}
            className="ml-2 p-1 hover:bg-gray-200 rounded-full transition-colors"
          >
            <XIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto space-y-2">
        <div className="flex space-x-4">
          <input
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              isSoundEnabled && playRandomKeyStrokeSound();
            }}
            className="flex-1 bg-white border border-gray-300 rounded-lg py-2 px-4 text-gray-900"
            placeholder="Nhập tin nhắn của bạn..."
          />

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
          />

          {/* File Upload Button */}
          {!selectedFile && (
            <FileUpload
              onFileSelect={setSelectedFile}
              onRemove={() => setSelectedFile(null)}
            />
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`bg-white border border-gray-300 text-gray-600 hover:text-gray-900 rounded-lg px-4 transition-colors ${
              imagePreview ? "text-cyan-600 border-cyan-500" : ""
            }`}
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          
          <button
            type="submit"
            disabled={!text.trim() && !imagePreview && !selectedFile}
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg px-4 py-2 font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
export default MessageInput;
