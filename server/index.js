const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
require('dotenv').config();
const cors = require("cors");
// Additional requires for SSR if needed
const API_BASE_URL = process.env.BACKEND_SERVER;

const app = express();
const server = http.createServer(app);
app.use(cors());
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  },
});
const PORT = process.env.PORT || 3001;

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


app.get('/', () => {
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

io.on("connection", (socket) => {
  console.log("---A user connected");
  socket.on("joinRoom", ({ payperviewId, token }) => {
    socket.join(`room-${payperviewId}`);
    fetchMessages(payperviewId, token)
      .then((messages) => {
        const data = {
          data:messages.data,
          firstRender:true
        }
        io.to(`room-${payperviewId}`).emit("updateMessages", data);
      })
      .catch((error) => {
        console.error("Error fetching messages:", error);
      });
    console.log(`---User joined room-${payperviewId}---`);
  });

  socket.on("send-message", ({ payperviewId, message, token }) => {
    const chat = {
      message: message,
    };
    
    sendMessage(payperviewId, chat, token)
      .then((res) => {
        console.log(res);
        const data = {
          data:res.data,
          firstRender:false
        }
        io.to(`room-${payperviewId}`).emit("updateMessages", data);
      })
      .catch((error) => {
        console.error("Error fetching messages:", error);
      });
  });

  socket.on("chat-onChange", ({payperviewId, onChange, userId}) => {
    io.to(`room-${payperviewId}`).emit("chat-onChangeReceive", {onChange, userId});
    console.log("typing---", {payperviewId, onChange, userId});
  })

  socket.on("disconnect", () => {
    console.log("User disconnected---");
  });
});

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});