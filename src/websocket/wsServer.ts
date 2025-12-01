import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { prisma } from '../db.js';

let io: SocketServer | null = null;

/**
 * WebSocket event types for type safety
 */
export interface ScrapeEvents {
  'scrape:started': {
    jobId: string;
    targetId: string;
    targetName: string;
  };
  'scrape:progress': {
    jobId: string;
    progress: number;
    message: string;
  };
  'scrape:completed': {
    jobId: string;
    targetId: string;
    postsScraped: number;
  };
  'scrape:failed': {
    jobId: string;
    targetId: string;
    error: string;
  };
}

/**
 * Initialize WebSocket server with the HTTP server
 */
export function initWebSocket(httpServer: HttpServer, corsOrigin: string): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  });

  io.on('connection', async (socket: Socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Get company ID from auth handshake
    const { companyId, token } = socket.handshake.auth;

    if (!companyId || !token) {
      console.log(`[WebSocket] Missing auth data, disconnecting: ${socket.id}`);
      socket.disconnect();
      return;
    }

    // Validate token
    try {
      const authToken = await prisma.authToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!authToken || authToken.expiresAt < new Date()) {
        console.log(`[WebSocket] Invalid/expired token, disconnecting: ${socket.id}`);
        socket.disconnect();
        return;
      }

      // Join company-specific room
      const roomName = `company:${companyId}`;
      socket.join(roomName);
      console.log(`[WebSocket] ${socket.id} joined room: ${roomName}`);

      // Store user info on socket for later use
      socket.data.userId = authToken.userId;
      socket.data.companyId = companyId;
    } catch (error) {
      console.error(`[WebSocket] Auth error:`, error);
      socket.disconnect();
      return;
    }

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  console.log('[WebSocket] Server initialized');
  return io;
}

/**
 * Get the Socket.IO instance
 * @throws Error if WebSocket not initialized
 */
export function getIO(): SocketServer {
  if (!io) {
    throw new Error('WebSocket server not initialized. Call initWebSocket first.');
  }
  return io;
}

/**
 * Emit a scrape event to a specific company room
 */
export function emitToCompany<K extends keyof ScrapeEvents>(
  companyId: string,
  event: K,
  payload: ScrapeEvents[K]
): void {
  const socketIO = getIO();
  const roomName = `company:${companyId}`;
  socketIO.to(roomName).emit(event, payload);
  console.log(`[WebSocket] Emitted ${event} to ${roomName}:`, payload);
}
