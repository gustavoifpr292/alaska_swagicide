import { Router } from "express";
import { obterFazendas, cadastrarFazenda, obterFazenda, editarFazenda, excluirFazenda, contarFazendas, obterFazendasProdutor } from "../controllers/controllerFazendas.js";
import { authMiddleware, isTypeUser, isInstitution } from "../middleware/middleware.js";

const rota = Router();

rota.get('/fazendas/', authMiddleware, isTypeUser, obterFazendas);
rota.get('/fazendas/usuario/:id', authMiddleware, isTypeUser, obterFazendasProdutor);
rota.get('/fazendas/count', authMiddleware, isTypeUser, contarFazendas);
rota.post('/fazendas/', authMiddleware, isTypeUser, cadastrarFazenda);

rota.get('/fazendas/:id', authMiddleware, isTypeUser, isInstitution, obterFazenda);
rota.put('/fazendas/:id', authMiddleware, isTypeUser, isInstitution, editarFazenda);
rota.delete('/fazendas/:id', authMiddleware, isTypeUser, isInstitution, excluirFazenda);

export default rota;