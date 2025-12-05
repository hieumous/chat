import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import ChatHeader from "./ChatHeader";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";
import MessageInput from "./MessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import FilePreview from "./FilePreview";
import UploadProgressInMessage from "./UploadProgressInMessage";
import MessageContextMenu from "./MessageContextMenu";
import ReactionPicker from "./ReactionPicker";
import ForwardModal from "./ForwardModal";
import { SmileIcon, ReplyIcon, ForwardIcon, MoreVerticalIcon, PinIcon } from "lucide-react";
import toast from "react-hot-toast";

// Context Menu Portal Component with drag functionality
function ContextMenuPortal({ 
  adjustedX, 
  initialY, 
  contextMenu, 
  authUser, 
  isGroupChat,
  deleteMessage,
  deleteGroupMessage,
  setReplyingTo,
  setForwardingMessage,
  pinMessage,
  starMessage,
  onClose 
}) {
  const [menuY, setMenuY] = useState(initialY);
  const containerRef = useRef(null);

  useEffect(() => {
    // Update position when initialY changes
    setMenuY(initialY);
  }, [initialY]);

  const handlePositionChange = (newPos) => {
    setMenuY(newPos.y);
    if (containerRef.current) {
      containerRef.current.style.top = `${newPos.y}px`;
    }
  };

  return (
    <div 
      ref={containerRef}
      data-context-menu="true"
      className="fixed"
      style={{ 
        zIndex: 99999,
        left: `${adjustedX}px`,
        top: `${menuY}px`,
        transform: 'translate(-50%, -50%)',
      }}
      onMouseEnter={() => {
        // Keep menu open when hovering
      }}
      onMouseLeave={(e) => {
        // Close menu when mouse leaves
        const relatedTarget = e.relatedTarget;
        if (!relatedTarget || !relatedTarget.closest('[data-context-menu]')) {
          setTimeout(() => {
            const menuElement = document.querySelector('[data-context-menu]');
            if (!menuElement || !menuElement.matches(':hover')) {
              onClose();
            }
          }, 200);
        }
      }}
    >
      <MessageContextMenu
        message={contextMenu.message}
        isMyMessage={contextMenu.message.senderId?._id === authUser._id || contextMenu.message.senderId === authUser._id}
        position={{ x: adjustedX, y: menuY }}
        isOverlay={true}
        onPositionChange={handlePositionChange}
        onClose={onClose}
        onRecall={() => {
          if (isGroupChat) {
            deleteGroupMessage(contextMenu.message._id);
          } else {
            deleteMessage(contextMenu.message._id);
          }
          onClose();
        }}
        onDelete={() => {
          // "Xóa chỉ ở phía tôi" - delete only for current user, not for receiver/group
          if (isGroupChat) {
            deleteGroupMessage(contextMenu.message._id, true);
          } else {
            deleteMessage(contextMenu.message._id, true);
          }
          onClose();
        }}
        onReply={() => {
          setReplyingTo(contextMenu.message);
          onClose();
        }}
        onForward={() => {
          setForwardingMessage(contextMenu.message);
          onClose();
        }}
        onPin={() => {
          if (pinMessage) {
            pinMessage(contextMenu.message._id, isGroupChat);
          }
        }}
        onStar={() => {
          if (starMessage) {
            starMessage(contextMenu.message._id, isGroupChat);
          }
        }}
        onCopyImage={async (imageUrl) => {
          try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            await navigator.clipboard.write([
              new ClipboardItem({ [blob.type]: blob })
            ]);
            toast.success("Đã copy hình ảnh");
          } catch (error) {
            toast.error("Không thể copy hình ảnh");
          }
        }}
        onDownload={(url, fileName) => {
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast.success("Đã tải về");
        }}
      />
    </div>
  );
}

