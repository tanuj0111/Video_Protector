const express = require("express");
const cors = require("cors");
const videoRoutes = require("./routes/video");
const adminRoutes = require("./routes/admin");

const app = express();

// Phone aur PC dono se allow karo
app.use(cors({
  origin: "*", // Local network ke liye sab allow
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Authorization", "Content-Type"],
}));

app.use(express.json());
app.use("/api/video", videoRoutes);
app.use("/api/admin", adminRoutes);

// 0.0.0.0 — sirf localhost nahi, network pe bhi sunna hai
const PORT = 5001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Network: http://<YOUR-IP>:${PORT}`);
});