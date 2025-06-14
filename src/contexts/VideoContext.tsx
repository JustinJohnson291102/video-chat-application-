import React, { createContext, useContext, useReducer, useEffect, ReactNode, useRef } from 'react';
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
  isConnected: boolean;
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
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'CLEAR_ROOM' };

const initialState: VideoState = {
  localStream: null,
  participants: [],
  isAudioEnabled: true,
  isVideoEnabled: true,
  isScreenSharing: false,
  roomId: null,
  chatMessages: [],
  socket: null,
  isConnected: false
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
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };
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
  joinRoom: (roomId: string, userName: string) => void;
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
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  // WebRTC configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    // Get server URL - try to detect if we're on mobile
    const getServerUrl = () => {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001';
      }
      // For mobile access, use the same host but port 3001
      return `http://${hostname}:3001`;
    };

    const socket = io(getServerUrl(), {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      forceNew: true
    });

    socket.on('connect', () => {
      console.log('Connected to server');
      dispatch({ type: 'SET_CONNECTED', payload: true });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      dispatch({ type: 'SET_CONNECTED', payload: false });
    });

    // Handle new user joining
    socket.on('user-joined', async (participant: Participant) => {
      console.log('User joined:', participant);
      dispatch({ type: 'ADD_PARTICIPANT', payload: participant });
      
      // Create peer connection for new user
      await createPeerConnection(participant.id, true);
    });

    // Handle existing participants
    socket.on('existing-participants', async (participants: Participant[]) => {
      console.log('Existing participants:', participants);
      for (const participant of participants) {
        dispatch({ type: 'ADD_PARTICIPANT', payload: participant });
        await createPeerConnection(participant.id, false);
      }
    });

    // Handle user leaving
    socket.on('user-left', (userId: string) => {
      console.log('User left:', userId);
      dispatch({ type: 'REMOVE_PARTICIPANT', payload: userId });
      
      // Close peer connection
      const peerConnection = peerConnections.current.get(userId);
      if (peerConnection) {
        peerConnection.close();
        peerConnections.current.delete(userId);
      }
    });

    // Handle WebRTC signaling
    socket.on('offer', async ({ sender, offer }) => {
      console.log('Received offer from:', sender);
      const peerConnection = peerConnections.current.get(sender);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', { target: sender, answer });
      }
    });

    socket.on('answer', async ({ sender, answer }) => {
      console.log('Received answer from:', sender);
      const peerConnection = peerConnections.current.get(sender);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(answer);
      }
    });

    socket.on('ice-candidate', async ({ sender, candidate }) => {
      const peerConnection = peerConnections.current.get(sender);
      if (peerConnection) {
        await peerConnection.addIceCandidate(candidate);
      }
    });

    // Handle media state changes
    socket.on('participant-audio-toggle', ({ participantId, audioEnabled }) => {
      dispatch({ 
        type: 'UPDATE_PARTICIPANT', 
        payload: { id: participantId, updates: { audioEnabled } }
      });
    });

    socket.on('participant-video-toggle', ({ participantId, videoEnabled }) => {
      dispatch({ 
        type: 'UPDATE_PARTICIPANT', 
        payload: { id: participantId, updates: { videoEnabled } }
      });
    });

    // Handle chat messages
    socket.on('chat-message', (message: ChatMessage) => {
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: message });
    });

    dispatch({ type: 'SET_SOCKET', payload: socket });

    return () => {
      // Clean up peer connections
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
      socket.disconnect();
    };
  }, []);

  const createPeerConnection = async (participantId: string, isInitiator: boolean) => {
    const peerConnection = new RTCPeerConnection(rtcConfig);
    peerConnections.current.set(participantId, peerConnection);

    // Add local stream to peer connection
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, state.localStream!);
      });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote stream from:', participantId);
      const [remoteStream] = event.streams;
      dispatch({
        type: 'UPDATE_PARTICIPANT',
        payload: { id: participantId, updates: { stream: remoteStream } }
      });
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && state.socket) {
        state.socket.emit('ice-candidate', {
          target: participantId,
          candidate: event.candidate
        });
      }
    };

    // Create offer if initiator
    if (isInitiator) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      if (state.socket) {
        state.socket.emit('offer', { target: participantId, offer });
      }
    }
  };

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      dispatch({ type: 'SET_LOCAL_STREAM', payload: stream });
      console.log('Media initialized successfully');
    } catch (error) {
      console.error('Error accessing media devices:', error);
      // Try with lower constraints
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        dispatch({ type: 'SET_LOCAL_STREAM', payload: stream });
      } catch (fallbackError) {
        console.error('Fallback media access failed:', fallbackError);
      }
    }
  };

  const joinRoom = (roomId: string, userName: string) => {
    if (state.socket) {
      state.socket.connect();
      state.socket.emit('join-room', { roomId, userName });
      dispatch({ type: 'SET_ROOM_ID', payload: roomId });
    }
  };

  const leaveRoom = () => {
    if (state.socket && state.roomId) {
      state.socket.emit('leave-room');
      state.socket.disconnect();
    }
    
    // Clean up peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    
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

  // Update peer connections when local stream changes
  useEffect(() => {
    if (state.localStream) {
      peerConnections.current.forEach((peerConnection, participantId) => {
        // Remove old tracks
        peerConnection.getSenders().forEach(sender => {
          if (sender.track) {
            peerConnection.removeTrack(sender);
          }
        });
        
        // Add new tracks
        state.localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, state.localStream!);
        });
      });
    }
  }, [state.localStream]);

  // Notify server about media state changes
  useEffect(() => {
    if (state.socket && state.roomId) {
      state.socket.emit('toggle-audio', { 
        roomId: state.roomId, 
        audioEnabled: state.isAudioEnabled 
      });
    }
  }, [state.isAudioEnabled, state.socket, state.roomId]);

  useEffect(() => {
    if (state.socket && state.roomId) {
      state.socket.emit('toggle-video', { 
        roomId: state.roomId, 
        videoEnabled: state.isVideoEnabled 
      });
    }
  }, [state.isVideoEnabled, state.socket, state.roomId]);

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