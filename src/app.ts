import express from "express";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "Backend running successfully" });
});

export default app;
