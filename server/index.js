const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const fastifySocketIo = require('fastify-socket.io');
const cors = require('@fastify/cors');


// Additional requires for SSR if needed
const API_BASE_URL = process.env.BACKEND_SERVER;

const app = express();
const server = http.createServer(app);
app.use(cors());

// Register CORS plugin for Fastify
fastify.register(cors, {
  origin: ["*"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  credentials: true
});

const PORT = process.env.PORT || 3001;

// Register the fastify-socket.io plugin
fastify.register(fastifySocketIo);

app.use(express.json());
app.use(
  express.static(path.resolve(__dirname, "..", "build"), { index: false })
);

// Endpoint for Laravel to call when new data is available
app.post("/notify-new-messages", (req, res) => {
  const { payperviewId, token } = req.body;
  if (!payperviewId) {
    return res.status(400).json({ message: "payperviewId is required" });
  }
  fetchMessages(payperviewId, token)
    .then((messages) => {
      io.to(`room-${payperviewId}`).emit("updateMessages", messages.data);
      res.status(200).json({ message: "Data updated successfully." });
    })
    .catch((error) => {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages." });
    });
});


app.get('/', (req, res) => {
  res.status(200).json({ message: "Hits / endpoints" });
})


function fetchMessages(payperviewId, token) {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
  return axios.get(`${API_BASE_URL}/ppv/${payperviewId}/messages`, config);
}

function sendMessage(payperviewId, data, token) {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
  return axios.post(
    `${API_BASE_URL}/ppv/${payperviewId}/message`,
    data,
    config
  );
}

// Setup WebSocket connections
fastify.ready(err => {
  if (err) throw err;

  fastify.io.on('connection', (socket) => {
    fastify.log.info('---A user connected');
    
    socket.on('joinRoom', async ({ payperviewId, token }) => {
      socket.join(`room-${payperviewId}`);
      try {
        const messages = await fetchMessages(payperviewId, token);
        const data = {
          data: messages.data,
          firstRender: true
        };
        fastify.io.to(`room-${payperviewId}`).emit('updateMessages', data);
      } catch (error) {
        fastify.log.error('Error fetching messages:', error);
      }
      fastify.log.info(`---User joined room-${payperviewId}---`);
    });

    socket.on('send-message', async ({ payperviewId, message, token }) => {
      const chat = {
        message: message
      };

      try {
        const res = await sendMessage(payperviewId, chat, token);
        const data = {
          data: res.data,
          firstRender: false
        };
        fastify.io.to(`room-${payperviewId}`).emit('updateMessages', data);
      } catch (error) {
        fastify.log.error('Error sending message:', error);
      }
    });

    socket.on('chat-onChange', ({ payperviewId, onChange, userId }) => {
      fastify.io.to(`room-${payperviewId}`).emit('chat-onChangeReceive', { onChange, userId });
      fastify.log.info('typing---', { payperviewId, onChange, userId });
    });

    socket.on('disconnect', () => {
      fastify.log.info('User disconnected---');
    });
  });
});

// Start the server
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server listening on ${address}`);
});