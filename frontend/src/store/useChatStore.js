import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  groups: [],
  messages: [],
  pinnedMessages: [], // Array of pinned messages for current chat
  replyingTo: null, // Message being replied to
  activeTab: "chats",
  selectedUser: null,
  selectedGroup: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isGroupsLoading: false,
  isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,
  isTyping: false, // Track if the other user is typing
  groupTypingUsers: {}, // Track users typing in groups {groupId: [userId]}
  // Upload progress tracking
  uploadProgress: 0, // 0-100
  isUploading: false,
  uploadError: null,
  pendingUpload: null, // Store message data for retry
  // Upload progress tracking
  uploadProgress: 0, // 0-100
  isUploading: false,
  uploadError: null,
  pendingUpload: null, // Store message data for retry

  toggleSound: () => {
    localStorage.setItem("isSoundEnabled", !get().isSoundEnabled);
    set({ isSoundEnabled: !get().isSoundEnabled });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedUser: async (selectedUser) => {
    set({ selectedUser, selectedGroup: null, messages: [], pinnedMessages: [], replyingTo: null });
    // Mark conversation as read
    if (selectedUser?._id) {
      try {
        await axiosInstance.patch(`/messages/read/${selectedUser._id}`);
        // Update unread count in chats list
        const { chats } = get();
        const updatedChats = chats.map(chat => 
          chat._id === selectedUser._id ? { ...chat, unreadCount: 0 } : chat
        );
        set({ chats: updatedChats });
      } catch (error) {
        console.error("Error marking conversation as read:", error);
      }
    }
  },
  setSelectedGroup: async (selectedGroup) => {
    set({ selectedGroup, selectedUser: null, messages: [], pinnedMessages: [], replyingTo: null });
    // Mark group conversation as read
    if (selectedGroup?._id) {
      try {
        await axiosInstance.patch(`/groups/read/${selectedGroup._id}`);
        // Update unread count in groups list
        const { groups } = get();
        const updatedGroups = groups.map(group => 
          group._id === selectedGroup._id ? { ...group, unreadCount: 0 } : group
        );
        set({ groups: updatedGroups });
      } catch (error) {
        console.error("Error marking group conversation as read:", error);
      }
    }
  },
  setReplyingTo: (message) => set({ replyingTo: message }),
  clearReplyingTo: () => set({ replyingTo: null }),

  getAllContacts: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/contacts");
      set({ allContacts: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },
  getMyChatPartners: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/chats");
      set({ chats: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMyGroups: async () => {
    set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get("/groups/my-groups");
      set({ groups: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tải danh sách nhóm");
    } finally {
      set({ isGroupsLoading: false });
    }
  },

  createGroup: async (groupData) => {
    try {
      const res = await axiosInstance.post("/groups/create", groupData, {
        timeout: 30000,
      });
      const { groups } = get();
      set({ groups: [res.data, ...groups] });
      toast.success("Tạo nhóm thành công!");
      return res.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Không thể tạo nhóm";
      toast.error(errorMessage);
      throw error;
    }
  },

  getGroupMessages: async (groupId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/groups/${groupId}/messages`);
      const messages = res.data;
      // Filter pinned messages and keep only latest 3
      const pinned = messages.filter(msg => msg.isPinned)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, 3);
      set({ messages, pinnedMessages: pinned });
    } catch (error) {
      toast.error(error.response?.data?.message || "Đã xảy ra lỗi");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendGroupMessage: async (groupId, messageData, isRetry = false, existingTempId = null) => {
    const { selectedGroup, messages } = get();
    const { authUser } = useAuthStore.getState();

    if (!selectedGroup || selectedGroup._id !== groupId) {
      toast.error("Vui lòng chọn nhóm để gửi tin nhắn");
      return;
    }

    const tempId = isRetry && existingTempId ? existingTempId : `temp-${Date.now()}`;

    // Nếu là retry, không tạo optimistic message mới, chỉ update trạng thái
    if (!isRetry) {
      const optimisticMessage = {
        _id: tempId,
        senderId: authUser._id,
        groupId: groupId,
        text: messageData.text || "",
        image: messageData.image || "",
        file: messageData.fileUrl ? {
          fileUrl: messageData.fileUrl,
          fileName: messageData.fileName,
          fileType: messageData.fileType,
          fileSize: messageData.fileSize,
        } : messageData.file ? {
          fileUrl: messageData.file, // Base64 fallback
          fileName: messageData.fileName,
          fileType: messageData.fileType,
          fileSize: messageData.fileSize,
        } : null,
        createdAt: new Date().toISOString(),
        isOptimistic: true,
      };
      

      set({ messages: [...messages, optimisticMessage] });
    } else {
      // Khi retry, chỉ update trạng thái upload của message cũ
      set({ 
        isUploading: true,
        uploadProgress: 0,
        uploadError: null
      });
    }

    try {
      // Check if file is already uploaded (has fileUrl) or needs upload (has base64 file)
      const hasFile = messageData.file || messageData.fileUrl;
      const isFileAlreadyUploaded = !!messageData.fileUrl; // File was uploaded directly to Cloudinary
      const fileSize = hasFile ? messageData.fileSize : 0;
      
      // Declare progressInterval in outer scope
      let progressInterval = null;
      
      // Only track progress if file needs to be uploaded (base64)
      if (hasFile && !isFileAlreadyUploaded) {
        const estimatedTimeout = Math.min(1200000, Math.max(60000, (fileSize / 1024 / 1024) * 10000)); // 10s per MB, min 60s, max 20min
        
        // Set upload state
        set({ 
          isUploading: true, 
          uploadProgress: 0, 
          uploadError: null,
          pendingUpload: { messageData, tempId, type: 'group', groupId }
        });

        // Simulate progress for large files
        if (fileSize > 1024 * 1024) { // Files larger than 1MB
          let simulatedProgress = 0;
          progressInterval = setInterval(() => {
            simulatedProgress += 2;
            if (simulatedProgress < 90) {
              set({ uploadProgress: simulatedProgress });
            } else {
              clearInterval(progressInterval);
            }
          }, 500); // Update every 500ms
        }
      } else {
        // File already uploaded or no file - no progress tracking needed
        set({ 
          isUploading: false, 
          uploadProgress: 0, 
          uploadError: null,
          pendingUpload: { messageData, tempId, type: 'group', groupId }
        });
      }
      
      const estimatedTimeout = hasFile && !isFileAlreadyUploaded
        ? Math.min(1200000, Math.max(60000, (fileSize / 1024 / 1024) * 10000))
        : 30000; // 30s for text/images or already uploaded files

      const { replyingTo } = get();
      const messagePayload = {
        ...messageData,
        replyTo: replyingTo?._id || undefined,
      };
      
      const res = await axiosInstance.post(`/groups/${groupId}/send`, messagePayload, {
        timeout: estimatedTimeout,
        onUploadProgress: hasFile && !isFileAlreadyUploaded ? (progressEvent) => {
          if (progressEvent.total && progressEvent.loaded) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            const currentProgress = get().uploadProgress;
            if (percentCompleted > currentProgress) {
              set({ uploadProgress: percentCompleted });
            }
            // Clear interval if real progress is working
            if (progressInterval && percentCompleted > 10) {
              clearInterval(progressInterval);
              progressInterval = null;
            }
          }
        } : undefined,
      });

      // Clear progress interval on success
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      if (hasFile && !isFileAlreadyUploaded) {
        set({ uploadProgress: 100 });
      }
      
      // Clear replyingTo after sending
      if (replyingTo) {
        set({ replyingTo: null });
      }
      
      // Success
      const currentMessages = get().messages;
      const filteredMessages = currentMessages.filter(msg => msg._id !== tempId);
      set({ 
        messages: [...filteredMessages, res.data],
        isUploading: false,
        uploadProgress: 100,
        uploadError: null,
        pendingUpload: null
      });
    } catch (error) {
      // Clear progress interval on error
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      const isNetworkError = !error.response && (
        error.message === 'Network Error' || 
        error.code === 'ERR_NETWORK' ||
        error.code === 'ERR_INTERNET_DISCONNECTED'
      );
      const isTimeoutError = error.code === 'ECONNABORTED' || 
                            error.message?.includes('timeout') ||
                            error.response?.status === 504;
      const isRetryableError = error.response?.data?.retryable === true ||
                              error.response?.status === 503 ||
                              error.response?.status === 504;
      
      if (isNetworkError || isTimeoutError || isRetryableError) {
        // Network/timeout error - keep optimistic message and show retry option
        const errorMessage = error.response?.data?.message || 
                            'Mất kết nối. Vui lòng kiểm tra internet và thử lại.';
        set({ 
          isUploading: false,
          uploadError: errorMessage,
          pendingUpload: { messageData, tempId, type: 'group', groupId }
        });
        toast.error("Mất kết nối. Nhấn 'Gửi lại' để tiếp tục.", { duration: 5000 });
      } else {
        // Other errors - remove optimistic message
        const currentMessages = get().messages;
        const filteredMessages = currentMessages.filter(msg => msg._id !== tempId);
        set({ 
          messages: filteredMessages,
          isUploading: false,
          uploadProgress: 0,
          uploadError: null,
          pendingUpload: null
        });
        
        const errorMessage = error.response?.data?.message || 
                            error.response?.data?.error || 
                            error.message || 
                            "Failed to send message. Please try again.";
        toast.error(errorMessage);
      }
      console.error("Send group message error:", error);
    }
  },

  retryUpload: async () => {
    const { pendingUpload } = get();
    if (!pendingUpload) return;
    
    set({ uploadError: null, uploadProgress: 0 });
    
    if (pendingUpload.type === 'message') {
      await get().sendMessage(pendingUpload.messageData, true, pendingUpload.tempId);
    } else if (pendingUpload.type === 'group') {
      await get().sendGroupMessage(pendingUpload.groupId, pendingUpload.messageData, true, pendingUpload.tempId);
    }
  },

  addMembersToGroup: async (groupId, memberIds) => {
    try {
      await axiosInstance.post(`/groups/${groupId}/add-members`, {
        memberIds,
      });
      
      // Refresh groups list
      const { groups } = get();
      const updatedGroups = await axiosInstance.get("/groups/my-groups");
      set({ groups: updatedGroups.data });
      
      // Update selected group if it's the same
      const { selectedGroup } = get();
      if (selectedGroup && selectedGroup._id === groupId) {
        const updatedGroup = updatedGroups.data.find(g => g._id === groupId);
        if (updatedGroup) {
          set({ selectedGroup: updatedGroup });
        }
      }
      
      return true;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to add members";
      toast.error(errorMessage);
      throw error;
    }
  },

  removeMemberFromGroup: async (groupId, memberId) => {
    try {
      await axiosInstance.delete(`/groups/${groupId}/members/${memberId}`);
      
      // Refresh groups list
      const { groups } = get();
      const updatedGroups = await axiosInstance.get("/groups/my-groups");
      set({ groups: updatedGroups.data });
      
      // Update selected group if it's the same
      const { selectedGroup } = get();
      if (selectedGroup && selectedGroup._id === groupId) {
        const updatedGroup = updatedGroups.data.find(g => g._id === groupId);
        if (updatedGroup) {
          set({ selectedGroup: updatedGroup });
        }
      }
      
      toast.success("Đã xóa thành viên thành công");
      return true;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to remove member";
      toast.error(errorMessage);
      throw error;
    }
  },

  toggleGroupPrivacy: async (groupId) => {
    try {
      const res = await axiosInstance.patch(`/groups/${groupId}/toggle-privacy`);
      
      console.log("Toggle privacy response:", res.data);
      
      if (!res.data) {
        throw new Error("No data received from server");
      }
      
      // Refresh groups list
      const { groups } = get();
      const updatedGroups = await axiosInstance.get("/groups/my-groups");
      set({ groups: updatedGroups.data });
      
      // Update selected group if it's the same
      const { selectedGroup } = get();
      if (selectedGroup && selectedGroup._id === groupId) {
        set({ selectedGroup: res.data });
      }
      
      toast.success(`Nhóm hiện là ${res.data.isPublic ? "công khai" : "riêng tư"}`);
      return res.data;
    } catch (error) {
      console.error("Toggle privacy error:", error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          "Failed to change group privacy";
      toast.error(errorMessage);
      throw error;
    }
  },

  deleteMessage: async (messageId, deleteOnlyForSender = false) => {
    // Check if this is a temporary message (optimistic update)
    if (messageId.startsWith('temp-')) {
      // Just remove from local state, don't call API
      const { messages } = get();
      set({ messages: messages.filter(msg => msg._id !== messageId) });
      toast.success(deleteOnlyForSender ? "Tin nhắn đã được xóa" : "Tin nhắn đã được thu hồi");
      return;
    }

    try {
      const url = deleteOnlyForSender 
        ? `/messages/${messageId}?deleteOnlyForSender=true`
        : `/messages/${messageId}`;
      await axiosInstance.delete(url);
      
      // Update messages in state
      const { messages } = get();
      const message = messages.find(msg => msg._id === messageId);
      
      if (message) {
        // If message had file/image, it was completely deleted
        // If text only, it was marked as deleted
        const hasFileOrImage = (message.file && message.file.fileUrl) || message.image;
        
        if (hasFileOrImage) {
          // Remove from messages
          set({ messages: messages.filter(msg => msg._id !== messageId) });
        } else {
          // Mark as deleted
          set({
            messages: messages.map(msg =>
              msg._id === messageId
                ? { ...msg, isDeleted: true, deletedAt: new Date() }
                : msg
            ),
          });
        }
      }
      
      toast.success("Tin nhắn đã được thu hồi");
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to delete message";
      toast.error(errorMessage);
      throw error;
    }
  },

  deleteGroupMessage: async (messageId, deleteOnlyForSender = false) => {
    // Check if this is a temporary message (optimistic update)
    if (messageId.startsWith('temp-')) {
      // Just remove from local state, don't call API
      const { messages } = get();
      set({ messages: messages.filter(msg => msg._id !== messageId) });
      toast.success(deleteOnlyForSender ? "Tin nhắn đã được xóa" : "Tin nhắn đã được thu hồi");
      return;
    }

    try {
      const url = deleteOnlyForSender 
        ? `/groups/messages/${messageId}?deleteOnlyForSender=true`
        : `/groups/messages/${messageId}`;
      await axiosInstance.delete(url);
      
      // Update messages in state
      const { messages } = get();
      const message = messages.find(msg => msg._id === messageId);
      
      if (message) {
        if (deleteOnlyForSender) {
          // Just remove from local state (message is still visible to other group members)
          set({ messages: messages.filter(msg => msg._id !== messageId) });
          toast.success("Tin nhắn đã được xóa");
        } else {
          // If message had file/image, it was completely deleted
          // If text only, it was marked as deleted
          const hasFileOrImage = (message.file && message.file.fileUrl) || message.image;
          
          if (hasFileOrImage) {
            // Remove from messages
            set({ messages: messages.filter(msg => msg._id !== messageId) });
          } else {
            // Mark as deleted
            set({
              messages: messages.map(msg =>
                msg._id === messageId
                  ? { ...msg, isDeleted: true, deletedAt: new Date() }
                  : msg
              ),
            });
          }
          toast.success("Tin nhắn đã được thu hồi");
        }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to delete message";
      toast.error(errorMessage);
      throw error;
    }
  },

  addReaction: async (messageId, emoji, isGroup = false) => {
    try {
      const endpoint = isGroup 
        ? `/groups/messages/${messageId}/reactions`
        : `/messages/${messageId}/reactions`;
      
      await axiosInstance.post(endpoint, { emoji });
      
      // Update message in state
      const { messages } = get();
      const { authUser } = useAuthStore.getState();
      
      set({
        messages: messages.map(msg => {
          if (msg._id === messageId) {
            const reactions = msg.reactions || {};
            const userIds = reactions[emoji] || [];
            if (!userIds.includes(authUser._id)) {
              reactions[emoji] = [...userIds, authUser._id];
            }
            return { ...msg, reactions };
          }
          return msg;
        }),
      });
    } catch (error) {
      console.error("Add reaction error:", error);
      toast.error(error.response?.data?.message || "Không thể thêm phản ứng");
    }
  },

  removeReaction: async (messageId, emoji, isGroup = false) => {
    try {
      const endpoint = isGroup 
        ? `/groups/messages/${messageId}/reactions`
        : `/messages/${messageId}/reactions`;
      
      const res = await axiosInstance.delete(endpoint, { data: { emoji } });
      
      // Update message in state with server response
      const { messages } = get();
      set({
        messages: messages.map(msg => {
          if (msg._id === messageId) {
            return { ...msg, reactions: res.data.reactions || {} };
          }
          return msg;
        }),
      });
    } catch (error) {
      console.error("Remove reaction error:", error);
      toast.error(error.response?.data?.message || "Không thể xóa phản ứng");
    }
  },

  getMessagesByUserId: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      const messages = res.data;
      // Filter pinned messages and keep only latest 3
      const pinned = messages.filter(msg => msg.isPinned)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, 3);
      set({ messages, pinnedMessages: pinned });
    } catch (error) {
      toast.error(error.response?.data?.message || "Đã xảy ra lỗi");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData, isRetry = false, existingTempId = null) => {
    const { selectedUser, messages } = get();
    const { authUser } = useAuthStore.getState();

    if (!selectedUser) {
      toast.error("Vui lòng chọn người dùng để gửi tin nhắn");
      return;
    }

    const tempId = isRetry && existingTempId ? existingTempId : `temp-${Date.now()}`;

    // Nếu là retry, không tạo optimistic message mới, chỉ update trạng thái
    if (!isRetry) {
      const { replyingTo } = get();
      const optimisticMessage = {
        _id: tempId,
        senderId: authUser._id,
        receiverId: selectedUser._id,
        text: messageData.text || "",
        image: messageData.image || "",
        file: messageData.fileUrl ? {
          fileUrl: messageData.fileUrl,
          fileName: messageData.fileName,
          fileType: messageData.fileType,
          fileSize: messageData.fileSize,
        } : messageData.file ? {
          fileUrl: messageData.file, // Base64 fallback
          fileName: messageData.fileName,
          fileType: messageData.fileType,
          fileSize: messageData.fileSize,
        } : null,
        replyTo: replyingTo || undefined, // Include replyTo in optimistic message
        createdAt: new Date().toISOString(),
        isOptimistic: true, // flag to identify optimistic messages (optional)
      };
      
      // Immediately update the UI by adding the message
      set({ messages: [...messages, optimisticMessage] });
    } else {
      // Khi retry, chỉ update trạng thái upload của message cũ
      set({ 
        isUploading: true,
        uploadProgress: 0,
        uploadError: null
      });
    }

    try {
      // Check if file is already uploaded (has fileUrl) or needs upload (has base64 file)
      const hasFile = messageData.file || messageData.fileUrl;
      const isFileAlreadyUploaded = !!messageData.fileUrl; // File was uploaded directly to Cloudinary
      const fileSize = hasFile ? messageData.fileSize : 0;
      
      // Only track progress if file needs to be uploaded (base64)
      let progressInterval = null;
      if (hasFile && !isFileAlreadyUploaded) {
        const estimatedTimeout = Math.min(1200000, Math.max(60000, (fileSize / 1024 / 1024) * 10000)); // 10s per MB, min 60s, max 20min
        
        // Set upload state
        set({ 
          isUploading: true, 
          uploadProgress: 0, 
          uploadError: null,
          pendingUpload: { messageData, tempId, type: 'message', userId: selectedUser._id }
        });

        // Simulate progress for large files (axios onUploadProgress doesn't work well with base64)
        if (fileSize > 1024 * 1024) { // Files larger than 1MB
          let simulatedProgress = 0;
          progressInterval = setInterval(() => {
            simulatedProgress += 2;
            if (simulatedProgress < 90) {
              set({ uploadProgress: simulatedProgress });
            } else {
              clearInterval(progressInterval);
            }
          }, 500); // Update every 500ms
        }
      } else {
        // File already uploaded or no file - no progress tracking needed
        set({ 
          isUploading: false, 
          uploadProgress: 0, 
          uploadError: null,
          pendingUpload: { messageData, tempId, type: 'message', userId: selectedUser._id }
        });
      }
      
      const estimatedTimeout = hasFile && !isFileAlreadyUploaded
        ? Math.min(1200000, Math.max(60000, (fileSize / 1024 / 1024) * 10000))
        : 30000; // 30s for text/images or already uploaded files

      const { replyingTo } = get();
      const messagePayload = {
        ...messageData,
        replyTo: replyingTo?._id || undefined,
      };
      
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messagePayload, {
        timeout: estimatedTimeout,
        onUploadProgress: hasFile && !isFileAlreadyUploaded ? (progressEvent) => {
          if (progressEvent.total && progressEvent.loaded) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            const currentProgress = get().uploadProgress;
            if (percentCompleted > currentProgress) {
              set({ uploadProgress: percentCompleted });
            }
            // Clear interval if real progress is working
            if (progressInterval && percentCompleted > 10) {
              clearInterval(progressInterval);
              progressInterval = null;
            }
          }
        } : undefined,
      });

      // Clear progress interval on success
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      if (hasFile && !isFileAlreadyUploaded) {
        set({ uploadProgress: 100 });
      }
      
      // Clear replyingTo after sending
      if (replyingTo) {
        set({ replyingTo: null });
      }
      
      // Success - remove optimistic message and add real message
      const currentMessages = get().messages;
      const filteredMessages = currentMessages.filter(msg => msg._id !== tempId);
      set({ 
        messages: [...filteredMessages, res.data],
        isUploading: false,
        uploadProgress: 100,
        uploadError: null,
        pendingUpload: null
      });
    } catch (error) {
      // Clear progress interval on error
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      const isNetworkError = !error.response && (
        error.message === 'Network Error' || 
        error.code === 'ERR_NETWORK' ||
        error.code === 'ERR_INTERNET_DISCONNECTED'
      );
      const isTimeoutError = error.code === 'ECONNABORTED' || 
                            error.message?.includes('timeout') ||
                            error.response?.status === 504;
      const isRetryableError = error.response?.data?.retryable === true ||
                              error.response?.status === 503 ||
                              error.response?.status === 504;
      
      if (isNetworkError || isTimeoutError || isRetryableError) {
        // Network/timeout error - keep optimistic message and show retry option
        const errorMessage = error.response?.data?.message || 
                            'Mất kết nối. Vui lòng kiểm tra internet và thử lại.';
        set({ 
          isUploading: false,
          uploadError: errorMessage,
          pendingUpload: { messageData, tempId, type: 'message', userId: selectedUser._id }
        });
        toast.error("Mất kết nối. Nhấn 'Gửi lại' để tiếp tục.", { duration: 5000 });
      } else {
        // Other errors - remove optimistic message
        const currentMessages = get().messages;
        const filteredMessages = currentMessages.filter(msg => msg._id !== tempId);
        set({ 
          messages: filteredMessages,
          isUploading: false,
          uploadProgress: 0,
          uploadError: null,
          pendingUpload: null
        });
        
        const errorMessage = error.response?.data?.message || 
                            error.response?.data?.error || 
                            error.message || 
                            "Failed to send message. Please try again.";
        toast.error(errorMessage);
      }
      console.error("Send message error:", error);
    }
  },

  subscribeToMessages: () => {
    const { selectedUser, selectedGroup, isSoundEnabled } = get();
    if (!selectedUser && !selectedGroup) return;

    const socket = useAuthStore.getState().socket;

    // One-on-one messages
    socket.on("newMessage", (newMessage) => {
      const { selectedUser, chats, authUser } = get();
      const { authUser: authUserFromStore } = useAuthStore.getState();
      const currentUserId = authUserFromStore?._id || authUser?._id;
      const senderId = newMessage.senderId?._id || newMessage.senderId;
      
      // Only process if message is for current user (not sent by current user)
      if (senderId?.toString() === currentUserId?.toString()) {
        return; // Message sent by current user, no need to update unread
      }
      
      if (selectedUser && (senderId === selectedUser._id || senderId?.toString() === selectedUser._id?.toString())) {
        // Message in current chat - add to messages
        const currentMessages = get().messages;
        set({ messages: [...currentMessages, newMessage] });

        if (isSoundEnabled) {
          const notificationSound = new Audio("/sounds/notification.mp3");
          notificationSound.currentTime = 0;
          notificationSound.play().catch((e) => console.log("Audio play failed:", e));
        }
      } else {
        // Update unread count for the sender if not in current chat
        if (senderId) {
          const updatedChats = chats.map(chat => {
            if (chat._id?.toString() === senderId?.toString()) {
              return { 
                ...chat, 
                unreadCount: (chat.unreadCount || 0) + 1, 
                lastMessage: {
                  text: newMessage.text,
                  image: newMessage.image,
                  file: newMessage.file,
                  createdAt: newMessage.createdAt,
                  senderId: newMessage.senderId
                }
              };
            }
            return chat;
          });
          set({ chats: updatedChats });
        }
      }
    });

    // Group messages
    socket.on("newGroupMessage", (newMessage) => {
      const { selectedGroup, groups, authUser } = get();
      const { authUser: authUserFromStore } = useAuthStore.getState();
      const currentUserId = authUserFromStore?._id || authUser?._id;
      
      if (selectedGroup && (newMessage.groupId === selectedGroup._id || newMessage.groupId?.toString() === selectedGroup._id)) {
        const currentMessages = get().messages;
        set({ messages: [...currentMessages, newMessage] });

        if (isSoundEnabled) {
          const notificationSound = new Audio("/sounds/notification.mp3");
          notificationSound.currentTime = 0;
          notificationSound.play().catch((e) => console.log("Audio play failed:", e));
        }
      } else {
        // Update unread count for the group if not in current chat and message is not from current user
        const senderId = newMessage.senderId?._id || newMessage.senderId;
        if (newMessage.groupId && senderId?.toString() !== currentUserId?.toString()) {
          const updatedGroups = groups.map(group => {
            if (group._id === newMessage.groupId || group._id?.toString() === newMessage.groupId?.toString()) {
              return { ...group, unreadCount: (group.unreadCount || 0) + 1, lastMessage: newMessage };
            }
            return group;
          });
          set({ groups: updatedGroups });
        }
      }
    });

    // New group created
    socket.on("newGroup", (group) => {
      const { groups } = get();
      const groupExists = groups.some(g => g._id === group._id);
      if (!groupExists) {
        set({ groups: [group, ...groups] });
      }
    });

    // Added to group
    socket.on("addedToGroup", (group) => {
      const { groups } = get();
      const groupExists = groups.some(g => g._id === group._id);
      if (!groupExists) {
        set({ groups: [group, ...groups] });
        toast.success(`Bạn đã được thêm vào ${group.name}`);
      }
    });

    // Removed from group
    socket.on("removedFromGroup", (data) => {
      const { groups, selectedGroup } = get();
      set({ groups: groups.filter(g => g._id !== data.groupId) });
      if (selectedGroup && selectedGroup._id === data.groupId) {
        set({ selectedGroup: null, messages: [] });
        toast.error("Bạn đã bị xóa khỏi nhóm này");
      }
    });

    // Group updated
    socket.on("groupUpdated", (group) => {
      const { groups } = get();
      set({ groups: groups.map(g => g._id === group._id ? group : g) });
      const { selectedGroup } = get();
      if (selectedGroup && selectedGroup._id === group._id) {
        set({ selectedGroup: group });
      }
    });

    // Typing indicators for one-on-one
    socket.on("userTyping", (data) => {
      if (selectedUser && data.from === selectedUser._id) {
        set({ isTyping: true });
      }
    });

    socket.on("userStopTyping", (data) => {
      if (selectedUser && data.from === selectedUser._id) {
        set({ isTyping: false });
      }
    });

    // Typing indicators for groups
    socket.on("userTypingInGroup", (data) => {
      if (selectedGroup && data.groupId === selectedGroup._id) {
        const { groupTypingUsers } = get();
        const typingUsers = groupTypingUsers[data.groupId] || [];
        if (!typingUsers.includes(data.from)) {
          set({
            groupTypingUsers: {
              ...groupTypingUsers,
              [data.groupId]: [...typingUsers, data.from],
            },
          });
        }
      }
    });

    socket.on("userStopTypingInGroup", (data) => {
      if (selectedGroup && data.groupId === selectedGroup._id) {
        const { groupTypingUsers } = get();
        const typingUsers = (groupTypingUsers[data.groupId] || []).filter(
          id => id !== data.from
        );
        set({
          groupTypingUsers: {
            ...groupTypingUsers,
            [data.groupId]: typingUsers,
          },
        });
      }
    });

    // Message deleted (one-on-one)
    socket.on("messageDeleted", (data) => {
      const { messages } = get();
      if (data.deleted) {
        // Message was completely deleted (had file/image)
        set({ messages: messages.filter(msg => msg._id !== data.messageId) });
      } else {
        // Message was marked as deleted (text only)
        set({
          messages: messages.map(msg =>
            msg._id === data.messageId
              ? { ...msg, isDeleted: true, deletedAt: data.deletedAt }
              : msg
          ),
        });
      }
    });

    // Group message deleted
    socket.on("groupMessageDeleted", (data) => {
      if (selectedGroup && data.groupId === selectedGroup._id) {
        const { messages, pinnedMessages } = get();
        if (data.deleted) {
          // Message was completely deleted (had file/image)
          const updatedMessages = messages.filter(msg => msg._id !== data.messageId);
          const updatedPinned = pinnedMessages.filter(msg => msg._id !== data.messageId);
          set({ messages: updatedMessages, pinnedMessages: updatedPinned });
        } else {
          // Message was marked as deleted (text only)
          const updatedMessages = messages.map(msg =>
            msg._id === data.messageId
              ? { ...msg, isDeleted: true, deletedAt: data.deletedAt }
              : msg
          );
          const updatedPinned = pinnedMessages.filter(msg => msg._id !== data.messageId);
          set({ messages: updatedMessages, pinnedMessages: updatedPinned });
        }
      }
    });

    // Message pinned (one-on-one)
    socket.on("messagePinned", (data) => {
      const { selectedUser, messages, pinnedMessages, chats, authUser } = get();
      const { authUser: authUserFromStore } = useAuthStore.getState();
      const currentUserId = authUserFromStore?._id || authUser?._id;
      const messageId = data._id || data.messageId;
      const pinnedBy = data.pinnedBy || "Ai đó";
      
      // Determine the chat partner (the other user in this conversation)
      const receiverId = data.receiverId?._id || data.receiverId;
      const senderId = data.senderId?._id || data.senderId;
      
      // Find the partner - the other user in this conversation
      let partnerId = null;
      if (receiverId && senderId) {
        if (currentUserId?.toString() === receiverId?.toString()) {
          partnerId = senderId;
        } else if (currentUserId?.toString() === senderId?.toString()) {
          partnerId = receiverId;
        } else {
          // Fallback: use receiverId or senderId
          partnerId = receiverId || senderId;
        }
      } else {
        partnerId = receiverId || senderId;
      }
      
      // Check if we're currently in this chat
      // This message belongs to the conversation with selectedUser if:
      // - selectedUser is the receiver (message was sent to them), OR
      // - selectedUser is the sender (message was sent by them), OR
      // - current user is receiver/sender and selectedUser is the other party
      let isInThisChat = false;
      if (selectedUser && selectedUser._id) {
        const selectedUserId = selectedUser._id.toString();
        const currentUserIdStr = currentUserId?.toString();
        
        // Simple check: if selectedUser is receiver or sender of this message
        if (receiverId && selectedUserId === receiverId.toString()) {
          isInThisChat = true;
        } else if (senderId && selectedUserId === senderId.toString()) {
          isInThisChat = true;
        }
        // Also check: if current user is in this conversation and selectedUser is the partner
        else if (currentUserIdStr && (
          (receiverId && currentUserIdStr === receiverId.toString()) ||
          (senderId && currentUserIdStr === senderId.toString())
        )) {
          // Current user is part of this conversation, so if we have selectedUser, it's this chat
          isInThisChat = true;
        }
      }
      
      // If we're in this chat, update messages
      if (isInThisChat) {
        // Check if message exists in current messages, if not, add it
        const messageExists = messages.some(msg => msg._id === messageId);
        let updatedMessages;
        
        if (messageExists) {
          updatedMessages = messages.map(msg =>
            msg._id === messageId ? { ...msg, isPinned: data.isPinned, pinnedBy: data.isPinned ? pinnedBy : undefined } : msg
          );
        } else {
          // Message doesn't exist yet, add it to messages
          updatedMessages = [...messages, { 
            ...data, 
            isPinned: data.isPinned, 
            pinnedBy: data.isPinned ? pinnedBy : undefined 
          }];
        }
        
        // Get latest 3 pinned messages sorted by date (newest first)
        const updatedPinned = updatedMessages
          .filter(msg => msg.isPinned)
          .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
          .slice(0, 3);
        set({ messages: updatedMessages, pinnedMessages: updatedPinned });
      }
      
      // Always show notification if message was pinned (not unpinned) - for both parties
      if (data.isPinned) {
        // If not in this chat, update unread count
        if (!isInThisChat && partnerId) {
          const updatedChats = chats.map(chat => {
            if (chat._id && partnerId && chat._id.toString() === partnerId.toString()) {
              return { 
                ...chat, 
                unreadCount: (chat.unreadCount || 0) + 1,
                lastMessage: {
                  text: `[Đã ghim tin nhắn]`,
                  createdAt: new Date(),
                  senderId: data.senderId
                }
              };
            }
            return chat;
          });
          set({ chats: updatedChats });
        }
        
        // Always emit event to show notification in ChatContainer (for both parties when in chat)
        // Emit if we're in a chat and this message belongs to that conversation
        if (isInThisChat && selectedUser) {
          // Emit event immediately - both parties should see the notification
          window.dispatchEvent(new CustomEvent('messagePinned', { 
            detail: { 
              pinnedBy, 
              isGroupChat: false 
            } 
          }));
        }
      }
    });

    // Group message pinned
    socket.on("groupMessagePinned", (data) => {
      const { selectedGroup, messages, pinnedMessages, groups, authUser } = get();
      const { authUser: authUserFromStore } = useAuthStore.getState();
      const currentUserId = authUserFromStore?._id || authUser?._id;
      const messageId = data._id || data.messageId;
      const pinnedBy = data.pinnedBy || "Ai đó";
      
      // Check if we're currently in this group chat
      const isInThisChat = selectedGroup && data.groupId && (selectedGroup._id?.toString() === data.groupId?.toString());
      
      // If we're in this group chat, update messages
      if (isInThisChat) {
        const updatedMessages = messages.map(msg =>
          msg._id === messageId ? { ...msg, isPinned: data.isPinned, pinnedBy: data.isPinned ? pinnedBy : undefined } : msg
        );
        // Get latest 3 pinned messages sorted by date (newest first)
        const updatedPinned = updatedMessages
          .filter(msg => msg.isPinned)
          .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
          .slice(0, 3);
        set({ messages: updatedMessages, pinnedMessages: updatedPinned });
      }
      
      // Always show notification if message was pinned (not unpinned) - for all group members
      if (data.isPinned) {
        // If not in this group chat, update unread count
        if (!isInThisChat && data.groupId) {
          const updatedGroups = groups.map(group => {
            if (group._id?.toString() === data.groupId?.toString()) {
              return { 
                ...group, 
                unreadCount: (group.unreadCount || 0) + 1,
                lastMessage: {
                  text: `[Đã ghim tin nhắn]`,
                  createdAt: new Date(),
                  senderId: data.senderId
                }
              };
            }
            return group;
          });
          set({ groups: updatedGroups });
        }
        
        // Always emit event to show notification in ChatContainer (for all group members)
        if (isInThisChat) {
          // Emit event immediately - all group members should see the notification
          window.dispatchEvent(new CustomEvent('messagePinned', { 
            detail: { 
              pinnedBy, 
              isGroupChat: true 
            } 
          }));
        }
      }
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
    socket.off("newGroupMessage");
    socket.off("newGroup");
    socket.off("addedToGroup");
    socket.off("removedFromGroup");
    socket.off("groupUpdated");
    socket.off("userTyping");
    socket.off("userStopTyping");
    socket.off("userTypingInGroup");
    socket.off("userStopTypingInGroup");
    socket.off("messageDeleted");
    socket.off("groupMessageDeleted");
    socket.off("messageReactionAdded");
    socket.off("messageReactionRemoved");
    socket.off("groupMessageReactionAdded");
    socket.off("groupMessageReactionRemoved");
    socket.off("messagePinned");
    socket.off("groupMessagePinned");
  },

  emitTyping: (to) => {
    const socket = useAuthStore.getState().socket;
    if (socket && to) {
      socket.emit("typing", { to });
    }
  },

  emitStopTyping: (to) => {
    const socket = useAuthStore.getState().socket;
    if (socket && to) {
      socket.emit("stopTyping", { to });
    }
  },

  emitGroupTyping: (groupId) => {
    const socket = useAuthStore.getState().socket;
    if (socket && groupId) {
      socket.emit("groupTyping", { groupId });
    }
  },

  emitStopGroupTyping: (groupId) => {
    const socket = useAuthStore.getState().socket;
    if (socket && groupId) {
      socket.emit("stopGroupTyping", { groupId });
    }
  },

  // Pin/Unpin message (one-on-one)
  pinMessage: async (messageId, isGroupChat = false) => {
    try {
      const { messages, pinnedMessages, authUser } = get();
      const { authUser: authUserFromStore } = useAuthStore.getState();
      const currentUserId = authUserFromStore?._id || authUser?._id;
      const message = messages.find(msg => msg._id === messageId);
      const isCurrentlyPinned = message?.isPinned;
      const pinnedBy = authUserFromStore?.fullName || authUser?.fullName || "Bạn";

      // If pinning a new message and already have 3 pinned, unpin the oldest one
      if (!isCurrentlyPinned && pinnedMessages.length >= 3) {
        const oldestPinned = pinnedMessages
          .sort((a, b) => new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt))[0];
        
        // Unpin the oldest message first
        if (isGroupChat) {
          await axiosInstance.patch(`/groups/messages/${oldestPinned._id}/pin`);
        } else {
          await axiosInstance.patch(`/messages/${oldestPinned._id}/pin`);
        }
      }

      // Pin/Unpin the target message
      let response;
      if (isGroupChat) {
        response = await axiosInstance.patch(`/groups/messages/${messageId}/pin`);
      } else {
        response = await axiosInstance.patch(`/messages/${messageId}/pin`);
      }

      // Update local state with pinnedBy from response
      const responsePinnedBy = response.data?.pinnedBy || pinnedBy;
      const updatedMessages = messages.map(msg => {
        if (msg._id === messageId) {
          return { ...msg, isPinned: !msg.isPinned, pinnedBy: !msg.isPinned ? responsePinnedBy : undefined };
        }
        // Unpin the oldest if we're pinning a new one
        if (!isCurrentlyPinned && pinnedMessages.length >= 3 && msg._id === pinnedMessages
          .sort((a, b) => new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt))[0]?._id) {
          return { ...msg, isPinned: false, pinnedBy: undefined };
        }
        return msg;
      });
      
      // Get latest 3 pinned messages sorted by date (newest first)
      const updatedPinned = updatedMessages
        .filter(msg => msg.isPinned)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, 3);
      
      set({ messages: updatedMessages, pinnedMessages: updatedPinned });
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể ghim/hủy ghim tin nhắn");
    }
  },

  // Star/Unstar message (one-on-one)
  starMessage: async (messageId, isGroupChat = false) => {
    try {
      if (isGroupChat) {
        await axiosInstance.patch(`/groups/messages/${messageId}/star`);
      } else {
        await axiosInstance.patch(`/messages/${messageId}/star`);
      }
      // Update local state
      const { messages } = get();
      const updatedMessages = messages.map(msg => 
        msg._id === messageId ? { ...msg, isStarred: !msg.isStarred } : msg
      );
      set({ messages: updatedMessages });
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể đánh dấu/hủy đánh dấu tin nhắn");
    }
  },

  // Scroll to pinned message
  scrollToMessage: (messageId) => {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight the message briefly
      messageElement.classList.add('bg-yellow-100', 'transition-colors');
      setTimeout(() => {
        messageElement.classList.remove('bg-yellow-100');
      }, 2000);
    }
  },
}));
