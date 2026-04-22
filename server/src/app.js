const express = require('express');
const cookieParser = require('cookie-parser');
const authMiddleware = require('./mw/auth');
const { ApiErrorMiddlewareFunction } = require('./mw/exception');
// require('./passport');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(authMiddleware);

app.use('/auth', require('./routes/auth.routes'));
app.use('/chats', require('./routes/chats.routes'));
app.use('/profiles', require('./routes/profiles.routes'));
app.use('/files', require('./routes/files.routes'));
app.use(ApiErrorMiddlewareFunction);

module.exports = app;