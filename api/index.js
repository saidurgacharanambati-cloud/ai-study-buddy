// Vercel Serverless Function entry point
// Forwards incoming requests to the Express application defined in server.js
const app = require('../server');

module.exports = app;
