import { useEffect, useRef, useState } from "react";
import { useCallStore } from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { PhoneIcon, VideoIcon, XIcon, PhoneOffIcon, MicIcon, MicOffIcon, VideoOffIcon } from "lucide-react";
import toast from "react-hot-toast";

function CallModal() {
  const {
    receivingCall,
    caller,
    callAccepted,
    stream,
    remoteStream,
    callType,
    isCalling,
    answerCall,
    rejectCall,
    endCall,
    otherUser,
    receiverId,
  } = useCallStore();
  const { selectedUser, allContacts, chats } = useChatStore();
  const { socket, authUser } = useAuthStore();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null); // For audio calls
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  
  // Determine the other user (opposite party in the call)
  const getOtherUser = () => {
    if (otherUser) return otherUser;
    
    // If we're the caller, get receiver info from selectedUser or contacts
    if (isCalling && receiverId) {
      if (selectedUser && selectedUser._id === receiverId) {
        return selectedUser;
      }
      return allContacts.find(c => c._id === receiverId) || 
             chats.find(c => c._id === receiverId);
    }
    
    // If we're the receiver, get caller info
    if (receivingCall || (callAccepted && caller)) {
      const callerId = typeof caller === "object" ? caller.id : caller;
      return allContacts.find(c => c._id === callerId) || 
             chats.find(c => c._id === callerId) ||
             (caller && typeof caller === "object" ? { _id: caller.id, fullName: caller.name, profilePic: null } : null);
    }
    
    return null;
  };
  
  const displayUser = getOtherUser();

  // Reset mute and video state when a new call starts
  useEffect(() => {
    if (stream) {
      // Reset states when stream is created (new call started)
      setMuted(false);
      setVideoOff(false);
      // Ensure audio tracks are enabled when starting a new call
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      // Ensure video tracks are enabled when starting a new call
      if (callType === "video") {
        stream.getVideoTracks().forEach((track) => {
          track.enabled = true;
          console.log("✅ Video track enabled on stream creation:", track.enabled, track.label);
        });
        // Đảm bảo local video ref được gán ngay
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          console.log("✅ Local video ref assigned immediately");
        }
      }
    }
  }, [stream, callType]);

  // Setup socket listeners for incoming calls
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data) => {
      // Try to get caller info from chat store
      const { allContacts, chats } = useChatStore.getState();
      let callerInfo = allContacts.find(c => c._id === data.from) || 
                      chats.find(c => c._id === data.from);
      
      // If not found, use basic info from data
      if (!callerInfo) {
        callerInfo = { _id: data.from, fullName: data.name, profilePic: null };
      }
      
      useCallStore.setState({
        receivingCall: true,
        caller: { id: data.from, name: data.name },
        callerSignal: data.signal,
        callType: data.callType,
        otherUser: callerInfo, // Store for display
      });
    };

    const handleCallAccepted = (signal) => {
      const { call } = useCallStore.getState();
      if (call) {
        call.signal(signal);
        useCallStore.setState({ callAccepted: true });
      }
    };

    const handleCallRejected = () => {
      useCallStore.getState().endCall();
      toast.error("Call rejected");
    };

    const handleCallEnded = () => {
      console.log("🔔 Received callEnded event - ending call on this side");
      const currentState = useCallStore.getState();
      console.log("Current state when receiving callEnded:", {
        callAccepted: currentState.callAccepted,
        isCalling: currentState.isCalling,
        receivingCall: currentState.receivingCall,
      });
      
      // Cleanup refs immediately
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current.pause();
      }
      
      // End the call (skip notification since other side already ended)
      useCallStore.getState().endCall(true);
      
      // Force state update to ensure modal hides immediately
      setTimeout(() => {
        useCallStore.setState({
          callAccepted: false,
          isCalling: false,
          receivingCall: false,
          stream: null,
          remoteStream: null,
          call: null,
        });
        console.log("✅ State reset complete - modal should hide now");
      }, 0);
      
      toast.info("Cuộc gọi đã kết thúc");
    };

    const handleUserOffline = () => {
      toast.error("User is offline");
      useCallStore.getState().endCall();
    };

    socket.on("incomingCall", handleIncomingCall);
    socket.on("callAccepted", handleCallAccepted);
    socket.on("callRejected", handleCallRejected);
    socket.on("callEnded", handleCallEnded);
    socket.on("userOffline", handleUserOffline);

    return () => {
      socket.off("incomingCall", handleIncomingCall);
      socket.off("callAccepted", handleCallAccepted);
      socket.off("callRejected", handleCallRejected);
      socket.off("callEnded", handleCallEnded);
      socket.off("userOffline", handleUserOffline);
    };
  }, [socket]);

  // Setup local video stream (small frame - top right)
  useEffect(() => {
    if (stream && localVideoRef.current && callType === "video") {
      localVideoRef.current.srcObject = stream;
      // Đảm bảo video tracks được enable theo trạng thái videoOff
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !videoOff;
      });
      console.log("✅ Local video stream assigned to small frame (top-right)", { videoOff, trackEnabled: !videoOff });
    }
    return () => {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    };
  }, [stream, callType, videoOff]);

  // Đảm bảo local video hiển thị ngay khi callAccepted và stream có
  useEffect(() => {
    if (callAccepted && callType === "video" && stream && localVideoRef.current) {
      // Force update để đảm bảo video hiển thị
      const videoElement = localVideoRef.current;
      if (videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }
      // Đảm bảo video tracks enabled
      stream.getVideoTracks().forEach((track) => {
        if (!track.enabled && !videoOff) {
          track.enabled = true;
        }
      });
      console.log("✅ Local video ensured visible on call accepted");
    }
  }, [callAccepted, callType, stream, videoOff]);

  // Setup remote video stream (large frame - full screen)
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current && callType === "video") {
      remoteVideoRef.current.srcObject = remoteStream;
      console.log("✅ Remote video stream assigned to large frame (full screen)");
    }
    return () => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    };
  }, [remoteStream, callType]);

  // Đảm bảo remote video hiển thị ngay khi callAccepted và remoteStream có
  useEffect(() => {
    if (callAccepted && callType === "video" && remoteStream && remoteVideoRef.current) {
      // Force update để đảm bảo video hiển thị
      const videoElement = remoteVideoRef.current;
      if (videoElement.srcObject !== remoteStream) {
        videoElement.srcObject = remoteStream;
      }
      console.log("✅ Remote video ensured visible on call accepted");
    }
  }, [callAccepted, callType, remoteStream]);

  // Setup remote audio stream for audio calls
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current && callType === "audio") {
      console.log("Setting up remote audio stream", remoteStream);
      remoteAudioRef.current.srcObject = remoteStream;
      // Ensure audio plays
      remoteAudioRef.current.play().catch((error) => {
        console.error("Error playing remote audio:", error);
      });
    }
  }, [remoteStream, callType]);

  // Toggle mute
  const toggleMute = () => {
    if (stream) {
      const newMutedState = !muted;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !newMutedState; // If muted (newMutedState = true), track.enabled = false
        console.log("Audio track muted:", newMutedState, "enabled:", track.enabled);
      });
      setMuted(newMutedState);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (stream && callType === "video") {
      const newVideoOffState = !videoOff;
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !newVideoOffState; // Nếu videoOff = true, thì enabled = false
      });
      setVideoOff(newVideoOffState);
      console.log("Video toggled:", { videoOff: newVideoOffState, trackEnabled: !newVideoOffState });
    }
  };

  // Debug logging
  useEffect(() => {
    console.log("CallModal state:", {
      receivingCall,
      callAccepted,
      isCalling,
      callType,
      hasStream: !!stream,
      hasRemoteStream: !!remoteStream,
    });
  }, [receivingCall, callAccepted, isCalling, callType, stream, remoteStream]);

  // Show nothing if no call activity
  if (!receivingCall && !callAccepted && !isCalling) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
      <div className="relative w-full h-full flex flex-col">
        {/* Remote Video (Main) */}
        {callAccepted && callType === "video" && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        )}

        {/* Audio Call UI */}
        {callAccepted && callType === "audio" && (
          <>
            {/* Hidden audio element to play remote audio */}
            <audio
              ref={remoteAudioRef}
              autoPlay
              playsInline
              style={{ display: "none" }}
            />
            
            {/* Other user thumbnail - top right corner */}
            {displayUser && (
              <div className="absolute top-4 right-4 w-28 h-28 rounded-lg overflow-hidden border-2 border-white shadow-lg bg-gray-800">
                <img
                  src={displayUser.profilePic || "/avatar.png"}
                  alt={displayUser.fullName || "User"}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1 text-center truncate font-medium">
                  {displayUser.fullName || "User"}
                </div>
              </div>
            )}
            
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-32 h-32 bg-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <PhoneIcon className="w-16 h-16 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Audio Call</h3>
                <p className="text-gray-300">Connected</p>
                {remoteStream && (
                  <p className="text-green-400 text-sm mt-2">✓ Audio connected</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Local Video (Small overlay) - Top right corner */}
        {callAccepted && callType === "video" && stream && (
          <div className="absolute top-4 right-4 w-56 h-40 rounded-lg overflow-hidden border-2 border-white shadow-lg z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Incoming Call UI */}
        {receivingCall && !callAccepted && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-md">
              <div className="w-24 h-24 bg-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6">
                {callType === "video" ? (
                  <VideoIcon className="w-12 h-12 text-white" />
                ) : (
                  <PhoneIcon className="w-12 h-12 text-white" />
                )}
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Incoming {callType === "video" ? "Video" : "Audio"} Call
              </h3>
              <p className="text-gray-300 mb-8">
                from {typeof caller === "object" ? caller?.name : "Unknown"}
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={answerCall}
                  className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-full transition-colors"
                  title="Answer"
                >
                  <PhoneIcon className="w-6 h-6" />
                </button>
                <button
                  onClick={rejectCall}
                  className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-full transition-colors"
                  title="Reject"
                >
                  <PhoneOffIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Calling UI */}
        {isCalling && !callAccepted && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 bg-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                {callType === "video" ? (
                  <VideoIcon className="w-12 h-12 text-white" />
                ) : (
                  <PhoneIcon className="w-12 h-12 text-white" />
                )}
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Calling...</h3>
              <p className="text-gray-300 mb-8">Waiting for answer</p>
              <button
                onClick={() => endCall(false)}
                className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-full transition-colors"
              >
                <PhoneOffIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {/* Call Controls */}
        {callAccepted && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm p-6">
            <div className="max-w-md mx-auto flex gap-4 justify-center">
              {/* Mute/Unmute */}
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition-colors ${
                  muted ? "bg-red-500 hover:bg-red-600" : "bg-gray-700 hover:bg-gray-600"
                } text-white`}
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? <MicOffIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6" />}
              </button>

              {/* Video On/Off (only for video calls) */}
              {callType === "video" && (
                <button
                  onClick={toggleVideo}
                  className={`p-4 rounded-full transition-colors ${
                    videoOff ? "bg-red-500 hover:bg-red-600" : "bg-gray-700 hover:bg-gray-600"
                  } text-white`}
                  title={videoOff ? "Turn on video" : "Turn off video"}
                >
                  {videoOff ? <VideoOffIcon className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
                </button>
              )}

              {/* End Call */}
              <button
                onClick={() => endCall(false)}
                className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-full transition-colors"
                title="End Call"
              >
                <PhoneOffIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CallModal;

