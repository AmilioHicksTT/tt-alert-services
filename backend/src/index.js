require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { initFirebase } = require('./config/firebase');
const { startScrapers } = require('./scrapers');

const alertsRouter = require('./routes/alerts');
const reportsRouter = require('./routes/reports');
const transportRouter = require('./routes/transport');
const usersRouter = require('./routes/users');
const areaRouter = require('./routes/area');
const uploadRouter = require('./routes/upload');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Make io available across the app
app.set('io', io);

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Routes
app.use('/api/alerts', alertsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/transport', transportRouter);
app.use('/api/users', usersRouter);
app.use('/api/area', areaRouter);
app.use('/api/upload', uploadRouter);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// WebSocket: clients subscribe to area alerts
io.on('connection', (socket) => {
  socket.on('subscribe:area', (districtCode) => {
    socket.join(`area:${districtCode}`);
  });

  socket.on('subscribe:all', () => {
    socket.join('alerts:all');
  });

  socket.on('disconnect', () => {});
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  await connectDB();
  await connectRedis();
  initFirebase();
  startScrapers();

  server.listen(PORT, () => {
    console.log(`T&T Alert Services API running on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
