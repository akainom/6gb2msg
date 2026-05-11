const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('./passport');
const authMiddleware = require('./mw/auth');
const { ApiErrorMiddlewareFunction } = require('./mw/exception');
const MessageController = require('./controllers/message.controller');
const systemLog = require('./services/systemLog.service');

const app = express();

const corsOptions = {
  origin: process.env.CLIENT_URL ? [process.env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'] : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(authMiddleware);

app.get('/chats/messages/by-ids', MessageController.getByIds.bind(MessageController));

app.use('/auth', require('./routes/auth.routes'));
app.use('/chats', require('./routes/chats.routes'));
app.use('/profiles', require('./routes/profiles.routes'));
app.use('/files', require('./routes/files.routes'));
app.use('/reports', require('./routes/reports.routes'));
app.use('/stats', require('./routes/stats.routes'));
app.use(ApiErrorMiddlewareFunction);

module.exports = app;
