import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/environment';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { authRoutes } from './routes/auth';
import { protocolRoutes } from './routes/protocol';
import { vaultRoutes } from './routes/vault';
import { stakingRoutes } from './routes/staking';
import { analyticsRoutes } from './routes/analytics';
import { webhookRoutes } from './routes/webhooks';
import { swaggerSpec } from './config/swagger';
import { initializeWebSocket } from './websocket/handler';
import { startBackgroundJobs } from './jobs';
import { initializeBlockchainService } from './services/blockchain';

class CataklismAPI {
  private app: express.Application;
  private server: any;
  private io: Server;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: config.CORS_ORIGIN,
        methods: ['GET', 'POST']
      }
    });
  }

  private async setupMiddleware(): Promise<void> {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https:"],
          scriptSrc: ["'self'", "https:"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    }));

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    this.app.use(morgan('combined', {
      stream: { write: (message) => logger.info(message.trim()) }
    }));

    // Rate limiting
    this.app.use(rateLimiter);
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.NODE_ENV
      });
    });

    // API Documentation
    this.app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    // API Routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/protocol', protocolRoutes);
    this.app.use('/api/vault', vaultRoutes);
    this.app.use('/api/staking', stakingRoutes);
    this.app.use('/api/analytics', analyticsRoutes);
    this.app.use('/api/webhooks', webhookRoutes);

    // Error handling
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  private async initializeServices(): Promise<void> {
    try {
      // Connect to database
      await connectDatabase();
      logger.info('Database connected successfully');

      // Initialize blockchain service
      await initializeBlockchainService();
      logger.info('Blockchain service initialized');

      // Initialize WebSocket handlers
      initializeWebSocket(this.io);
      logger.info('WebSocket handlers initialized');

      // Start background jobs
      await startBackgroundJobs();
      logger.info('Background jobs started');

    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    try {
      await this.setupMiddleware();
      this.setupRoutes();
      await this.initializeServices();

      const port = config.PORT || 3001;

      this.server.listen(port, () => {
        logger.info(`🚀 Cataklism Protocol API started on port ${port}`);
        logger.info(`📚 API Documentation: http://localhost:${port}/api/docs`);
        logger.info(`🔧 Environment: ${config.NODE_ENV}`);
      });

      // Graceful shutdown
      process.on('SIGTERM', this.shutdown.bind(this));
      process.on('SIGINT', this.shutdown.bind(this));

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    logger.info('Received shutdown signal, closing server...');

    this.server.close(() => {
      logger.info('Server closed successfully');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Could not close server gracefully, forcing shutdown');
      process.exit(1);
    }, 10000);
  }
}

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
const api = new CataklismAPI();
api.start().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

export default CataklismAPI;
