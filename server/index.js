const fastify = require("fastify")({ logger: true });
const socketIo = require("fastify-socket.io");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const PORT = process.env.PORT || 3001;
const API_BASE_URL = process.env.BACKEND_SERVER;

// Register CORS plugin with appropriate settings
// fastify.register(require("@fastify/cors"), {
//   origin: "*",
//   credentials: true,
//   methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'x-token', 'x-otp-method', 'x-otp-code'],
//   exposedHeaders: ['Content-Type', 'Authorization', 'x-token'],
//   accessControlAllowOrigin: ['https://dofe.ayozat.co.uk/', 'localhost:3000'],
// });

fastify.register(require('@fastify/cors'));

// Static files serving from build directory
// fastify.register(require('@fastify/static'), {
//   root: path.join(__dirname, '..', 'build'),
//   prefix: '/'
// });

// Register socket.io plugin
fastify.register(socketIo, {
 cors: {
      origin: "http://localhost:3000", // your client URL
      methods: ["GET", "POST"]
   }
});

// Define a route for notifications
// fastify.post("/notify-new-messages", async (request, reply) => {
//   const { payperviewId, token } = request.body;
//   if (!payperviewId) {
//     return reply.status(400).send({ message: "payperviewId is required" });
//   }
//   try {
//     const messages = await fetchMessages(payperviewId, token);
//     fastify.io.to(`room-${payperviewId}`).emit("updateMessages", messages.data);
//     return reply.send({ message: "Data updated successfully." });
//   } catch (error) {
//     fastify.log.error("Error fetching messages:", error);
//     return reply.status(500).send({ message: "Failed to fetch messages." });
//   }
// });

fastify.get('/', async (request, reply) => {
  return reply.status(200).send({message: "Server ready"});
})

// WebSocket setup
fastify.ready((err) => {
  if (err) throw err;

  fastify.io.on("connection", (socket) => {
    fastify.log.info("A user connected");

    socket.on("joinRoom", async ({ payperviewId, token }) => {
      console.log("Request to join room", { payperviewId, token });
      socket.join(`room-${payperviewId}`);
      try {
        const messages = await fetchMessages(payperviewId, token);
        socket.emit("updateMessages", { data: messages, firstRender: true });
      } catch (error) {
        fastify.log.error("Error fetching messages:", error);
      }
    });

    socket.on("send-message", async ({ payperviewId, message, token }) => {
      try {
        console.log("Request to send message", { payperviewId, message, token });

        const res = await sendMessage(payperviewId, {message}, token);
        fastify.io
          .to(`room-${payperviewId}`)
          .emit("updateMessages", { data: res, firstRender: false });
      } catch (error) {
        fastify.log.error("Error sending message:", error);
      }
    });

    socket.on("chat-onChange", ({ payperviewId, onChange, userId }) => {
      console.log("Request to typing---", { payperviewId, onChange, userId });
      try {
        fastify.io
          .to(`room-${payperviewId}`)
          .emit("chat-onChangeReceive", { onChange, userId });
      } catch (error) {
        fastify.log.error("Error sending message:", error);
      }
    });
    socket.on("disconnect", () => {
      fastify.log.info("User disconnected");
    });
  });
});

// Function to fetch messages
async function fetchMessages(payperviewId, token) {
  console.log("Send request to fetch messages from server", { payperviewId, token });
  const config = {
    headers: { Authorization: `Bearer ${token}` },
  };
  const response = await axios.get(
    `${API_BASE_URL}/ppv/${payperviewId}/messages`,
    config
  );
  // console.log(response.data);
  return response.data;
}

// Function to send a message
async function sendMessage(payperviewId, data, token) {
  console.log("Send request to send message to server", { payperviewId, data, token });
  const config = {
    headers: { Authorization: `Bearer ${token}` },
  };
  const response = await axios.post(
    `${API_BASE_URL}/ppv/${payperviewId}/message`,
    data,
    config
  );
  // console.log(response);
  return response.data;
}

// Start the server
fastify.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server listening on ${address}`);
});
