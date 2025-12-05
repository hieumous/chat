import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";
import toast from "react-hot-toast";

// Dynamic import for simple-peer to avoid SSR issues
let SimplePeer = null;
let isSimplePeerLoading = false;
let simplePeerPromise = null;

const loadSimplePeer = async () => {
  if (SimplePeer) return SimplePeer;
  if (isSimplePeerLoading && simplePeerPromise) return simplePeerPromise;
  
  isSimplePeerLoading = true;
  simplePeerPromise = import("simple-peer").then((module) => {
    SimplePeer = module.default || module;
    isSimplePeerLoading = false;
    return SimplePeer;
  }).catch((error) => {
    console.error("Failed to load simple-peer:", error);
    isSimplePeerLoading = false;
    throw error;
  });
  
  return simplePeerPromise;
};

export const useCallStore = create((set, get) => ({
  call: null,
  callAccepted: false,
  callEnded: false,
  stream: null,
  receivingCall: false,
  caller: null,
  callerSignal: null,
  callType: null, // 'video' or 'audio'
  remoteStream: null,
  isCalling: false,
  receiverId: null,
  callHandlers: null, // Store socket handlers for cleanup
  otherUser: null, // Store other user info (caller or receiver) for display

  // Start a call
  startCall: async (receiverId, callType) => {
    console.log("startCall called", { receiverId, callType });
    const { socket, authUser } = useAuthStore.getState();
    
    if (!socket || !authUser) {
      console.error("No socket or authUser");
      toast.error("Please login to make a call");
      return;
    }

    if (typeof window === "undefined") {
      console.error("Window is undefined");
      toast.error("Call feature is not available");
      return;
    }

    // Check if socket is connected
    if (!socket.connected) {
      console.error("Socket is not connected");
      toast.error("Connection lost. Please refresh the page and try again.");
      return;
    }

    try {
      // Ensure SimplePeer is loaded
      console.log("Loading SimplePeer...");
      const Peer = await loadSimplePeer();
      
      if (!Peer) {
        toast.error("Call feature failed to load, please refresh the page");
        return;
      }
      
      console.log("SimplePeer loaded, requesting media...");
      // Get receiver info from chat store
      const { selectedUser, allContacts, chats } = useChatStore.getState();
      let receiverInfo = null;
      
      // Try to find receiver from selectedUser or contacts/chats
      if (selectedUser && selectedUser._id === receiverId) {
        receiverInfo = selectedUser;
      } else {
        receiverInfo = allContacts.find(c => c._id === receiverId) || 
                      chats.find(c => c._id === receiverId);
      }
      
      set({ isCalling: true, callType, receiverId, otherUser: receiverInfo });
      
      // Get user media
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: callType === "video",
          audio: true,
        });
      } catch (mediaError) {
        console.error("Error getting user media:", mediaError);
        set({ isCalling: false, stream: null, callType: null, receiverId: null });
        if (mediaError.name === "NotAllowedError") {
          toast.error("Camera/microphone permission denied. Please allow access and try again.");
        } else if (mediaError.name === "NotFoundError") {
          toast.error("No camera/microphone found. Please check your device.");
        } else {
          toast.error("Failed to access camera/microphone. Please check your device settings.");
        }
        return;
      }

      console.log("Media stream obtained", stream);
      console.log("Local stream tracks:", stream.getTracks());
      console.log("Local audio tracks:", stream.getAudioTracks());
      console.log("Local video tracks:", stream.getVideoTracks());
      
      // Ensure audio track is enabled
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
        console.log("Audio track enabled:", track.enabled, track.kind, track.label);
      });
      
      set({ stream });

      // Create peer
      console.log("Creating peer connection...");
      let peer;
      try {
        peer = new Peer({
          initiator: true,
          trickle: false,
          stream: stream,
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
            ],
          },
        });
      } catch (peerError) {
        console.error("Error creating peer:", peerError);
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
        set({ isCalling: false, stream: null, callType: null, receiverId: null });
        toast.error("Failed to initialize call connection. Please try again.");
        return;
      }

      peer.on("signal", (data) => {
        console.log("Peer signal generated, sending to server", data);
        if (socket && socket.connected) {
          socket.emit("callUser", {
            userToCall: receiverId,
            signalData: data,
            from: authUser._id,
            name: authUser.fullName,
            callType: callType,
          });
        } else {
          console.error("Socket not connected when trying to emit callUser");
          toast.error("Connection lost. Please refresh and try again.");
          get().endCall();
        }
      });

      peer.on("stream", (stream) => {
        console.log("Remote stream received", stream);
        console.log("Stream tracks:", stream.getTracks());
        console.log("Audio tracks:", stream.getAudioTracks());
        set({ callAccepted: true, remoteStream: stream });
      });

      peer.on("error", (err) => {
        console.error("Peer error:", err);
        toast.error("Call connection error");
        get().endCall();
      });

      peer.on("close", () => {
        console.log("Peer connection closed - ending call");
        // When peer closes, it means the other side disconnected
        // Don't send notification since connection is already closed
        get().endCall(true);
      });

      // Listen for call accepted
      const handleCallAccepted = (signal) => {
        // Keep receiverId when call is accepted so we can notify them when ending
        const currentReceiverId = get().receiverId;
        set({ callAccepted: true, receiverId: currentReceiverId });
        if (peer) {
          peer.signal(signal);
        }
      };

      // Listen for call rejected
      const handleCallRejected = () => {
        toast.error("Call rejected");
        get().endCall();
      };

      socket.on("callAccepted", handleCallAccepted);
      socket.on("callRejected", handleCallRejected);

      // Store handlers for cleanup
      set({ callHandlers: { handleCallAccepted, handleCallRejected } });

      set({ call: peer });
      console.log("Call initiated, waiting for answer...");
      toast.success(`Calling...`);
    } catch (error) {
      console.error("Error starting call:", error);
      // Clean up stream if it exists
      const { stream } = get();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const errorMessage = error.name === "NotAllowedError" 
        ? "Camera/microphone permission denied. Please allow access and try again."
        : error.name === "NotFoundError"
        ? "No camera/microphone found. Please check your device."
        : error.message || "Failed to start call. Please try again.";
      toast.error(errorMessage);
      set({ isCalling: false, stream: null, callType: null, receiverId: null, call: null });
    }
  },

  // Answer a call
  answerCall: async () => {
    console.log("answerCall called");
    const { socket, authUser } = useAuthStore.getState();
    const { callerSignal, callType } = get();

    if (!socket || !authUser) {
      console.error("No socket or authUser in answerCall");
      return;
    }

    if (typeof window === "undefined") {
      console.error("Window is undefined in answerCall");
      return;
    }

    try {
      // Ensure SimplePeer is loaded
      const Peer = await loadSimplePeer();
      
      if (!Peer) {
        toast.error("Call feature failed to load, please refresh the page");
        return;
      }

      console.log("Requesting media for answer...");
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === "video",
        audio: true,
      });

      console.log("Media stream obtained for answer", stream);
      console.log("Answer stream tracks:", stream.getTracks());
      console.log("Answer audio tracks:", stream.getAudioTracks());
      console.log("Answer video tracks:", stream.getVideoTracks());
      
      // Ensure audio track is enabled
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
        console.log("Answer audio track enabled:", track.enabled, track.kind, track.label);
      });
      
      set({ stream });

      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: stream,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        },
      });

      peer.on("signal", (data) => {
        const caller = get().caller;
        const callerId = typeof caller === "object" ? caller.id : caller;
        socket.emit("answerCall", {
          signal: data,
          to: callerId,
        });
      });

      peer.on("stream", (stream) => {
        console.log("Remote stream received", stream);
        console.log("Stream tracks:", stream.getTracks());
        console.log("Audio tracks:", stream.getAudioTracks());
        set({ callAccepted: true, remoteStream: stream });
      });

      peer.on("error", (err) => {
        console.error("Peer error:", err);
        toast.error("Call connection error");
        get().endCall();
      });

      peer.on("close", () => {
        console.log("Peer connection closed - ending call");
        const currentState = get();
        // Only auto-end if call is still active and we didn't just end it ourselves
        if (!currentState.callEnded && (currentState.callAccepted || currentState.isCalling || currentState.receivingCall)) {
          // When peer closes, it means the other side disconnected
          // Don't send notification since connection is already closed
          get().endCall(true);
        }
      });

      peer.signal(callerSignal);
      // Keep caller info when accepting call so we can notify them when ending
      const currentCaller = get().caller;
      set({ call: peer, receivingCall: false, caller: currentCaller });
      toast.success("Call answered");
    } catch (error) {
      console.error("Error answering call:", error);
      toast.error("Failed to access camera/microphone. Please check permissions.");
      get().rejectCall();
    }
  },

  // End call
  endCall: (skipNotification = false) => {
    // Ensure skipNotification is a boolean (handle React event objects)
    const shouldSkip = skipNotification === true || (typeof skipNotification === 'object' && skipNotification !== null);
    const actualSkipNotification = shouldSkip && skipNotification !== false;
    
    const state = get();
    const { call, stream, receiverId, caller, callAccepted, isCalling, receivingCall } = state;
    const { socket } = useAuthStore.getState();

    console.log("endCall called", { 
      skipNotification: actualSkipNotification, 
      originalParam: skipNotification,
      callAccepted, 
      isCalling, 
      receivingCall, 
      receiverId, 
      caller 
    });
    console.log("Socket state:", { socket: !!socket, connected: socket?.connected });

    // Prevent multiple calls to endCall
    if (state.callEnded) {
      console.log("Call already ended, skipping");
      return;
    }

    // IMPORTANT: Emit event BEFORE destroying connections and resetting state
    if (!actualSkipNotification) {
      // Get fresh state to ensure we have the latest values
      const currentState = get();
      const { receiverId: currentReceiverId, caller: currentCaller, callAccepted: currentCallAccepted, 
              isCalling: currentIsCalling, receivingCall: currentReceivingCall } = currentState;
      
      if (socket && socket.connected && (currentCallAccepted || currentIsCalling || currentReceivingCall)) {
        let targetId = null;
        
        // Determine target ID based on who we are
        if (currentIsCalling && currentReceiverId) {
          // We are the caller, notify the receiver
          targetId = currentReceiverId;
          console.log("We are the caller, targetId:", targetId);
        } else if (currentReceivingCall && currentCaller) {
          // We are receiving but haven't accepted yet, notify the caller
          targetId = typeof currentCaller === "object" ? currentCaller.id : currentCaller;
          console.log("We are receiving call, targetId:", targetId);
        } else if (currentCallAccepted) {
          // Call is accepted, determine based on available info
          if (currentReceiverId) {
            // We have receiverId, so we're the caller
            targetId = currentReceiverId;
            console.log("Call accepted - we are caller, targetId:", targetId);
          } else if (currentCaller) {
            // We have caller info, so we're the receiver
            targetId = typeof currentCaller === "object" ? currentCaller.id : currentCaller;
            console.log("Call accepted - we are receiver, targetId:", targetId);
          }
        }
        
        if (targetId) {
          console.log("✅ Emitting endCall to:", targetId, { 
            callAccepted: currentCallAccepted, 
            isCalling: currentIsCalling, 
            receivingCall: currentReceivingCall,
            receiverId: currentReceiverId, 
            caller: currentCaller 
          });
          
          // Emit immediately - BEFORE any cleanup
          try {
            socket.emit("endCall", { to: targetId });
            console.log("✅ endCall event emitted successfully");
          } catch (error) {
            console.error("❌ Error emitting endCall:", error);
          }
          
          // Send backup after a short delay to ensure delivery
          setTimeout(() => {
            const currentSocket = useAuthStore.getState().socket;
            if (currentSocket && currentSocket.connected) {
              console.log("✅ Sending backup endCall event to:", targetId);
              try {
                currentSocket.emit("endCall", { to: targetId });
              } catch (error) {
                console.error("❌ Error emitting backup endCall:", error);
              }
            } else {
              console.warn("⚠️ Socket not connected for backup emit");
            }
          }, 300);
        } else {
          console.warn("❌ Could not determine targetId for endCall", { 
            receiverId: currentReceiverId, 
            caller: currentCaller, 
            callAccepted: currentCallAccepted, 
            isCalling: currentIsCalling, 
            receivingCall: currentReceivingCall 
          });
        }
      } else {
        console.warn("⚠️ Cannot emit endCall:", { 
          hasSocket: !!socket, 
          socketConnected: socket?.connected,
          callAccepted: currentCallAccepted,
          isCalling: currentIsCalling,
          receivingCall: currentReceivingCall
        });
      }
    } else {
      console.log("⏭️ Skipping notification (skipNotification = true)");
      console.log("   Original parameter was:", skipNotification);
    }

    // Set callEnded flag first to prevent recursive calls from peer.close
    set({ callEnded: true });

    // Stop tracks first (this won't trigger peer.close)
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (get().remoteStream) {
      get().remoteStream.getTracks().forEach((track) => track.stop());
    }

    // Delay destroy peer connection to ensure event is sent first
    // Destroy peer AFTER a delay to allow event to be emitted
    setTimeout(() => {
      const currentCall = get().call;
      if (currentCall && !currentCall.destroyed) {
        try {
          console.log("Destroying peer connection");
          currentCall.destroy();
        } catch (error) {
          console.error("Error destroying peer:", error);
        }
      }
    }, 500); // Increased delay to ensure event is sent

    // Remove socket listeners using stored handlers
    if (socket) {
      const { callHandlers } = get();
      if (callHandlers) {
        if (callHandlers.handleCallAccepted) {
          socket.off("callAccepted", callHandlers.handleCallAccepted);
        }
        if (callHandlers.handleCallRejected) {
          socket.off("callRejected", callHandlers.handleCallRejected);
        }
      }
      // Don't remove callEnded here - it's handled in CallModal.jsx
    }

    set({
      call: null,
      callAccepted: false,
      callEnded: true,
      stream: null,
      remoteStream: null,
      receivingCall: false,
      caller: null,
      callerSignal: null,
      callType: null,
      isCalling: false,
      receiverId: null,
      callHandlers: null,
      otherUser: null,
    });

    // Reset callEnded after a moment
    setTimeout(() => {
      set({ callEnded: false });
    }, 1000);
  },

  // Reject call
  rejectCall: () => {
    const { socket } = useAuthStore.getState();
    const { caller } = get();

    if (socket && caller) {
      const callerId = typeof caller === "object" ? caller.id : caller;
      socket.emit("rejectCall", { to: callerId });
    }

    set({
      receivingCall: false,
      caller: null,
      callerSignal: null,
      callType: null,
    });

    toast.info("Call rejected");
  },
}));

