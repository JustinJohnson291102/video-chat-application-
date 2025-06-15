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
  const localStreamRef = useRef<MediaStream | null>(null);

  // WebRTC configuration with better STUN servers
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' }
    ],
    iceCandidatePoolSize: 10
  };

  useEffect(() => {
    // Get server URL
    const getServerUrl = () => {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001';
      }
      return `http://${hostname}:3001`;
    };

    const socket = io(getServerUrl(), {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      forceNew: true,
      timeout: 20000
    });

    socket.on('connect', () => {
      console.log('✅ Connected to server');
      dispatch({ type: 'SET_CONNECTED', payload: true });
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      dispatch({ type: 'SET_CONNECTED', payload: false });
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      dispatch({ type: 'SET_CONNECTED', payload: false });
    });

    // Handle existing participants (when you join a room)
    socket.on('existing-participants', async (participants: Participant[]) => {
      console.log('👥 Existing participants:', participants);
      for (const participant of participants) {
        dispatch({ type: 'ADD_PARTICIPANT', payload: participant });
        // Create peer connection and send offer to existing participants
        await createPeerConnection(participant.id, true);
      }
    });

    // Handle new user joining (when someone else joins)
    socket.on('user-joined', async (participant: Participant) => {
      console.log('👋 User joined:', participant);
      dispatch({ type: 'ADD_PARTICIPANT', payload: participant });
      // Create peer connection but don't send offer (they will send to us)
      await createPeerConnection(participant.id, false);
    });

    // Handle user leaving
    socket.on('user-left', (userId: string) => {
      console.log('👋 User left:', userId);
      dispatch({ type: 'REMOVE_PARTICIPANT', payload: userId });
      
      // Close and remove peer connection
      const peerConnection = peerConnections.current.get(userId);
      if (peerConnection) {
        peerConnection.close();
        peerConnections.current.delete(userId);
      }
    });

    // Handle WebRTC signaling
    socket.on('offer', async ({ sender, offer }) => {
      console.log('📞 Received offer from:', sender);
      try {
        const peerConnection = peerConnections.current.get(sender);
        if (peerConnection && peerConnection.signalingState !== 'closed') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          socket.emit('answer', { target: sender, answer });
          console.log('📞 Sent answer to:', sender);
        }
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    socket.on('answer', async ({ sender, answer }) => {
      console.log('📞 Received answer from:', sender);
      try {
        const peerConnection = peerConnections.current.get(sender);
        if (peerConnection && peerConnection.signalingState !== 'closed') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('📞 Set remote description for:', sender);
        }
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });

    socket.on('ice-candidate', async ({ sender, candidate }) => {
      try {
        const peerConnection = peerConnections.current.get(sender);
        if (peerConnection && peerConnection.connectionState !== 'closed') {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
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
      peerConnections.current.forEach(pc => {
        if (pc.connectionState !== 'closed') {
          pc.close();
        }
      });
      peerConnections.current.clear();
      socket.disconnect();
    };
  }, []);

  const createPeerConnection = async (participantId: string, shouldCreateOffer: boolean) => {
    try {
      console.log(`🔗 Creating peer connection with ${participantId}, shouldCreateOffer: ${shouldCreateOffer}`);
      
      const peerConnection = new RTCPeerConnection(rtcConfig);
      peerConnections.current.set(participantId, peerConnection);

      // Add local stream tracks to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          console.log(`➕ Adding track to peer connection: ${track.kind}`);
          peerConnection.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle incoming remote stream
      peerConnection.ontrack = (event) => {
        console.log(`🎥 Received remote stream from ${participantId}:`, event.streams[0]);
        const [remoteStream] = event.streams;
        dispatch({
          type: 'UPDATE_PARTICIPANT',
          payload: { id: participantId, updates: { stream: remoteStream } }
        });
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && state.socket) {
          console.log(`🧊 Sending ICE candidate to ${participantId}`);
          state.socket.emit('ice-candidate', {
            target: participantId,
            candidate: event.candidate
          });
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log(`🔗 Connection state with ${participantId}:`, peerConnection.connectionState);
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log(`🧊 ICE connection state with ${participantId}:`, peerConnection.iceConnectionState);
      };

      // Create and send offer if we should initiate
      if (shouldCreateOffer) {
        console.log(`📞 Creating offer for ${participantId}`);
        const offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await peerConnection.setLocalDescription(offer);
        
        if (state.socket) {
          state.socket.emit('offer', { target: participantId, offer });
          console.log(`📞 Sent offer to ${participantId}`);
        }
      }

    } catch (error) {
      console.error(`Error creating peer connection with ${participantId}:`, error);
    }
  };

  const initializeMedia = async () => {
    try {
      console.log('🎥 Initializing media...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      localStreamRef.current = stream;
      dispatch({ type: 'SET_LOCAL_STREAM', payload: stream });
      console.log('✅ Media initialized successfully');
      
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      // Try with basic constraints
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        localStreamRef.current = stream;
        dispatch({ type: 'SET_LOCAL_STREAM', payload: stream });
        console.log('✅ Media initialized with basic constraints');
      } catch (fallbackError) {
        console.error('❌ Fallback media access failed:', fallbackError);
      }
    }
  };

  const joinRoom = (roomId: string, userName: string) => {
    console.log(`🚪 Joining room ${roomId} as ${userName}`);
    if (state.socket) {
      state.socket.connect();
      state.socket.emit('join-room', { roomId, userName });
      dispatch({ type: 'SET_ROOM_ID', payload: roomId });
    }
  };

  const leaveRoom = () => {
    console.log('🚪 Leaving room...');
    if (state.socket && state.roomId) {
      state.socket.emit('leave-room');
      state.socket.disconnect();
    }
    
    // Clean up peer connections
    peerConnections.current.forEach(pc => {
      if (pc.connectionState !== 'closed') {
        pc.close();
      }
    });
    peerConnections.current.clear();
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
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
        localStreamRef.current = screenStream;
        dispatch({ type: 'SET_LOCAL_STREAM', payload: screenStream });
      }
      dispatch({ type: 'TOGGLE_SCREEN_SHARE' });
    } catch (error) {
      console.error('Error sharing screen:', error);
    }
  };

  // Update peer connections when local stream changes
  useEffect(() => {
    if (localStreamRef.current) {
      console.log('🔄 Updating peer connections with new local stream');
      peerConnections.current.forEach((peerConnection, participantId) => {
        // Remove old tracks
        const senders = peerConnection.getSenders();
        senders.forEach(sender => {
          if (sender.track) {
            peerConnection.removeTrack(sender);
          }
        });
        
        // Add new tracks
        localStreamRef.current!.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStreamRef.current!);
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