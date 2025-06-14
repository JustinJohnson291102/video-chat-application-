import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useVideo } from '../contexts/VideoContext';
import VideoPlayer from '../components/VideoPlayer';
import ControlBar from '../components/ControlBar';
import ChatPanel from '../components/ChatPanel';
import { Wifi, WifiOff } from 'lucide-react';

const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const { state, initializeMedia, joinRoom } = useVideo();
  const navigate = useNavigate();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const mediaInitialized = useRef(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!roomId) {
      navigate('/dashboard');
      return;
    }

    const initRoom = async () => {
      if (!mediaInitialized.current) {
        console.log('Initializing room for user:', user.name);
        await initializeMedia();
        joinRoom(roomId, user.name);
        mediaInitialized.current = true;
      }
    };

    initRoom();
  }, [user, roomId, navigate, initializeMedia, joinRoom]);

  useEffect(() => {
    // Listen for room leave
    if (!state.roomId && roomId && mediaInitialized.current) {
      navigate('/dashboard');
    }
  }, [state.roomId, roomId, navigate]);

  if (!user || !roomId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 relative">
      {/* Connection Status */}
      <div className="absolute top-4 left-4 z-50">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium ${
          state.isConnected 
            ? 'bg-green-500 bg-opacity-20 text-green-300 border border-green-500' 
            : 'bg-red-500 bg-opacity-20 text-red-300 border border-red-500'
        }`}>
          {state.isConnected ? (
            <>
              <Wifi className="w-4 h-4" />
              Connected
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              Connecting...
            </>
          )}
        </div>
      </div>

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%222%22/%3E%3C/svg%3E')]" />
      </div>

      {/* Main Video Grid */}
      <div className="relative z-10 p-4 pb-24">
        <div className="max-w-7xl mx-auto">
          {/* Room Info */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Room: {roomId}</h1>
            <p className="text-blue-200">
              {state.participants.length + 1} participant{state.participants.length === 0 ? '' : 's'} in this meeting
            </p>
            {!state.isConnected && (
              <p className="text-yellow-300 text-sm mt-2">
                🔄 Connecting to server... Make sure both devices are on the same network
              </p>
            )}
          </div>

          {/* Video Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Local Video */}
            <VideoPlayer
              stream={state.localStream || undefined}
              name={`${user.name} (You)`}
              isLocal={true}
              audioEnabled={state.isAudioEnabled}
              videoEnabled={state.isVideoEnabled}
              className="aspect-video"
            />

            {/* Remote Participants */}
            {state.participants.map((participant) => (
              <VideoPlayer
                key={participant.id}
                stream={participant.stream}
                name={participant.name}
                audioEnabled={participant.audioEnabled}
                videoEnabled={participant.videoEnabled}
                className="aspect-video"
              />
            ))}

            {/* Empty Slots */}
            {Array.from({ length: Math.max(0, 3 - state.participants.length) }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="aspect-video bg-gray-800 bg-opacity-50 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center"
              >
                <div className="text-center">
                  <p className="text-gray-400 mb-2">Waiting for participants...</p>
                  <p className="text-gray-500 text-sm">Share the room ID: <span className="font-mono font-bold">{roomId}</span></p>
                </div>
              </div>
            ))}
          </div>

          {/* Instructions for mobile users */}
          {state.participants.length === 0 && (
            <div className="mt-8 bg-blue-900 bg-opacity-30 rounded-xl p-6 text-center">
              <h3 className="text-white font-semibold mb-3">📱 How to join from mobile:</h3>
              <div className="text-blue-200 text-sm space-y-2">
                <p>1. Make sure both devices are connected to the same WiFi network</p>
                <p>2. On mobile, open browser and go to: <span className="font-mono bg-blue-800 px-2 py-1 rounded">{window.location.origin}</span></p>
                <p>3. Login and join room: <span className="font-mono bg-blue-800 px-2 py-1 rounded">{roomId}</span></p>
                <p>4. Allow camera and microphone permissions when prompted</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <ControlBar onToggleChat={() => setIsChatOpen(!isChatOpen)} isChatOpen={isChatOpen} />

      {/* Chat Panel */}
      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
};

export default Room;