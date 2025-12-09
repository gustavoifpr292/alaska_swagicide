import { Router } from "express";
import { obterParametros, cadastrarParametro, obterParametro, editarParametro, excluirParametro } from "../controllers/controllerParametros.js";
import { authMiddleware, isUser, isTypeUser, isInstitution } from "../middleware/middleware.js";

const rota = Router();

rota.get('/parametros/', authMiddleware, obterParametros);
rota.post('/parametros/', authMiddleware, isTypeUser, cadastrarParametro);

rota.get('/parametros/:id', authMiddleware, isInstitution, obterParametro);
rota.put('/parametros/:id', authMiddleware, isTypeUser, isInstitution, editarParametro); //implementar algo tipo "isAdmin" / funçao generica que verifica se o usuario tem acesso a resposta final
rota.delete('/parametros/:id', authMiddleware, isTypeUser, isInstitution, excluirParametro); //mesma coisa

export default rota;