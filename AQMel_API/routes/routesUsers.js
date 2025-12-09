import { Router } from "express";
import { obterPedidos, obterPedido, aprovarPedido, reprovarPedido, obterUsuarios, obterUsuario, editarUsuario, excluirUsuario, associarApicultorFazenda, desligarApicultorFazenda, associarUsuarioInstituicao, desassociarUsuarioInstituicao, obterApicultores, obterPesquisadores, contarUsuarios, obterInstituicoesUsuarioAPI, obterUsuarioPorUsername } from "../controllers/controllerUsers.js";
import { authMiddleware, isUser, isTypeUser, isInstitution } from "../middleware/middleware.js";

const rota = Router();

rota.get('/usuarios/', authMiddleware, isTypeUser, obterUsuarios);
rota.get('/usuarios/apicultores', authMiddleware, isTypeUser, obterApicultores);
rota.get('/usuarios/pesquisadores', authMiddleware, isTypeUser, obterPesquisadores);
rota.get('/usuarios/count', authMiddleware, isTypeUser, contarUsuarios);

rota.get('/usuarios/username/:username', authMiddleware, isTypeUser, isInstitution, obterUsuarioPorUsername);
rota.get('/usuarios/:id', authMiddleware, isTypeUser, isInstitution, obterUsuario);
rota.put('/usuarios/:id', authMiddleware, isTypeUser, isInstitution, editarUsuario);
rota.delete('/usuarios/:id', authMiddleware, isTypeUser, isInstitution, excluirUsuario);

rota.post('/usuarios/:idApicultor/fazendas/associar/:idFazenda', authMiddleware, isTypeUser, isInstitution, associarApicultorFazenda);
rota.post('/usuarios/:idApicultor/fazendas/desassociar/:idFazenda', authMiddleware, isTypeUser, isInstitution, desligarApicultorFazenda);

rota.get('/usuarios/:id/instituicoes/', authMiddleware, isTypeUser, obterInstituicoesUsuarioAPI);
rota.post('/usuarios/:idUsuario/instituicoes/associar/:idInstituicao', authMiddleware, isTypeUser, associarUsuarioInstituicao);
rota.post('/usuarios/:idUsuario/instituicoes/desassociar/:idInstituicao', authMiddleware, isTypeUser, desassociarUsuarioInstituicao);

rota.get('/pedidos/', authMiddleware, isTypeUser, obterPedidos);

rota.get('/pedidos/:id', authMiddleware, isTypeUser, isInstitution, obterPedido); 
rota.post('/pedidos/aprovar/:id', authMiddleware, isTypeUser, isInstitution, aprovarPedido);
rota.post('/pedidos/reprovar/:id', authMiddleware, isTypeUser, isInstitution, reprovarPedido);

export default rota;