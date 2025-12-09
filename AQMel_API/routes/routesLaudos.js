import { Router } from "express";
import { obterLaudos, cadastrarLaudo, obterLaudo, editarLaudo, excluirLaudo, atribuirAnalise, desatribuirAnalise, aprovarLaudo, reprovarLaudo, contarLaudos, obterLaudosApicultor } from "../controllers/controllerLaudos.js";
import { authMiddleware, isUser, isTypeUser, isInstitution } from "../middleware/middleware.js";

const rota = Router();

rota.get('/laudos/', authMiddleware, isTypeUser, obterLaudos);
rota.get('/laudos/count', authMiddleware, isTypeUser, contarLaudos);
rota.get('/laudos/apicultor/:id', authMiddleware, obterLaudosApicultor);
rota.post('/laudos/', authMiddleware, isTypeUser, cadastrarLaudo);

rota.get('/laudos/:id', authMiddleware, isInstitution, obterLaudo);
rota.put('/laudos/:id', authMiddleware, isUser, editarLaudo);
rota.delete('/laudos/:id', authMiddleware, isUser, excluirLaudo);

//'/laudos/:idLaudo/:idAnalise'
rota.post('/laudos/:id/:id2', authMiddleware, isUser, atribuirAnalise);
rota.delete('/laudos/:id/:id2', authMiddleware, isUser, desatribuirAnalise);

rota.post('/laudos/revisao/aprovar/:id', authMiddleware, isTypeUser, aprovarLaudo);
rota.post('/laudos/revisao/reprovar/:id', authMiddleware, isTypeUser, reprovarLaudo);

export default rota;