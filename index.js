require("dotenv").config();
require("./services/intelligence/governanceEventListeners");
const express = require("express");
const cors = require("cors");
const { verifyToken, requireRole } = require("./middlewares/auth");

const authRoutes = require("./routes/auth");
const corridorRoutes = require("./routes/corridor");
const studentRoutes = require("./routes/student");
const unitRoutes = require("./routes/unit");
const complaintRoutes = require("./routes/complaint");
const vdpRoutes = require("./routes/vdp");
const institutionRoutes = require("./routes/institution");
const occupancyRoutes = require("./routes/occupancy");
const shortlistRoutes = require("./routes/shortlist");
const landlordRoutes = require("./routes/landlord");
const dawnRoutes = require("./routes/dawn");
const profileRoutes = require("./routes/profile");
const mediaRoutes = require("./routes/media");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || FRONTEND_ORIGIN)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const LOCAL_ALLOWED_ORIGINS = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);

function isOriginAllowed(origin) {
  if (!origin) return true;

  if (ALLOWED_ORIGINS.length === 0) {
    return LOCAL_ALLOWED_ORIGINS.has(origin);
  }

  return ALLOWED_ORIGINS.includes(origin);
}

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "NearNest Backend Running" });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "nearnest-backend",
    port: PORT,
  });
});

// Auth routes mounted at /auth - must be before /admin middleware
app.use("/auth", authRoutes);

// Admin routes - protected by auth
app.use("/admin", verifyToken, requireRole("admin"));

// Other routes
app.use(corridorRoutes);
app.use(studentRoutes);
app.use(unitRoutes);
app.use(complaintRoutes);
app.use(vdpRoutes);
app.use(institutionRoutes);
app.use(occupancyRoutes);
app.use(shortlistRoutes);
app.use(landlordRoutes);
app.use(dawnRoutes);
app.use(profileRoutes);
app.use(mediaRoutes);

app.use((err, req, res, next) => {
  if (err?.message === "CORS origin not allowed") {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  return next(err);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
