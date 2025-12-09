import { Router } from "express";
import { authMiddleware, registrarUsuario, logarUsuario, alterarSenha, alterarInfosUsuario } from "../middleware/middleware.js";

const router = Router();

router.get("/profile", authMiddleware, (req, res) => {
  res.json(req.user);
});
router.post("/register", registrarUsuario);
router.post("/login", logarUsuario);
router.post("/changeInfo/:id", authMiddleware, alterarInfosUsuario);
router.post("/changePassword/:id", authMiddleware, alterarSenha);
router.post("/logout", authMiddleware, (req, res) => {
  res.json({ 
    success: true, 
    message: "Logout realizado com sucesso" 
  });
});

export default router;