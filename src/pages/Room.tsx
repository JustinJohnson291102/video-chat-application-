import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useVideo } from '../contexts/VideoContext';
import VideoPlayer from '../components/VideoPlayer';
import ControlBar from '../components/ControlBar';
import ChatPanel from '../components/ChatPanel';

const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const { state, initializeMedia, joinRoom } = useVideo();
  const navigate = useNavigate();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
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
        console.log('🚀 Initializing room for user:', user.name);
        setIsInitializing(true);
        
        try {
          await initializeMedia();
          joinRoom(roomId, user.name);
          mediaInitialized.current = true;
          
          // Wait a bit for connection to establish
          setTimeout(() => {
            setIsInitializing(false);
          }, 2000);
          
        } catch (error) {
          console.error('❌ Failed to initialize room:', error);
          setIsInitializing(false);
        }
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
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%222%22/%3E%3C/svg%3E')]" />
      </div>

      {/* Main Video Grid */}
      <div className="relative z-10 p-4 pb-24">
        <div className="max-w-7xl mx-auto">
          {/* Room Info */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Meeting Room</h1>
            <p className="text-blue-200 mb-2">
              Room ID: <span className="font-mono bg-blue-800 px-2 py-1 rounded">{roomId}</span>
            </p>
            <p className="text-blue-200">
              {state.participants.length + 1} participant{state.participants.length === 0 ? '' : 's'} connected
            </p>
            
            {/* Connection Status */}
            {isInitializing && (
              <div className="mt-4 bg-blue-900 bg-opacity-50 border border-blue-600 rounded-lg p-3">
                <p className="text-blue-300 text-sm">
                  🎥 Setting up your camera and microphone...
                </p>
              </div>
            )}
            
            {!state.isConnected && !isInitializing && (
              <div className="mt-4 bg-red-900 bg-opacity-50 border border-red-600 rounded-lg p-3">
                <p className="text-red-300 text-sm">
                  ❌ Connection lost. Trying to reconnect...
                </p>
              </div>
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
                  <p className="text-gray-500 text-sm">Share the room ID to invite others</p>
                </div>
              </div>
            ))}
          </div>

          {/* Instructions */}
          {state.participants.length === 0 && state.isConnected && !isInitializing && (
            <div className="mt-8 bg-blue-900 bg-opacity-30 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4 text-center">📱 How to invite others:</h3>
              <div className="grid md:grid-cols-2 gap-4 text-blue-200 text-sm">
                <div className="bg-blue-800 bg-opacity-30 rounded-lg p-4">
                  <h4 className="font-semibold text-white mb-2">💻 From Computer:</h4>
                  <ol className="space-y-1 list-decimal list-inside">
                    <li>Share this link: <span className="font-mono text-xs break-all">{window.location.href}</span></li>
                    <li>Or share Room ID: <span className="font-mono bg-blue-700 px-1 rounded">{roomId}</span></li>
                  </ol>
                </div>
                <div className="bg-blue-800 bg-opacity-30 rounded-lg p-4">
                  <h4 className="font-semibold text-white mb-2">📱 From Mobile:</h4>
                  <ol className="space-y-1 list-decimal list-inside">
                    <li>Connect to same WiFi network</li>
                    <li>Open browser and go to: <span className="font-mono text-xs">{window.location.origin}</span></li>
                    <li>Login and join room: <span className="font-mono bg-blue-700 px-1 rounded">{roomId}</span></li>
                    <li>Allow camera/microphone permissions</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {state.participants.length > 0 && (
            <div className="mt-6 bg-green-900 bg-opacity-30 rounded-xl p-4 text-center">
              <p className="text-green-300">
                🎉 Great! You're now connected with {state.participants.length} other participant{state.participants.length === 1 ? '' : 's'}
              </p>
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