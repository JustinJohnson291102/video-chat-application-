import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);

// Enhanced CORS configuration
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Store room information
const rooms = new Map();

// Get local IP address for mobile access
import { networkInterfaces } from 'os';

function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // Join room
  socket.on('join-room', ({ roomId, userName }) => {
    console.log(`🚪 ${userName} (${socket.id}) joining room: ${roomId}`);
    
    socket.join(roomId);
    socket.userName = userName;
    socket.roomId = roomId;

    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }

    const room = rooms.get(roomId);
    room.set(socket.id, {
      id: socket.id,
      name: userName,
      audioEnabled: true,
      videoEnabled: true
    });

    // Send existing participants to the new user first
    const existingParticipants = Array.from(room.values()).filter(p => p.id !== socket.id);
    if (existingParticipants.length > 0) {
      console.log(`📤 Sending ${existingParticipants.length} existing participants to ${userName}`);
      socket.emit('existing-participants', existingParticipants);
    }

    // Then notify others about the new user
    socket.to(roomId).emit('user-joined', {
      id: socket.id,
      name: userName,
      audioEnabled: true,
      videoEnabled: true
    });

    console.log(`👥 Room ${roomId} now has ${room.size} participants`);
  });

  // Handle WebRTC signaling
  socket.on('offer', ({ target, offer }) => {
    console.log(`📞 Relaying offer: ${socket.id} → ${target}`);
    socket.to(target).emit('offer', {
      sender: socket.id,
      offer: offer
    });
  });

  socket.on('answer', ({ target, answer }) => {
    console.log(`📞 Relaying answer: ${socket.id} → ${target}`);
    socket.to(target).emit('answer', {
      sender: socket.id,
      answer: answer
    });
  });

  socket.on('ice-candidate', ({ target, candidate }) => {
    console.log(`🧊 Relaying ICE candidate: ${socket.id} → ${target}`);
    socket.to(target).emit('ice-candidate', {
      sender: socket.id,
      candidate: candidate
    });
  });

  // Handle media state changes
  socket.on('toggle-audio', ({ roomId, audioEnabled }) => {
    console.log(`🎤 ${socket.userName} audio: ${audioEnabled ? 'ON' : 'OFF'}`);
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const participant = room.get(socket.id);
      if (participant) {
        participant.audioEnabled = audioEnabled;
        socket.to(roomId).emit('participant-audio-toggle', {
          participantId: socket.id,
          audioEnabled
        });
      }
    }
  });

  socket.on('toggle-video', ({ roomId, videoEnabled }) => {
    console.log(`📹 ${socket.userName} video: ${videoEnabled ? 'ON' : 'OFF'}`);
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const participant = room.get(socket.id);
      if (participant) {
        participant.videoEnabled = videoEnabled;
        socket.to(roomId).emit('participant-video-toggle', {
          participantId: socket.id,
          videoEnabled
        });
      }
    }
  });

  // Handle chat messages
  socket.on('chat-message', ({ roomId, message }) => {
    console.log(`💬 Chat in room ${roomId} from ${socket.userName}: ${message.message}`);
    socket.to(roomId).emit('chat-message', message);
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`❌ User disconnected: ${socket.id} (${socket.userName}) - Reason: ${reason}`);
    
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      room.delete(socket.id);
      
      // Notify others in the room
      socket.to(socket.roomId).emit('user-left', socket.id);
      
      // Clean up empty rooms
      if (room.size === 0) {
        rooms.delete(socket.roomId);
        console.log(`🗑️ Room ${socket.roomId} deleted (empty)`);
      } else {
        console.log(`👥 Room ${socket.roomId} now has ${room.size} participants`);
      }
    }
  });

  socket.on('leave-room', () => {
    console.log(`🚪 ${socket.userName} leaving room ${socket.roomId}`);
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      room.delete(socket.id);
      socket.to(socket.roomId).emit('user-left', socket.id);
      socket.leave(socket.roomId);
      
      if (room.size === 0) {
        rooms.delete(socket.roomId);
        console.log(`🗑️ Room ${socket.roomId} deleted (empty)`);
      }
    }
  });

  // Handle connection errors
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error);
  });
});

const PORT = process.env.PORT || 3001;
const localIP = getLocalIP();

server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 VideoCall Pro Server Started!');
  console.log(`📱 Local: http://localhost:${PORT}`);
  console.log(`🌐 Network: http://${localIP}:${PORT}`);
  console.log(`📞 Mobile Access: http://${localIP}:3000`);
  console.log('✅ Server ready for video calls');
  console.log('📊 Active rooms:', rooms.size);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});