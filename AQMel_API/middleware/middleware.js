import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db from "../db/firebase.js";
import { getDocs, getDoc, doc, query, collection, where, setDoc, updateDoc } from "firebase/firestore";
import { obterFazendasApicultor, obterInstituicoesUsuario } from "../controllers/controllerUsers.js";
import { obterInstituicoesInterno } from "../controllers/controllerInstituicoes.js";

export function authMiddleware(req, res, next) {
    if (req.headers["nologinauth"]) {
      req.authorized = 1;
      return next();
    }
    const authHeader = req.headers["authorization"];

    if (!authHeader) return res.status(401).json({message: "Token não fornecido"})

    const token = authHeader.split(" ")[1];
    //console.log(token);

    try {
        const decode = jwt.verify(token, "melandia");
        req.user = decode;
        if (req.headers["authorized"]) req.authorized = 1;
        if (req.headers["nopages"]) req.noPages = 1;
        if (decode.isADM) req.isADM = 1;
        next();
    } catch (err) {
        res.status(401).json({message: "Token inválido ou expirado"})
    }
}

export async function isUser(req, res, next) {
  try {
    const id = req.user.id;
    const objectId = req.params.id;
    //console.log(objectId);
    const objectCollection = req.headers["objectcollection"];
    const snapshot = await getDoc(doc(db, objectCollection, objectId));

    if (!snapshot.exists()) return res.status(404).json({ message: "Documento não existe" });

    req.object = snapshot.data();
    if (req.isADM || req.authorized) return next();
    const expectedId = req.object.idUsuario;
    //console.log(id);
    //console.log(expectedId);
    //console.log(expectedUsername);
    if (id != expectedId) return res.json({message: "Não tem acesso a esse documento"});
    next();
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Ocorreu um erro ao verificar usuário" });
  }
}

export async function isInstitution(req, res, next) {
  if ((!req.params.id && !req.params.idApicultor) && !req.params.username) return res.status(500).json( { message: "Esse método não foi feito para esse tipo de chamada" } );

  if ((req.authorized || req.isADM) && req.headers["objectcollection"] === 'usuarios') return next();

  const user = req.user;
  const instituicaoUsuario = user.instituicaoEscolhida.id;
  const id = req.params.id || req.params.idApicultor;
  const objCollection = req.headers["objectcollection"];

  const snapshot = objCollection != 'usuarios' ? await getDoc(doc(db, objCollection, id)) : await getDocs(query(collection(db, "usuarios_instituicoes"), where("idInstituicao", "==", instituicaoUsuario), where("idUsuario", "==", id)));

  if ((objCollection != 'usuarios' && !snapshot.exists()) || snapshot.empty) return res.status(404).json({ message: "Documento não existe" });

  if (objCollection === 'usuarios') return next();

  const object = snapshot.data();
  
  req.object = object;

  if (req.authorized || req.isADM) return next();

  //console.log(objCollection, instituicaoUsuario, object.idInstituicao);
  if (objCollection != 'pedidosCadastro' && instituicaoUsuario != object.idInstituicao) return res.status(402).json( { message: "Você não tem acesso a documentos dessa instituição" } );
  if (objCollection === 'pedidosCadastro' && instituicaoUsuario != object.instituicaoRequisitada) return res.status(402).json( { message: "Você não tem acesso a documentos dessa instituição" } );

  next();  
}

export async function isTypeUser(req, res, next) {
  if (req.authorized) return next();
  const colecao = req.headers["objectcollection"];
  if (!colecao) return res.status(402).json( { message: "Não é possível prosseguir sem especificar a coleção que deseja acessar" } );
  const tipoUsuario = req.isADM ? 'Administrador' : req.user.instituicaoEscolhida.tipoUsuario;

  if ((colecao == "amostras" || colecao == "analises") || colecao == "laudos") {
    if (tipoUsuario == "Apicultor") {
      // Apicultor pode visualizar laudos, mas não criar/editar
      if (req.method === 'GET') return next();
      return res.status(402).json({ message: "Você não tem acesso à essa coleção" });
    }
  } else if ((colecao == "revisaoLaudos" || colecao == "fazendas") || (colecao == "parametros" || colecao == "usuarios") || colecao == "pedidosCadastro") {
    if (tipoUsuario == "Apicultor") {
      // Apicultor pode visualizar apenas suas fazendas
      if (colecao === "fazendas" && req.method === 'GET') return next();
      return res.status(402).json({ message: "Você não tem acesso à essa coleção" });
    }

    if (tipoUsuario === "Pesquisador") return res.json({ message: "Você não tem acesso à essa coleção" });
  } else if (colecao == "instituicoes") {
    if (tipoUsuario != "Administrador") return res.status(402).json({ message: "Você não tem acesso à essa coleção" });
  }

  next();
}

