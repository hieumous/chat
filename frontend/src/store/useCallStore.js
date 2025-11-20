import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
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

    try {
      // Ensure SimplePeer is loaded
      console.log("Loading SimplePeer...");
      const Peer = await loadSimplePeer();
      
      if (!Peer) {
        toast.error("Call feature failed to load, please refresh the page");
        return;
      }
      
      console.log("SimplePeer loaded, requesting media...");
      set({ isCalling: true, callType, receiverId });
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === "video",
        audio: true,
      });

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
      const peer = new Peer({
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

      peer.on("signal", (data) => {
        console.log("Peer signal generated, sending to server", data);
        socket.emit("callUser", {
          userToCall: receiverId,
          signalData: data,
          from: authUser._id,
          name: authUser.fullName,
          callType: callType,
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
        get().endCall();
      });

      // Listen for call accepted
      socket.on("callAccepted", (signal) => {
        set({ callAccepted: true });
        if (peer) {
          peer.signal(signal);
        }
      });

      // Listen for call rejected
      socket.on("callRejected", () => {
        toast.error("Call rejected");
        get().endCall();
      });

      set({ call: peer });
      console.log("Call initiated, waiting for answer...");
      toast.success(`Calling...`);
    } catch (error) {
      console.error("Error starting call:", error);
      const errorMessage = error.name === "NotAllowedError" 
        ? "Camera/microphone permission denied. Please allow access and try again."
        : error.name === "NotFoundError"
        ? "No camera/microphone found. Please check your device."
        : "Failed to start call. Please try again.";
      toast.error(errorMessage);
      set({ isCalling: false, stream: null, callType: null, receiverId: null });
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
        get().endCall();
      });

      peer.signal(callerSignal);
      set({ call: peer, receivingCall: false });
      toast.success("Call answered");
    } catch (error) {
      console.error("Error answering call:", error);
      toast.error("Failed to access camera/microphone. Please check permissions.");
      get().rejectCall();
    }
  },

  // End call
  endCall: () => {
    const { call, stream } = get();
    const { socket } = useAuthStore.getState();

    if (call) {
      call.destroy();
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (get().remoteStream) {
      get().remoteStream.getTracks().forEach((track) => track.stop());
    }

    // Notify other user if call was active
    const { receiverId, caller } = get();
    if (socket && (get().callAccepted || get().isCalling)) {
      const callerId = typeof caller === "object" ? caller?.id : caller;
      socket.emit("endCall", { to: callerId || receiverId });
    }

    // Remove socket listeners
    if (socket) {
      socket.off("callAccepted");
      socket.off("callRejected");
      socket.off("callEnded");
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

