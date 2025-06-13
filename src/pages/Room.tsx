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
  const mediaInitialized = useRef(false); // Prevent unnecessary re-inits

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
        await initializeMedia();
        joinRoom(roomId);
        mediaInitialized.current = true;
      }
    };

    initRoom();
  }, [user, roomId, navigate, initializeMedia, joinRoom]);

  useEffect(() => {
    // Listen for room leave
    if (!state.roomId && roomId) {
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
            <h1 className="text-2xl font-bold text-white mb-2">Room: {roomId}</h1>
            <p className="text-blue-200">
              {state.participants.length + 1} participant{state.participants.length === 0 ? '' : 's'} in this meeting
            </p>
          </div>

          {/* Video Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Local Video */}
            <VideoPlayer
              stream={state.localStream || undefined}
              name={user.name}
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

            {/* Empty Slots for Demo */}
            {Array.from({ length: Math.max(0, 3 - state.participants.length) }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="aspect-video bg-gray-800 bg-opacity-50 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center"
              >
                <p className="text-gray-400">Waiting for participants...</p>
              </div>
            ))}
          </div>
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
