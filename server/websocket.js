const fastify = require("fastify")({ logger: true });
const path = require("path");
const axios = require("axios");
const WebSocket = require('ws');
require("dotenv").config();

const PORT = process.env.PORT || 3001;
const API_BASE_URL = process.env.BACKEND_SERVER;

if (!API_BASE_URL) {
  throw new Error("Environment variable BACKEND_SERVER is required.");
}

// Register CORS plugin with appropriate settings
fastify.register(require("@fastify/cors"), {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    console.log("origin: " + origin);
    // List of allowed origins
    const allowedOrigins = ['https://dofe.ayozat.co.uk/', '*'];
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
});

// Define a route for notifications
fastify.post("/notify-new-messages", async (request, reply) => {
  const { payperviewId, token } = request.body;
  if (!payperviewId) {
    return reply.status(400).send({ message: "payperviewId is required" });
  }
  try {
    const messages = await fetchMessages(payperviewId, token);
    broadcastToRoom(`room-${payperviewId}`, "updateMessages", messages.data);
    return reply.send({ message: "Data updated successfully." });
  } catch (error) {
    fastify.log.error("Error fetching messages:", error);
    return reply.status(500).send({ message: "Failed to fetch messages." });
  }
});

// Function to fetch messages
async function fetchMessages(payperviewId, token) {
  const config = {
    headers: { Authorization: `Bearer ${token}` },
  };
  const response = await axios.get(
    `${API_BASE_URL}/ppv/${payperviewId}/messages`,
    config
  );
  return response.data;
}

// Function to send a message
async function sendMessage(payperviewId, data, token) {
  const config = {
    headers: { Authorization: `Bearer ${token}` },
  };
  const response = await axios.post(
    `${API_BASE_URL}/ppv/${payperviewId}/message`,
    data,
    config
  );
  return response.data;
}

// Function to broadcast messages to all clients in a room
function broadcastToRoom(room, event, data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.rooms && client.rooms.has(room)) {
      client.send(JSON.stringify({ event, data }));
    }
  });
}

// Start the server
const startServer = async () => {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    fastify.log.info(`Server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
startServer();

// Setup WebSocket server
const wss = new WebSocket.Server({ server: fastify.server });

wss.on('connection', (socket) => {
  fastify.log.info("A user connected");

  socket.rooms = new Set();

  socket.on('message', async (message) => {
    fastify.log.info("Received message: " + message);
    const parsedMessage = JSON.parse(message);
    const { event, data } = parsedMessage;

    if (event === 'joinRoom') {
      const { payperviewId, token } = data;
      socket.rooms.add(`room-${payperviewId}`);
      try {
        const messages = await fetchMessages(payperviewId, token);
        socket.send(JSON.stringify({ event: 'updateMessages', data: { data: messages, firstRender: true } }));
      } catch (error) {
        fastify.log.error("Error fetching messages:", error);
      }
    }

    if (event === 'send-message') {
      const { payperviewId, message, token } = data;
      try {
        console.log({ payperviewId, message, token });
        const res = await sendMessage(payperviewId, { message }, token);
        broadcastToRoom(`room-${payperviewId}`, 'updateMessages', { data: res, firstRender: false });
      } catch (error) {
        fastify.log.error("Error sending message:", error);
      }
    }

    if (event === 'chat-onChange') {
      const { payperviewId, onChange, userId } = data;
      try {
        broadcastToRoom(`room-${payperviewId}`, 'chat-onChangeReceive', { onChange, userId });
        console.log("typing---", { payperviewId, onChange, userId });
      } catch (error) {
        fastify.log.error("Error sending message:", error);
      }
    }
  });

  socket.on('close', () => {
    fastify.log.info("User disconnected");
  });
});
