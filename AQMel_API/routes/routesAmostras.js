import { Router } from "express";
import { obterAmostras, cadastrarAmostra, obterAmostra, editarAmostra, excluirAmostra, contarAmostras } from "../controllers/controllerAmostras.js";
import { authMiddleware, isUser, isTypeUser, isInstitution } from "../middleware/middleware.js";

const rota = Router();

rota.get('/amostras/', authMiddleware, isTypeUser, obterAmostras);
rota.get('/amostras/count', authMiddleware, isTypeUser, contarAmostras);
rota.post('/amostras/', authMiddleware, isTypeUser, cadastrarAmostra);

rota.get('/amostras/:id', authMiddleware, isInstitution, obterAmostra);
rota.put('/amostras/:id', authMiddleware, isUser, editarAmostra);
rota.delete('/amostras/:id', authMiddleware, isUser, excluirAmostra);

export default rota;