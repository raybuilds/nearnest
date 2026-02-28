require("dotenv").config();
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

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "NearNest Backend Running" });
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
