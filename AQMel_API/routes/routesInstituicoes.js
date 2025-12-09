import { Router } from "express";
import { obterInstituicoes, cadastrarInstituicao, obterInstituicao, editarInstituicao, excluirInstituicao, contarInstituicoes } from "../controllers/controllerInstituicoes.js";
import { authMiddleware, isTypeUser } from "../middleware/middleware.js";

const rota = Router();

rota.get('/instituicoes/', authMiddleware, isTypeUser, obterInstituicoes);
rota.get('/instituicoes/count', authMiddleware, isTypeUser, contarInstituicoes);
rota.post('/instituicoes/', authMiddleware, isTypeUser, cadastrarInstituicao);

rota.get('/instituicoes/:id', authMiddleware, isTypeUser, obterInstituicao);
rota.put('/instituicoes/:id', authMiddleware, isTypeUser, editarInstituicao);
rota.delete('/instituicoes/:id', authMiddleware, isTypeUser, excluirInstituicao);

export default rota;