function ChatContainer({ onToggleRightSidebar, showRightSidebar = false }) {
  const {
    selectedUser,
    selectedGroup,
    getMessagesByUserId,
    getGroupMessages,
    messages,
    isMessagesLoading,
    subscribeToMessages,
    unsubscribeFromMessages,
    isTyping,
    groupTypingUsers,
    deleteMessage,
    deleteGroupMessage,
    addReaction,
    removeReaction,
    setReplyingTo,
    setForwardingMessage,
    forwardingMessage,
    pinMessage,
    starMessage,
    scrollToMessage,
  } = useChatStore();
  
  const { authUser } = useAuthStore();
  
  const messageEndRef = useRef(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [reactionPicker, setReactionPicker] = useState(null);
  const [contextMenuMessageId, setContextMenuMessageId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [pinNotification, setPinNotification] = useState(null);

  const isUserChat = !!selectedUser;
  const isGroupChat = !!selectedGroup;

  useEffect(() => {
    if (isUserChat) {
      getMessagesByUserId(selectedUser._id).catch(error => {
        console.error("Error fetching user messages", error);
      });
      subscribeToMessages();
      return () => {
        unsubscribeFromMessages();
      };
    } else if (isGroupChat) {
      getGroupMessages(selectedGroup._id).catch(error => {
        console.error("Error fetching group messages", error);
      });
      subscribeToMessages();
      return () => {
        unsubscribeFromMessages();
      };
    }
  }, [selectedUser, selectedGroup, isUserChat, isGroupChat, getMessagesByUserId, getGroupMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, groupTypingUsers]); // Also scroll when typing indicator appears

  // Listen for pin message notifications
  useEffect(() => {
    const handleMessagePinned = (event) => {
      const { pinnedBy } = event.detail;
      // Always show notification if we're in a chat (selectedUser or selectedGroup exists)
      if (selectedUser || selectedGroup) {
        setPinNotification({ pinnedBy, timestamp: Date.now() });
        // Keep notification visible, don't auto-hide
      }
    };

    window.addEventListener('messagePinned', handleMessagePinned);
    return () => {
      window.removeEventListener('messagePinned', handleMessagePinned);
    };
  }, [selectedUser, selectedGroup]);
  
  // Don't clear notification when switching chats - keep it visible
  // Only clear when explicitly needed (e.g., when unpinning)

  const displayName = isUserChat ? selectedUser?.fullName : selectedGroup?.name;
  const typingUsers = isGroupChat && selectedGroup 
    ? (groupTypingUsers[selectedGroup._id] || []) 
    : [];

  if (!isUserChat && !isGroupChat) {
    return null;
  }

  return (
    <>
      <ChatHeader onToggleRightSidebar={onToggleRightSidebar} />
      <div className="flex-1 px-6 overflow-y-auto py-8">
        {messages.length > 0 && !isMessagesLoading ? (
          <div className={`mx-auto space-y-6 transition-all duration-300 ${showRightSidebar ? 'max-w-3xl' : 'max-w-5xl'}`}>
            {messages.map((msg) => {
              const isMyMessage = msg.senderId?._id === authUser._id || msg.senderId === authUser._id;
              const senderName = msg.senderId?.fullName || "Unknown";
              const senderAvatar = msg.senderId?.profilePic || "/avatar.png";
              
              return (
                <div
                  key={msg._id}
                  data-message-id={msg._id}
                  className={`flex gap-2 ${isMyMessage ? "flex-row-reverse" : "flex-row"} relative mb-4`}
                >
                  {/* Avatar - only show for received messages or group messages */}
                  {(!isMyMessage || isGroupChat) && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                        <img 
                          src={senderAvatar} 
                          alt={senderName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className={`flex flex-col ${isMyMessage ? "items-end" : "items-start"} flex-1 ${showRightSidebar ? 'max-w-[70%]' : 'max-w-[80%]'}`}>
                    {/* Sender name for group chats */}
                    {isGroupChat && !isMyMessage && (
                      <div className="text-xs text-gray-500 mb-1 px-1">
                        {senderName}
                      </div>
                    )}
                    
                    <div
                      className={`chat-bubble relative group rounded-2xl px-4 py-2 ${
                        isMyMessage
                          ? "bg-cyan-600 text-white rounded-br-sm"
                          : "bg-gray-200 text-gray-900 rounded-bl-sm"
                      }`}
                    >
                    {/* Reaction Picker - will be rendered via Portal */}
                    {/* Show deleted message placeholder */}
                    {msg.isDeleted ? (
                      <div className="italic opacity-60 text-sm">
                        Tin nhắn đã bị thu hồi
                      </div>
                    ) : (
                      <>
                    {/* Reply Preview - Hiển thị mờ ở trên */}
                    {msg.replyTo && typeof msg.replyTo === 'object' && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (msg.replyTo._id) {
                            scrollToMessage(msg.replyTo._id);
                          }
                        }}
                        className={`mb-3 pl-3 pr-2 py-2 cursor-pointer hover:opacity-100 transition-opacity border-l-4 rounded-r opacity-60 ${
                          isMyMessage
                            ? 'bg-white bg-opacity-15 border-white'
                            : 'bg-gray-100 bg-opacity-70 border-cyan-600'
                        }`}
                      >
                        <div className="flex flex-col">
                          <div className={`text-xs font-semibold mb-0.5 leading-tight ${
                            isMyMessage ? 'text-white text-opacity-80' : 'text-gray-700'
                          }`}>
                            {msg.replyTo.senderId?.fullName || (typeof msg.replyTo.senderId === 'string' ? msg.replyTo.senderId : "Unknown")}
                          </div>
                          <div className={`text-xs leading-tight truncate ${
                            isMyMessage ? 'text-white text-opacity-70' : 'text-gray-600'
                          }`}>
                            {msg.replyTo.text 
                              ? msg.replyTo.text 
                              : msg.replyTo.image 
                                ? "[Hình ảnh]" 
                                : msg.replyTo.file?.fileType?.startsWith('video/')
                                  ? "[Video]"
                                  : msg.replyTo.file?.fileName 
                                    ? `[File] ${msg.replyTo.file.fileName}`
                                    : "[File]"}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Divider line giữa reply preview và nội dung message */}
                    {msg.replyTo && typeof msg.replyTo === 'object' && (
                      <div className={`h-px mb-2 ${
                        isMyMessage ? 'bg-white bg-opacity-20' : 'bg-gray-300'
                      }`}></div>
                    )}
                    
                    {/* Nội dung message - Hiển thị rõ ở dưới */}
                    {msg.image && (
                      <div className="relative mb-2">
                        <img 
                          src={msg.image} 
                          alt="Shared" 
                          className="rounded-lg h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => {
                            // Open image in modal
                            const modal = document.createElement('div');
                            modal.className = 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4';
                            modal.onclick = (e) => {
                              if (e.target === modal) {
                                document.body.removeChild(modal);
                              }
                            };
                            
                            const img = document.createElement('img');
                            img.src = msg.image;
                            img.className = 'max-w-full max-h-[90vh] object-contain rounded-lg';
                            
                            const closeBtn = document.createElement('button');
                            closeBtn.className = 'absolute top-4 right-4 p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 z-10';
                            closeBtn.innerHTML = '✕';
                            closeBtn.onclick = () => document.body.removeChild(modal);
                            
                            const downloadBtn = document.createElement('button');
                            downloadBtn.className = 'absolute bottom-4 right-4 p-3 bg-cyan-600 text-white rounded-full hover:bg-cyan-700 z-10 flex items-center gap-2';
                            downloadBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Tải về';
                            downloadBtn.onclick = (e) => {
                              e.stopPropagation();
                              const link = document.createElement('a');
                              link.href = msg.image;
                              link.download = `image-${Date.now()}.jpg`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            };
                            
                            modal.appendChild(img);
                            modal.appendChild(closeBtn);
                            modal.appendChild(downloadBtn);
                            document.body.appendChild(modal);
                          }}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const link = document.createElement('a');
                            link.href = msg.image;
                            link.download = `image-${Date.now()}.jpg`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className={`absolute bottom-2 right-2 p-2 rounded-full transition-colors backdrop-blur-sm ${
                            isMyMessage 
                              ? 'bg-black bg-opacity-50 text-white hover:bg-opacity-70' 
                              : 'bg-white bg-opacity-80 text-gray-900 hover:bg-opacity-100'
                          }`}
                          title="Tải ảnh về"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                          </svg>
                        </button>
                      </div>
                    )}
                    {msg.file && (
                      <div className="mb-2">
                        <FilePreview 
                          file={{
                            fileUrl: msg.file.fileUrl || msg.file, // Support both fileUrl and base64 file
                            fileName: msg.file.fileName || 'Unknown file',
                            fileType: msg.file.fileType || 'application/octet-stream',
                            fileSize: msg.file.fileSize || 0,
                          }}
                          isInMessage={true}
                          isMyMessage={isMyMessage}
                        />
                      </div>
                    )}
                    {/* Show upload progress for optimistic messages */}
                    {msg.isOptimistic && (
                      <UploadProgressInMessage 
                        messageId={msg._id}
                        fileName={msg.file?.fileName}
                        fileSize={msg.file?.fileSize}
                      />
                    )}
                    {msg.text && <p className={msg.image || msg.file ? "mt-2" : ""}>{msg.text}</p>}
                    </>
                    )}
                    
                    {/* Timestamp and Action buttons row */}
                    <div className="flex items-center justify-between mt-1">
                      <p className={`text-xs opacity-75 ${isMyMessage ? "text-white" : "text-gray-600"}`}>
                        {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      
                      {/* Action buttons (Reply, Forward, More) and Reaction button - shown on hover */}
                      {!msg.isDeleted && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReplyingTo(msg);
                            }}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                              isMyMessage
                                ? 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            title="Trả lời"
                          >
                            <ReplyIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setForwardingMessage(msg);
                            }}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                              isMyMessage
                                ? 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            title="Chuyển tiếp"
                          >
                            <ForwardIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onMouseEnter={(e) => {
                              e.stopPropagation();
                              setContextMenuMessageId(msg._id);
                              setContextMenu({
                                message: msg,
                                position: { x: 0, y: 0 },
                              });
                              // Reset menu position when hovering new message
                              setMenuPosition({ x: 0, y: 0 });
                            }}
                            onMouseLeave={(e) => {
                              // Close menu when mouse leaves, but allow moving to menu
                              const relatedTarget = e.relatedTarget;
                              if (!relatedTarget || !relatedTarget.closest('[data-context-menu]')) {
                                setTimeout(() => {
                                  const menuElement = document.querySelector('[data-context-menu]');
                                  if (!menuElement || !menuElement.matches(':hover')) {
                                    setContextMenu(null);
                                    setContextMenuMessageId(null);
                                    setMenuPosition({ x: 0, y: 0 });
                                  }
                                }, 200);
                              }
                            }}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                              isMyMessage
                                ? 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            title="Tùy chọn khác"
                          >
                            <MoreVerticalIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            // Calculate position to avoid left sidebar (320px width)
                            const chatBubble = e.currentTarget.closest('.chat-bubble');
                            if (chatBubble) {
                              const bubbleRect = chatBubble.getBoundingClientRect();
                              const pickerWidth = 280; // Approximate width of picker with 6 emojis (more accurate)
                              const leftSidebarWidth = 320; // w-80 = 320px
                              const centerX = bubbleRect.left + (bubbleRect.width / 2);
                              const pickerLeftEdge = centerX - (pickerWidth / 2);
                              
                              // If picker would be hidden behind left sidebar, shift it right
                              let adjustedX = 0;
                              if (pickerLeftEdge < leftSidebarWidth) {
                                // Shift right so picker doesn't overlap with sidebar
                                // Calculate exact amount needed to clear the sidebar
                                adjustedX = leftSidebarWidth - pickerLeftEdge + 40; // 40px padding to ensure no overlap
                              }
                              
                              setReactionPicker({
                                messageId: msg._id,
                                position: { x: adjustedX, y: 0 },
                              });
                            }
                          }}
                          onMouseLeave={(e) => {
                            // Close picker when mouse leaves the icon
                            // Use a longer delay to allow moving to picker
                            setTimeout(() => {
                              // Check if mouse is still over icon or picker
                              const pickerElement = document.querySelector('[data-reaction-picker]');
                              const isOverPicker = pickerElement && (
                                pickerElement.matches(':hover') || 
                                pickerElement.contains(document.elementFromPoint(e.clientX, e.clientY))
                              );
                              
                              if (!isOverPicker) {
                                setReactionPicker(null);
                              }
                            }, 300); // Increased delay to 300ms
                          }}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                              isMyMessage
                                ? 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            title="Thả icon"
                          >
                            <SmileIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Reactions - shown below timestamp */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                          const hasReacted = Array.isArray(userIds) && userIds.some(id => 
                            (typeof id === 'string' ? id : id._id || id) === authUser._id
                          );
                          return (
                            <button
                              key={emoji}
                              onClick={() => {
                                if (hasReacted) {
                                  removeReaction(msg._id, emoji, isGroupChat);
                                } else {
                                  addReaction(msg._id, emoji, isGroupChat);
                                }
                              }}
                              className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 ${
                                hasReacted
                                  ? isMyMessage
                                    ? 'bg-white bg-opacity-30 text-white'
                                    : 'bg-cyan-100 text-cyan-700'
                                  : isMyMessage
                                    ? 'bg-white bg-opacity-20 text-white'
                                    : 'bg-gray-100 text-gray-700'
                              } hover:opacity-80 transition-opacity`}
                            >
                              <span>{emoji}</span>
                              <span>{Array.isArray(userIds) ? userIds.length : 0}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Typing Indicator for one-on-one */}
            {isUserChat && isTyping && (
              <div className="chat chat-start">
                <div className="chat-bubble bg-gray-200 text-gray-900">
                  <div className="flex gap-1 items-center px-2 py-1">
                    <span className="typing-dot" style={{ animationDelay: '0ms' }}></span>
                    <span className="typing-dot" style={{ animationDelay: '200ms' }}></span>
                    <span className="typing-dot" style={{ animationDelay: '400ms' }}></span>
                  </div>
                </div>
              </div>
            )}

            {/* Typing Indicator for groups */}
            {isGroupChat && typingUsers.length > 0 && (
              <div className="chat chat-start">
                <div className="chat-bubble bg-gray-200 text-gray-900">
                  <div className="flex gap-1 items-center px-2 py-1">
                    <span className="typing-dot" style={{ animationDelay: '0ms' }}></span>
                    <span className="typing-dot" style={{ animationDelay: '200ms' }}></span>
                    <span className="typing-dot" style={{ animationDelay: '400ms' }}></span>
                  </div>
                </div>
              </div>
            )}

            {/* Pin Message Notification */}
            {/* Pin Message Notification - Hiển thị giữa khung chat, luôn hiển thị */}
            {pinNotification && (
              <div className="flex justify-center my-4">
                <div className="bg-gray-100 text-gray-700 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <PinIcon className="w-3.5 h-3.5 text-gray-500" />
                  <span>{pinNotification.pinnedBy} đã ghim 1 tin nhắn</span>
                </div>
              </div>
            )}
            
            {/* 👇 scroll target */}
            <div ref={messageEndRef} />
          </div>
        ) : isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : (
          <div className="max-w-3xl mx-auto">
            <NoChatHistoryPlaceholder name={displayName} />
            {/* Typing Indicator - show even when no messages */}
            {(isUserChat && isTyping) || (isGroupChat && typingUsers.length > 0) ? (
              <div className="mt-6 chat chat-start">
                <div className="chat-bubble bg-gray-200 text-gray-900">
                  <div className="flex gap-1 items-center px-2 py-1">
                    <span className="typing-dot" style={{ animationDelay: '0ms' }}></span>
                    <span className="typing-dot" style={{ animationDelay: '200ms' }}></span>
                    <span className="typing-dot" style={{ animationDelay: '400ms' }}></span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <MessageInput />
      
      {/* Context Menu - rendered via Portal to appear above everything */}
      {contextMenu && (() => {
        // Always render as overlay on the message (both right-click and icon click)
        const messageId = contextMenuMessageId || contextMenu.message._id;
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) return null;
        
        const bubbleElement = messageElement.querySelector('.chat-bubble');
        if (!bubbleElement) return null;
        
        const bubbleRect = bubbleElement.getBoundingClientRect();
        const menuWidth = 200; // Approximate width of context menu
        const leftSidebarWidth = 320; // w-80 = 320px
        const centerX = bubbleRect.left + (bubbleRect.width / 2);
        const menuLeftEdge = centerX - (menuWidth / 2);
        
        let adjustedX = centerX;
        if (menuLeftEdge < leftSidebarWidth) {
          // Shift right so menu doesn't overlap with sidebar
          adjustedX = leftSidebarWidth + (menuWidth / 2) + 20; // 20px padding
        }
        
        return createPortal(
          <div 
            className="fixed"
            style={{ 
              zIndex: 99999,
              left: `${adjustedX}px`,
              top: `${bubbleRect.top + (bubbleRect.height / 2)}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <MessageContextMenu
              message={contextMenu.message}
              isMyMessage={contextMenu.message.senderId?._id === authUser._id || contextMenu.message.senderId === authUser._id}
              position={{ x: 0, y: 0 }}
              onClose={() => {
                setContextMenu(null);
                setContextMenuMessageId(null);
              }}
              onRecall={() => {
                if (isGroupChat) {
                  deleteGroupMessage(contextMenu.message._id);
                } else {
                  deleteMessage(contextMenu.message._id);
                }
                setContextMenu(null);
                setContextMenuMessageId(null);
              }}
              onDelete={() => {
                // "Xóa chỉ ở phía tôi" - delete only for current user, not for receiver/group
                if (isGroupChat) {
                  deleteGroupMessage(contextMenu.message._id, true);
                } else {
                  deleteMessage(contextMenu.message._id, true);
                }
                setContextMenu(null);
                setContextMenuMessageId(null);
              }}
              onReply={() => {
                setReplyingTo(contextMenu.message);
                setContextMenu(null);
                setContextMenuMessageId(null);
              }}
              onForward={() => {
                setForwardingMessage(contextMenu.message);
                setContextMenu(null);
                setContextMenuMessageId(null);
              }}
              onPin={() => {
                if (pinMessage) {
                  pinMessage(contextMenu.message._id, isGroupChat);
                }
              }}
              onStar={() => {
                if (starMessage) {
                  starMessage(contextMenu.message._id, isGroupChat);
                }
              }}
              onCopyImage={async (imageUrl) => {
                try {
                  const response = await fetch(imageUrl);
                  const blob = await response.blob();
                  await navigator.clipboard.write([
                    new ClipboardItem({ [blob.type]: blob })
                  ]);
                  toast.success("Đã copy hình ảnh");
                } catch (error) {
                  toast.error("Không thể copy hình ảnh");
                }
              }}
              onDownload={(url, fileName) => {
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success("Đã tải về");
              }}
              isOverlay={true}
            />
          </div>,
          document.body
        );
      })()}
      
      {/* Reaction Picker - rendered via Portal to appear above everything including left sidebar */}
      {reactionPicker && (() => {
        const messageElement = document.querySelector(`[data-message-id="${reactionPicker.messageId}"]`);
        if (!messageElement) return null;
        
        const bubbleElement = messageElement.querySelector('.chat-bubble');
        if (!bubbleElement) return null;
        
        const bubbleRect = bubbleElement.getBoundingClientRect();
        const pickerWidth = 280;
        const leftSidebarWidth = 320;
        const centerX = bubbleRect.left + (bubbleRect.width / 2);
        const pickerLeftEdge = centerX - (pickerWidth / 2);
        
        let adjustedX = centerX;
        if (pickerLeftEdge < leftSidebarWidth) {
          adjustedX = leftSidebarWidth + (pickerWidth / 2) + 20;
        }
        
        return createPortal(
          <div 
            data-reaction-picker
            className="fixed"
            style={{ 
              zIndex: 99999,
              left: `${adjustedX}px`,
              top: `${bubbleRect.bottom + 8}px`,
              transform: 'translateX(-50%)',
            }}
            onMouseEnter={() => {
              // Keep picker open when hovering over it
            }}
            onMouseLeave={(e) => {
              // Close when mouse leaves picker area, with delay to allow moving back
              setTimeout(() => {
                const pickerElement = document.querySelector('[data-reaction-picker]');
                const isOverPicker = pickerElement && (
                  pickerElement.matches(':hover') || 
                  pickerElement.contains(document.elementFromPoint(e.clientX, e.clientY))
                );
                
                if (!isOverPicker) {
                  setReactionPicker(null);
                }
              }, 200);
            }}
          >
            <ReactionPicker
              messageId={reactionPicker.messageId}
              position={{ x: 0, y: 0 }}
              onClose={() => setReactionPicker(null)}
              onReactionSelect={(emoji) => {
                addReaction(reactionPicker.messageId, emoji, isGroupChat);
              }}
              isOverlay={false}
            />
          </div>,
          document.body
        );
      })()}

      {/* Forward Modal */}
      <ForwardModal
        isOpen={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        message={forwardingMessage}
      />
    </>
  );
}

export default ChatContainer;
