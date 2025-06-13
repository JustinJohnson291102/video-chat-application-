import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, User } from 'lucide-react';

interface VideoPlayerProps {
  stream?: MediaStream;
  name: string;
  isLocal?: boolean;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  stream,
  name,
  isLocal = false,
  audioEnabled = true,
  videoEnabled = true,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative bg-gray-900 rounded-xl overflow-hidden ${className}`}>
      {stream && videoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <User className="w-8 h-8 text-white" />
            </div>
            <p className="text-white font-medium">{name}</p>
          </div>
        </div>
      )}
      
      {/* Status indicators */}
      <div className="absolute bottom-3 left-3 flex gap-2">
        <div className={`p-2 rounded-full ${audioEnabled ? 'bg-green-500' : 'bg-red-500'}`}>
          {audioEnabled ? (
            <Mic className="w-4 h-4 text-white" />
          ) : (
            <MicOff className="w-4 h-4 text-white" />
          )}
        </div>
        <div className={`p-2 rounded-full ${videoEnabled ? 'bg-green-500' : 'bg-red-500'}`}>
          {videoEnabled ? (
            <Video className="w-4 h-4 text-white" />
          ) : (
            <VideoOff className="w-4 h-4 text-white" />
          )}
        </div>
      </div>
      
      {/* Name label */}
      <div className="absolute bottom-3 right-3 bg-black bg-opacity-50 px-3 py-1 rounded-full">
        <p className="text-white text-sm font-medium">{name}</p>
      </div>
    </div>
  );
};

export default VideoPlayer;