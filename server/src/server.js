import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import { connectDB } from './config/database.js';
import boardRoutes from './routes/boardRoutes.js';
import { setupBoardSocket } from './sockets/boardSocket.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for seamless hackathon testing and dev
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api', boardRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Real-Time Multi-Party Whiteboard OT Server',
    status: 'online',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// Create HTTP Server & Socket.IO
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 30000,
  pingInterval: 25000,
});

// Setup WebSockets
setupBoardSocket(io);

// Start Server
async function startServer() {
  await connectDB();

  httpServer.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Whiteboard OT Server running at http://localhost:${PORT}`);
    console.log(`📡 WebSocket ready on port ${PORT}`);
    console.log(`🎨 Client URL configured: ${CLIENT_URL}`);
    console.log(`=======================================================`);
  });
}

startServer();

export { app, httpServer, io };
