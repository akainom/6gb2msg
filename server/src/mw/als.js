const { AsyncLocalStorage } = require('node:async_hooks');

const als = new AsyncLocalStorage();

module.exports = { als };