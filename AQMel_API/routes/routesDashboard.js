import { Router } from "express";
import { obterDadosDashboard } from "../controllers/controllerDashboard.js";
import { authMiddleware } from "../middleware/middleware.js";

const router = Router();

router.get('/dashboard', authMiddleware, obterDadosDashboard);

export default router;