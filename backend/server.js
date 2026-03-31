const express = require("express");
const cors = require("cors");
const path = require("path");
const videoRoutes = require("./routes/video");
const adminRoutes = require("./routes/admin");

const app = express();

// ✅ CORS pehle
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Authorization", "Content-Type"],
}));

app.use(express.json());

// ✅ API routes pehle
app.use("/api/video", videoRoutes);
app.use("/api/admin", adminRoutes);

// ✅ Static + Catch-all SABSE LAST MEIN
// Naya (sahi) - __dirname se relative path
const frontendBuild = path.join(__dirname, "..", "frontend", "build");

app.use(express.static(frontendBuild));
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendBuild, "index.html"));
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});