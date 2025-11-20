import { useEffect, useRef, useState } from "react";
import { useCallStore } from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";
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
  } = useCallStore();
  const { socket, authUser } = useAuthStore();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null); // For audio calls
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  // Setup socket listeners for incoming calls
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data) => {
      useCallStore.setState({
        receivingCall: true,
        caller: { id: data.from, name: data.name },
        callerSignal: data.signal,
        callType: data.callType,
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
      useCallStore.getState().endCall();
      toast.info("Call ended");
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

  // Setup local video stream
  useEffect(() => {
    if (stream && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Setup remote video stream
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

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
        track.enabled = newMutedState; // If muted, track.enabled = false
        console.log("Audio track muted:", !newMutedState, "enabled:", track.enabled);
      });
      setMuted(newMutedState);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (stream && callType === "video") {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = videoOff;
      });
      setVideoOff(!videoOff);
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

        {/* Local Video (Small overlay) */}
        {callAccepted && callType === "video" && stream && (
          <div className="absolute bottom-20 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-white shadow-lg">
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
                onClick={endCall}
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
                onClick={endCall}
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

