import { Router } from "express";
import { healthCheck } from "../controllers/healthCheck.controllers.js";

const router = Router();

//GET request
router.route("/").get(healthCheck);

export default router;