import React, { useState } from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Phone, 
  MessageSquare, 
  Monitor,
  Copy,
  Users,
  Check
} from 'lucide-react';
import { useVideo } from '../contexts/VideoContext';

interface ControlBarProps {
  onToggleChat: () => void;
  isChatOpen: boolean;
}

const ControlBar: React.FC<ControlBarProps> = ({ onToggleChat, isChatOpen }) => {
  const { state, dispatch, leaveRoom, shareScreen } = useVideo();
  const [copied, setCopied] = useState(false);

  const handleToggleAudio = () => {
    dispatch({ type: 'TOGGLE_AUDIO' });
  };

  const handleToggleVideo = () => {
    dispatch({ type: 'TOGGLE_VIDEO' });
  };

  const handleLeaveRoom = () => {
    leaveRoom();
  };

  const handleCopyRoomLink = async () => {
    if (state.roomId) {
      const roomLink = `${window.location.origin}/room/${state.roomId}`;
      try {
        await navigator.clipboard.writeText(roomLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = roomLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white bg-opacity-90 backdrop-blur-md rounded-2xl shadow-2xl px-6 py-4">
      <div className="flex items-center gap-4">
        {/* Audio Control */}
        <button
          onClick={handleToggleAudio}
          className={`p-3 rounded-full transition-all duration-200 ${
            state.isAudioEnabled
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-800'
              : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
          title={state.isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {state.isAudioEnabled ? (
            <Mic className="w-5 h-5" />
          ) : (
            <MicOff className="w-5 h-5" />
          )}
        </button>

        {/* Video Control */}
        <button
          onClick={handleToggleVideo}
          className={`p-3 rounded-full transition-all duration-200 ${
            state.isVideoEnabled
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-800'
              : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
          title={state.isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {state.isVideoEnabled ? (
            <Video className="w-5 h-5" />
          ) : (
            <VideoOff className="w-5 h-5" />
          )}
        </button>

        {/* Screen Share */}
        <button
          onClick={shareScreen}
          className={`p-3 rounded-full transition-all duration-200 ${
            state.isScreenSharing
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
          }`}
          title={state.isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
        >
          <Monitor className="w-5 h-5" />
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-300" />

        {/* Chat */}
        <button
          onClick={onToggleChat}
          className={`p-3 rounded-full transition-all duration-200 relative ${
            isChatOpen
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
          }`}
          title="Toggle chat"
        >
          <MessageSquare className="w-5 h-5" />
          {state.chatMessages.length > 0 && !isChatOpen && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
          )}
        </button>

        {/* Participants */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-full">
          <Users className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-800">
            {state.participants.length + 1}
          </span>
        </div>

        {/* Copy Room Link */}
        <button
          onClick={handleCopyRoomLink}
          className={`p-3 rounded-full transition-all duration-200 ${
            copied 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
          }`}
          title={copied ? 'Link copied!' : 'Copy meeting link'}
        >
          {copied ? (
            <Check className="w-5 h-5" />
          ) : (
            <Copy className="w-5 h-5" />
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-300" />

        {/* Leave Call */}
        <button
          onClick={handleLeaveRoom}
          className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all duration-200"
          title="Leave meeting"
        >
          <Phone className="w-5 h-5 transform rotate-[135deg]" />
        </button>
      </div>
    </div>
  );
};

export default ControlBar;