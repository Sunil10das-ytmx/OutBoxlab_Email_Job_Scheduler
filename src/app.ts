import express from "express";
import cors from "cors";
import authRouter from "./modules/auth/auth.routes.js";
import emailRouter from "./modules/emails/email.routes.js";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "Backend running successfully" });
});

app.use("/api/auth", authRouter);
app.use("/auth", authRouter); 

app.use("/api/emails", emailRouter);
app.use("/emails", emailRouter); 

export default app;
