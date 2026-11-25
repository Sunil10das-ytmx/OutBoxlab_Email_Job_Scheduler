import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import {
  createSender,
  getSenders,
  updateSender,
  deleteSender,
} from "./sender.controller.js";

const senderRouter = Router();

senderRouter.use(authenticate);

senderRouter.post("/", createSender);
senderRouter.get("/", getSenders);
senderRouter.put("/:id", updateSender);
senderRouter.delete("/:id", deleteSender);

export default senderRouter;
