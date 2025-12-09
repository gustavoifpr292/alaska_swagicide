import { Router } from "express";
import { obterAnalises, cadastrarAnalise, obterAnalise, editarAnalise, excluirAnalise, atribuirParametro, contarAnalises } from "../controllers/controllerAnalises.js";
import { authMiddleware, isUser, isTypeUser, isInstitution } from "../middleware/middleware.js";

const rota = Router();

rota.get('/analises/', authMiddleware, isTypeUser, obterAnalises);
rota.get('/analises/count', authMiddleware, isTypeUser, contarAnalises);
rota.post('/analises/', authMiddleware, isTypeUser, cadastrarAnalise);

rota.get('/analises/:id', authMiddleware, isInstitution, obterAnalise);
rota.put('/analises/:id', authMiddleware, isUser, editarAnalise);
rota.delete('/analises/:id', authMiddleware, isUser, excluirAnalise);

//'/analises/:idAnalise/:idParametro'
rota.post('/analises/:id/:idParametro', authMiddleware, isUser, atribuirParametro);

export default rota;