export async function filterApicultorData(req, res, next) {
  if (req.user.instituicaoEscolhida.tipoUsuario === 'Apicultor') {
    req.isApicultor = true;
    req.apicultorId = req.user.id;
    
    // Para fazendas e laudos, filtrar apenas os relacionados ao apicultor
    if (req.headers["objectcollection"] === 'fazendas' || req.headers["objectcollection"] === 'laudos') {
      req.filters = { ...req.filters, idApicultor: req.user.id };
    }
  }
  next();
}

export async function registrarUsuario(req, res) {
    try {
        const user = req.body;
        //const {username, email, password, instituicao, tipoUsuario} = req.body;

        const snapshotUsers = await getDocs(query(collection(db, "usuarios"), where("username", "==", user.username)));
        const snapshotPedidos = await getDocs(query(collection(db, "pedidosCadastro"), where("username", "==", user.username)));

        if (!snapshotUsers.empty || !snapshotPedidos.empty) {
            return res.status(400).json({ message: "Usuário já existe" });
        }

        const hashPassword = await bcrypt.hash(user.password, 10);
        const id = await calcularIdCadastro();
        await setDoc(doc(db, "pedidosCadastro", id), {
            ...user,
            password: hashPassword,
            dataSolicitacao: (new Date() + "")
        });
        res.json({message:"Usuário registrado com sucesso."});
    } catch (err) {
        res.status(500).json({message:"Erro ao registrar usuario"});
        console.error(err);
    }
}

export async function logarUsuario(req, res) {
  try {
    const {username, email, password, idInstituicao} = req.body;

    let condition;

    if (username) condition = where("username", "==", username);
    else if (email) condition = where("email", "==", email);
    
    const snapshot = await getDocs(query(collection(db, "usuarios"), condition));

    if (snapshot.empty) {
        return res.status(400).json({ message: "Usuário não existe" });
    }
    
    const documento = snapshot.docs[0];
    const user = {
        id: documento.id,
        ...documento.data()
    };

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
        return res.status(400).json({message: "Senha incorreta"});
    }
   
    if (user.tipoUsuario === 'Administrador') req.isADM = 1;
    const instituicoes = user.tipoUsuario === 'Administrador' ? await obterInstituicoesInterno(true) : await obterInstituicoesUsuario(user.id);
    
    const instituicaoEscolhida = instituicoes.find(instituicao => instituicao.id === idInstituicao);

    if (!instituicaoEscolhida) return res.status(400).json({message: "É necessário escolher uma instituição que o usuário esteja associado"});    

    const ultimoAcesso = new Date();

    await updateDoc(doc(db, "usuarios", user.id), {ultimoAcesso});

    user['instituicaoEscolhida'] = instituicaoEscolhida;
    user['ultimoAcesso'] = ultimoAcesso;

    const token = jwt.sign(user, "melandia", {expiresIn:"24h"});
    res.json({token});
  } catch(err) {
    res.status(500).json({message:"Erro ao logar usuario"});
    console.error(err);
  }
}

export async function alterarInfosUsuario(req, res) {
  try {
    const alteracoes = req.body;
    const { id } = req.params;

    if (!req.isADM && req.user.id != id) return res.status(401).json({ message: "Apenas o próprio usuário pode alterar as suas informações" });
  
    await updateDoc(doc(db, "usuarios", id), alteracoes);

    const docUser = await getDoc(doc(db, "usuarios", id));

    const user = {
      id: docUser.id,
      instituicaoEscolhida: req.user.instituicaoEscolhida,
      ...docUser.data()
    };

    const token = jwt.sign(user, "melandia", {expiresIn:"24h"});
    res.json({ message: "Informações do usuário alteradas com sucesso!", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Ocorreu um erro ao alterar informações do usuário" });
  }
}

export async function alterarSenha(req, res) {
  try {
    const { senhaAtual, senhaNova } = req.body;
    const { id } = req.params;
    
    if (!req.isADM && req.user.id != id) return res.status(401).json({ message: "Apenas o próprio usuário pode alterar a senha" });
    
    const docUser = doc(db, "usuarios", id);
    const snapshot = await getDoc(docUser);
    const user = snapshot.data();    

    const isPasswordValid = await bcrypt.compare(senhaAtual, user.password);

    if (!isPasswordValid) return res.status(401).json({ message: "Senha atual incorreta" });

    const hashPassword = await bcrypt.hash(senhaNova, 10);

    await updateDoc(docUser, {password: hashPassword});

    res.json({ message: "Senha alterada com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ocorreu um erro ao alterar a senha do usuário" });
  }
}

async function calcularIdCadastro() {
  try {
    const snapshot = await getDocs(collection(db, "pedidosCadastro"));
    let maior = 0;

    snapshot.forEach(doc => {
      const id = doc.id;
      const partes = id.split("-");
      const numero = parseInt(partes[2], 10);

      if (numero > maior) {
        maior = numero;
      }
    });

    const novoId = (maior + 1).toString().padStart(4, "0");
    const ano = new Date().getFullYear();
    return `REQ-${ano}-${novoId}`;
  } catch(err) {
    console.error(err);
  }
}