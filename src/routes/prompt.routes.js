import { Router } from "express";
import { 
    createPrompt, 
    getAllPrompts, 
    getPromptById, 
    deletePrompt, 
    makePromptPublic, 
    publicPrompts 
} from "../controllers/prompt.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

// Public routes
router.route("/public-prompts").get(publicPrompts);

// Protected routes (require login)
router.route("/create-prompt").post(verifyJWT, createPrompt);
router.route("/get-prompts").get(verifyJWT, getAllPrompts);
router.route("/get-prompt/:id").get(verifyJWT, getPromptById);
router.route("/delete-prompt/:id").delete(verifyJWT, deletePrompt);
router.route("/make-public/:id").patch(verifyJWT, makePromptPublic);

export default router;