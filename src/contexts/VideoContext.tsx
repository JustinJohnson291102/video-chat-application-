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
      const newAudioState = !state.isAudioEnabled;
      if (state.localStream) {
        state.localStream.getAudioTracks().forEach(track => {
          track.enabled = newAudioState;
        });
      }
      return { ...state, isAudioEnabled: newAudioState };
    case 'TOGGLE_VIDEO':
      const newVideoState = !state.isVideoEnabled;
      if (state.localStream) {
        state.localStream.getVideoTracks().forEach(track => {
          track.enabled = newVideoState;
        });
      }
      return { ...state, isVideoEnabled: newVideoState };
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
  const socketRef = useRef<Socket | null>(null);

  // Improved WebRTC configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:stun.stunprotocol.org:3478' }
    ],
    iceCandidatePoolSize: 10
  };

  // Initialize socket connection
  useEffect(() => {
    const initializeSocket = () => {
      // Better server URL detection
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const hostname = window.location.hostname;
      let serverUrl;
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        serverUrl = 'http://localhost:3001';
      } else {
        serverUrl = `${protocol}//${hostname}:3001`;
      }

      console.log('🔗 Connecting to server:', serverUrl);

      const socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: false,
        forceNew: true,
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      socketRef.current = socket;
      dispatch({ type: 'SET_SOCKET', payload: socket });

      // Connection events
      socket.on('connect', () => {
        console.log('✅ Connected to server successfully');
        dispatch({ type: 'SET_CONNECTED', payload: true });
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from server:', reason);
        dispatch({ type: 'SET_CONNECTED', payload: false });
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        dispatch({ type: 'SET_CONNECTED', payload: false });
      });

      // Room events
      socket.on('existing-participants', async (participants: Participant[]) => {
        console.log('👥 Existing participants received:', participants.length);
        for (const participant of participants) {
          dispatch({ type: 'ADD_PARTICIPANT', payload: participant });
          await createPeerConnection(participant.id, true);
        }
      });

      socket.on('user-joined', async (participant: Participant) => {
        console.log('👋 New user joined:', participant.name);
        dispatch({ type: 'ADD_PARTICIPANT', payload: participant });
        await createPeerConnection(participant.id, false);
      });

      socket.on('user-left', (userId: string) => {
        console.log('👋 User left:', userId);
        dispatch({ type: 'REMOVE_PARTICIPANT', payload: userId });
        
        const peerConnection = peerConnections.current.get(userId);
        if (peerConnection) {
          peerConnection.close();
          peerConnections.current.delete(userId);
        }
      });

      // WebRTC signaling
      socket.on('offer', async ({ sender, offer }) => {
        console.log('📞 Received offer from:', sender);
        await handleOffer(sender, offer);
      });

      socket.on('answer', async ({ sender, answer }) => {
        console.log('📞 Received answer from:', sender);
        await handleAnswer(sender, answer);
      });

      socket.on('ice-candidate', async ({ sender, candidate }) => {
        console.log('🧊 Received ICE candidate from:', sender);
        await handleIceCandidate(sender, candidate);
      });

      // Media state changes
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

      // Chat messages
      socket.on('chat-message', (message: ChatMessage) => {
        dispatch({ type: 'ADD_CHAT_MESSAGE', payload: message });
      });

      return socket;
    };

    const socket = initializeSocket();

    return () => {
      console.log('🧹 Cleaning up socket and peer connections');
      peerConnections.current.forEach(pc => {
        if (pc.connectionState !== 'closed') {
          pc.close();
        }
      });
      peerConnections.current.clear();
      
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const createPeerConnection = async (participantId: string, shouldCreateOffer: boolean) => {
    try {
      console.log(`🔗 Creating peer connection with ${participantId}`);
      
      const peerConnection = new RTCPeerConnection(rtcConfig);
      peerConnections.current.set(participantId, peerConnection);

      // Add local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          console.log(`➕ Adding ${track.kind} track to peer connection`);
          peerConnection.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle incoming remote stream
      peerConnection.ontrack = (event) => {
        console.log(`🎥 Received remote stream from ${participantId}`);
        const [remoteStream] = event.streams;
        dispatch({
          type: 'UPDATE_PARTICIPANT',
          payload: { id: participantId, updates: { stream: remoteStream } }
        });
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          console.log(`🧊 Sending ICE candidate to ${participantId}`);
          socketRef.current.emit('ice-candidate', {
            target: participantId,
            candidate: event.candidate
          });
        }
      };

      // Connection state monitoring
      peerConnection.onconnectionstatechange = () => {
        console.log(`🔗 Connection state with ${participantId}:`, peerConnection.connectionState);
        if (peerConnection.connectionState === 'failed') {
          console.log(`🔄 Attempting to restart ICE for ${participantId}`);
          peerConnection.restartIce();
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log(`🧊 ICE state with ${participantId}:`, peerConnection.iceConnectionState);
      };

      // Create offer if we should initiate
      if (shouldCreateOffer) {
        await createAndSendOffer(participantId, peerConnection);
      }

    } catch (error) {
      console.error(`❌ Error creating peer connection with ${participantId}:`, error);
    }
  };

  const createAndSendOffer = async (participantId: string, peerConnection: RTCPeerConnection) => {
    try {
      console.log(`📞 Creating offer for ${participantId}`);
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await peerConnection.setLocalDescription(offer);
      
      if (socketRef.current) {
        socketRef.current.emit('offer', { target: participantId, offer });
        console.log(`📞 Offer sent to ${participantId}`);
      }
    } catch (error) {
      console.error(`❌ Error creating offer for ${participantId}:`, error);
    }
  };

  const handleOffer = async (senderId: string, offer: RTCSessionDescriptionInit) => {
    try {
      const peerConnection = peerConnections.current.get(senderId);
      if (!peerConnection || peerConnection.signalingState === 'closed') {
        console.log(`⚠️ No valid peer connection for ${senderId}`);
        return;
      }

      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      if (socketRef.current) {
        socketRef.current.emit('answer', { target: senderId, answer });
        console.log(`📞 Answer sent to ${senderId}`);
      }
    } catch (error) {
      console.error(`❌ Error handling offer from ${senderId}:`, error);
    }
  };

  const handleAnswer = async (senderId: string, answer: RTCSessionDescriptionInit) => {
    try {
      const peerConnection = peerConnections.current.get(senderId);
      if (!peerConnection || peerConnection.signalingState === 'closed') {
        console.log(`⚠️ No valid peer connection for ${senderId}`);
        return;
      }

      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(`✅ Remote description set for ${senderId}`);
    } catch (error) {
      console.error(`❌ Error handling answer from ${senderId}:`, error);
    }
  };

  const handleIceCandidate = async (senderId: string, candidate: RTCIceCandidateInit) => {
    try {
      const peerConnection = peerConnections.current.get(senderId);
      if (!peerConnection || peerConnection.connectionState === 'closed') {
        return;
      }

      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log(`✅ ICE candidate added for ${senderId}`);
    } catch (error) {
      console.error(`❌ Error adding ICE candidate from ${senderId}:`, error);
    }
  };

  const initializeMedia = async () => {
    try {
      console.log('🎥 Requesting media access...');
      
      const constraints = {
        video: { 
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 60 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      localStreamRef.current = stream;
      dispatch({ type: 'SET_LOCAL_STREAM', payload: stream });
      
      console.log('✅ Media initialized successfully');
      console.log(`📹 Video tracks: ${stream.getVideoTracks().length}`);
      console.log(`🎤 Audio tracks: ${stream.getAudioTracks().length}`);
      
    } catch (error) {
      console.error('❌ Error accessing media:', error);
      
      // Fallback with basic constraints
      try {
        console.log('🔄 Trying fallback media constraints...');
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        localStreamRef.current = fallbackStream;
        dispatch({ type: 'SET_LOCAL_STREAM', payload: fallbackStream });
        console.log('✅ Fallback media initialized');
        
      } catch (fallbackError) {
        console.error('❌ Fallback media access failed:', fallbackError);
        alert('Camera and microphone access is required for video calls. Please allow permissions and refresh the page.');
      }
    }
  };

  const joinRoom = (roomId: string, userName: string) => {
    console.log(`🚪 Joining room ${roomId} as ${userName}`);
    
    if (socketRef.current) {
      if (!socketRef.current.connected) {
        socketRef.current.connect();
      }
      
      socketRef.current.emit('join-room', { roomId, userName });
      dispatch({ type: 'SET_ROOM_ID', payload: roomId });
    } else {
      console.error('❌ Socket not available for joining room');
    }
  };

  const leaveRoom = () => {
    console.log('🚪 Leaving room...');
    
    if (socketRef.current && state.roomId) {
      socketRef.current.emit('leave-room');
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
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`🛑 Stopped ${track.kind} track`);
      });
      localStreamRef.current = null;
    }
    
    dispatch({ type: 'CLEAR_ROOM' });
    
    // Navigate back to dashboard
    window.location.href = '/dashboard';
  };

  const sendChatMessage = (message: string) => {
    if (socketRef.current && state.roomId) {
      const chatMessage: ChatMessage = {
        id: Date.now().toString(),
        senderId: 'current-user',
        senderName: 'You',
        message,
        timestamp: new Date()
      };
      
      socketRef.current.emit('chat-message', { roomId: state.roomId, message: chatMessage });
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
        dispatch({ type: 'TOGGLE_SCREEN_SHARE' });
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { 
            cursor: 'always',
            frameRate: { ideal: 30, max: 60 }
          },
          audio: true
        });
        
        localStreamRef.current = screenStream;
        dispatch({ type: 'SET_LOCAL_STREAM', payload: screenStream });
        dispatch({ type: 'TOGGLE_SCREEN_SHARE' });
        
        // Handle screen share end
        screenStream.getVideoTracks()[0].onended = async () => {
          await initializeMedia();
          dispatch({ type: 'TOGGLE_SCREEN_SHARE' });
        };
      }
      
      // Update peer connections with new stream
      updatePeerConnectionStreams();
      
    } catch (error) {
      console.error('❌ Error sharing screen:', error);
    }
  };

  const updatePeerConnectionStreams = () => {
    if (!localStreamRef.current) return;
    
    console.log('🔄 Updating peer connections with new stream');
    
    peerConnections.current.forEach(async (peerConnection, participantId) => {
      try {
        // Remove old tracks
        const senders = peerConnection.getSenders();
        for (const sender of senders) {
          if (sender.track) {
            peerConnection.removeTrack(sender);
          }
        }
        
        // Add new tracks
        localStreamRef.current!.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStreamRef.current!);
        });
        
        // Create new offer to renegotiate
        await createAndSendOffer(participantId, peerConnection);
        
      } catch (error) {
        console.error(`❌ Error updating stream for ${participantId}:`, error);
      }
    });
  };

  // Update peer connections when local stream changes
  useEffect(() => {
    if (localStreamRef.current && peerConnections.current.size > 0) {
      updatePeerConnectionStreams();
    }
  }, [state.localStream]);

  // Notify server about media state changes
  useEffect(() => {
    if (socketRef.current && state.roomId) {
      socketRef.current.emit('toggle-audio', { 
        roomId: state.roomId, 
        audioEnabled: state.isAudioEnabled 
      });
    }
  }, [state.isAudioEnabled]);

  useEffect(() => {
    if (socketRef.current && state.roomId) {
      socketRef.current.emit('toggle-video', { 
        roomId: state.roomId, 
        videoEnabled: state.isVideoEnabled 
      });
    }
  }, [state.isVideoEnabled]);

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