import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import {
  scheduleEmailHandler,
  getScheduledEmails,
  getEmailById,
} from "./email.controller.js";

const emailRouter = Router();

emailRouter.use(authenticate);

emailRouter.post("/schedule", scheduleEmailHandler);

emailRouter.get("/", getScheduledEmails);
emailRouter.get("/:id", getEmailById);

export default emailRouter;
