import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Server as SocketIOServer } from 'socket.io';
import { connectDB } from './config/database.js';
import boardRoutes from './routes/boardRoutes.js';
import { setupBoardSocket } from './sockets/boardSocket.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Resolve possible client build paths
const candidatePaths = [
  process.env.CLIENT_DIST_PATH,
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../public'),
  path.resolve(__dirname, '../../public'),
].filter(Boolean);

const clientDistPath = candidatePaths.find((p) => fs.existsSync(p));

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for seamless cross-platform deployment
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api', boardRoutes);

// Static client assets & SPA routing fallback for React Router
if (clientDistPath) {
  console.log(`📦 Serving static client build from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  // Root route fallback when client build is not co-located
  app.get('/', (req, res) => {
    res.json({
      name: 'Real-Time Multi-Party Whiteboard OT Server',
      status: 'online',
      version: '1.0.0',
      clientConfigured: CLIENT_URL,
      documentation: '/api/health',
      note: 'Client build not found in server bundle. Serve client separately or run `npm run build` at root.',
    });
  });
}

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

  httpServer.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Whiteboard OT Server running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`📡 WebSocket ready on port ${PORT}`);
    console.log(`🎨 Client URL configured: ${CLIENT_URL}`);
    console.log(`📦 Static Frontend: ${clientDistPath ? 'ACTIVE (' + clientDistPath + ')' : 'STANDALONE API'}`);
    console.log(`=======================================================`);
  });
}

// Graceful shutdown handling for Docker, Kubernetes, Render, Railway, Fly.io
const shutdown = (signal) => {
  console.log(`🛑 Received ${signal}, closing server gracefully...`);
  httpServer.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forcefully terminating server.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();

export { app, httpServer, io };

