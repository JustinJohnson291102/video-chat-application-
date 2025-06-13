import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: Date;
}

interface VideoState {
  localStream: MediaStream | null;
  participants: Participant[];
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  roomId: string | null;
  chatMessages: ChatMessage[];
  socket: Socket | null;
}

type VideoAction =
  | { type: 'SET_LOCAL_STREAM'; payload: MediaStream | null }
  | { type: 'TOGGLE_AUDIO' }
  | { type: 'TOGGLE_VIDEO' }
  | { type: 'TOGGLE_SCREEN_SHARE' }
  | { type: 'SET_ROOM_ID'; payload: string }
  | { type: 'ADD_PARTICIPANT'; payload: Participant }
  | { type: 'REMOVE_PARTICIPANT'; payload: string }
  | { type: 'UPDATE_PARTICIPANT'; payload: { id: string; updates: Partial<Participant> } }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'DELETE_CHAT_MESSAGE'; payload: string }
  | { type: 'SET_SOCKET'; payload: Socket | null }
  | { type: 'CLEAR_ROOM' };

const initialState: VideoState = {
  localStream: null,
  participants: [],
  isAudioEnabled: true,
  isVideoEnabled: true,
  isScreenSharing: false,
  roomId: null,
  chatMessages: [],
  socket: null
};

const videoReducer = (state: VideoState, action: VideoAction): VideoState => {
  switch (action.type) {
    case 'SET_LOCAL_STREAM':
      return { ...state, localStream: action.payload };
    case 'TOGGLE_AUDIO':
      if (state.localStream) {
        state.localStream.getAudioTracks().forEach(track => {
          track.enabled = !state.isAudioEnabled;
        });
      }
      return { ...state, isAudioEnabled: !state.isAudioEnabled };
    case 'TOGGLE_VIDEO':
      if (state.localStream) {
        state.localStream.getVideoTracks().forEach(track => {
          track.enabled = !state.isVideoEnabled;
        });
      }
      return { ...state, isVideoEnabled: !state.isVideoEnabled };
    case 'TOGGLE_SCREEN_SHARE':
      return { ...state, isScreenSharing: !state.isScreenSharing };
    case 'SET_ROOM_ID':
      return { ...state, roomId: action.payload };
    case 'ADD_PARTICIPANT':
      return { ...state, participants: [...state.participants, action.payload] };
    case 'REMOVE_PARTICIPANT':
      return { 
        ...state, 
        participants: state.participants.filter(p => p.id !== action.payload) 
      };
    case 'UPDATE_PARTICIPANT':
      return {
        ...state,
        participants: state.participants.map(p =>
          p.id === action.payload.id ? { ...p, ...action.payload.updates } : p
        )
      };
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatMessages: [...state.chatMessages, action.payload] };
    case 'DELETE_CHAT_MESSAGE':
      return { ...state, chatMessages: state.chatMessages.filter(msg => msg.id !== action.payload) };
    case 'SET_SOCKET':
      return { ...state, socket: action.payload };
    case 'CLEAR_ROOM':
      return { ...initialState, socket: state.socket };
    default:
      return state;
  }
};

interface VideoContextType {
  state: VideoState;
  dispatch: React.Dispatch<VideoAction>;
  initializeMedia: () => Promise<void>;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  sendChatMessage: (message: string) => void;
  deleteChatMessage: (id: string) => void;
  shareScreen: () => Promise<void>;
}

const VideoContext = createContext<VideoContextType | undefined>(undefined);

export const useVideo = () => {
  const context = useContext(VideoContext);
  if (context === undefined) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
};

interface VideoProviderProps {
  children: ReactNode;
}

export const VideoProvider: React.FC<VideoProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(videoReducer, initialState);

  useEffect(() => {
    // Initialize socket connection
    const socket = io('ws://localhost:3001', {
      transports: ['websocket'],
      autoConnect: false
    });

    dispatch({ type: 'SET_SOCKET', payload: socket });

    return () => {
      socket.disconnect();
    };
  }, []);

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      dispatch({ type: 'SET_LOCAL_STREAM', payload: stream });
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  };

  const joinRoom = (roomId: string) => {
    if (state.socket) {
      state.socket.connect();
      state.socket.emit('join-room', roomId);
      dispatch({ type: 'SET_ROOM_ID', payload: roomId });
    }
  };

  const leaveRoom = () => {
    if (state.socket && state.roomId) {
      state.socket.emit('leave-room', state.roomId);
      state.socket.disconnect();
    }
    
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
    }
    
    dispatch({ type: 'CLEAR_ROOM' });
  };

  const sendChatMessage = (message: string) => {
    if (state.socket && state.roomId) {
      const chatMessage: ChatMessage = {
        id: Date.now().toString(),
        senderId: 'current-user',
        senderName: 'You',
        message,
        timestamp: new Date()
      };
      
      state.socket.emit('chat-message', { roomId: state.roomId, message: chatMessage });
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: chatMessage });
    }
  };

  const deleteChatMessage = (id: string) => {
    dispatch({ type: 'DELETE_CHAT_MESSAGE', payload: id });
  };

  const shareScreen = async () => {
    try {
      if (state.isScreenSharing) {
        // Stop screen sharing and return to camera
        await initializeMedia();
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        dispatch({ type: 'SET_LOCAL_STREAM', payload: screenStream });
      }
      dispatch({ type: 'TOGGLE_SCREEN_SHARE' });
    } catch (error) {
      console.error('Error sharing screen:', error);
    }
  };

  const value = {
    state,
    dispatch,
    initializeMedia,
    joinRoom,
    leaveRoom,
    sendChatMessage,
    deleteChatMessage,
    shareScreen
  };

  return (
    <VideoContext.Provider value={value}>
      {children}
    </VideoContext.Provider>
  );
};
