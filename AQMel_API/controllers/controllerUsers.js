import { getDocs, getDoc, collection, query, orderBy, documentId, setDoc, doc, deleteDoc, Timestamp, updateDoc, where, getCountFromServer } from "firebase/firestore";
import db from "../db/firebase.js";

export async function obterUsuarios(req, res) {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '',
      status = '',
      tipoUsuario = '',
      fazenda = ''
    } = req.query;

    // Buscar todos os usuários com filtros básicos no Firebase
    let usuariosRef = collection(db, "usuarios");
    let constraints = [];

    if (status) {
      constraints.push(where("status", "==", status));
    }

    if (tipoUsuario) {
      constraints.push(where("tipoUsuario", "==", tipoUsuario));
    }

    if (constraints.length > 0) {
      usuariosRef = query(usuariosRef, ...constraints);
    }

    usuariosRef = query(usuariosRef, orderBy("nome", "asc"));

    const snapshotUsuarios = await getDocs(usuariosRef);
    let usuarios = snapshotUsuarios.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // FILTRAGEM MANUAL APENAS para instituição (não-ADM) e busca
    if (!req.isADM) {
      const snapshotVinculos = await getDocs(
        query(collection(db, "usuarios_instituicoes"), 
        where("idInstituicao", "==", req.user.instituicaoEscolhida.id))
      );
      
      const idsUsuariosInstituicao = snapshotVinculos.docs.map(doc => doc.data().idUsuario);
      usuarios = usuarios.filter(usuario => idsUsuariosInstituicao.includes(usuario.id));
    }

    if (fazenda) {
      const snapshotVinculos = await getDocs(
        query(collection(db, "usuarios_fazendas"),
        where("idFazenda", "==", fazenda))
      );

      const idsUsuariosFazenda = snapshotVinculos.docs.map(doc => doc.data().idUsuario);
      usuarios = usuarios.filter(usuario => idsUsuariosFazenda.includes(usuario.id));
    }

    // Filtro de busca manual
    if (search) {
      const searchLower = search.toLowerCase();
      usuarios = usuarios.filter(usuario =>
        usuario.nome?.toLowerCase().includes(searchLower) ||
        usuario.email?.toLowerCase().includes(searchLower) ||
        usuario.username?.toLowerCase().includes(searchLower)
      );
    }

    // Processamento final
    const usuariosProcessados = [];
    for (const usuario of usuarios) {
      const usuarioCompleto = {
        ...usuario,
        instituicoes: await obterInstituicoesUsuario(usuario.id),
        fazendas: await obterFazendasApicultor(req.isADM, req.user.instituicaoEscolhida.id, usuario.id)
      };

      usuariosProcessados.push(usuarioCompleto);
    }

    // Paginação
    const total = usuariosProcessados.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    
    const usuariosPaginados = usuariosProcessados.slice(startIndex, endIndex);

    res.json({
      usuarios: usuariosPaginados,
      paginacao: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error("Erro ao buscar usuários:", err);
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
}

// Adicione também esta função para contar usuários (para os cards)
export async function contarUsuariosInterno(req, res) {
  try {
    const queryBase = !req.user.isADM ? query(collection(db, "usuarios_instituicoes"), where("idInstituicao", "==", req.user.instituicaoEscolhida.id)) : collection(db, "usuarios_instituicoes");
    const total = (await getCountFromServer(queryBase)).data().count;
    const administradores = (await getCountFromServer(query(queryBase, where("tipoUsuario", "==", "Administrador")))).data().count;
    const pesquisadores = (await getCountFromServer(query(queryBase, where("tipoUsuario", "==", "Pesquisador")))).data().count;
    const coordenadores = (await getCountFromServer(query(queryBase, where("tipoUsuario", "==", "Coordenador")))).data().count;
    const apicultores = (await getCountFromServer(query(queryBase, where("tipoUsuario", "==", "Apicultor")))).data().count;
    
    return {
      total,
      administradores,
      pesquisadores,
      coordenadores,
      apicultores
    };
  } catch (err) {
    console.error(err);
    return { total: 0, administradores: 0, pesquisadores: 0, coordenadores: 0, apicultores: 0 };
  }
}

export async function contarUsuarios(req, res) {
  try {
    const queryBase = !req.user.isADM ? query(collection(db, "usuarios_instituicoes"), where("idInstituicao", "==", req.user.instituicaoEscolhida.id)) : collection(db, "usuarios_instituicoes");
    const total = (await getCountFromServer(queryBase)).data().count;
    const administradores = (await getCountFromServer(query(queryBase, where("tipoUsuario", "==", "Administrador")))).data().count;
    const pesquisadores = (await getCountFromServer(query(queryBase, where("tipoUsuario", "==", "Pesquisador")))).data().count;
    const coordenadores = (await getCountFromServer(query(queryBase, where("tipoUsuario", "==", "Coordenador")))).data().count;
    const apicultores = (await getCountFromServer(query(queryBase, where("tipoUsuario", "==", "Apicultor")))).data().count;
    
    res.json({
      total,
      administradores,
      pesquisadores,
      coordenadores,
      apicultores
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao contar usuários" });
  }
}

export async function obterUsuario(req, res) {
  const { id } = req.params;
  
  try {
    const snapshot = await getDoc(doc(db, "usuarios", id));

    if (!snapshot.exists()) return res.status(404).json({ error: "Usuário não existe" });
    
    const usuario = {
      id,
      ...snapshot.data(),
      instituicoes: await obterInstituicoesUsuario(id),
      fazendas: await obterFazendasApicultor(req.isADM, req.user.instituicaoEscolhida.id, id)
    };
    
    res.json(usuario);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar usuário" });
  }
}

export async function obterApicultores(req, res) {
  try {
    const constraints = [];
    constraints.push(where("tipoUsuario", "==", "Apicultor"));
    if (!req.isADM) constraints.push(where("idInstituicao", "==", req.user.instituicaoEscolhida.id));
    const q = query(collection(db, "usuarios_instituicoes"), ...constraints);
    const snapshotVinculos = await getDocs(q);
    
    if (snapshotVinculos.empty) return res.status(404).json({ message: "Não existem usuários cadastrados como apicultores no sistema" });

    const idsApicultores = snapshotVinculos.docs.map(doc => doc.data().idUsuario);
    const apicultores = [];

    for (let i = 0; i < idsApicultores.length; i += 10) {
      const chunk = idsApicultores.slice(i, i+10);

      const snapshot = await getDocs(query(collection(db, "usuarios"), where("__name__", "in", chunk)));

      for (const doc of snapshot.docs) {
        apicultores.push({
          id: doc.id, 
          ...doc.data(), 
          instituicoes: await obterInstituicoesUsuario(doc.id),
          fazendas: await obterFazendasApicultor(req.isADM, req.user.instituicaoEscolhida.id, doc.id)
        });
      }
    }

    res.json(apicultores);   
  } catch (err) {
    console.error(err);
    res.status(500).json({error: "Ocorreu um erro ao buscar apicultores"});
  }
}

export async function obterPesquisadores(req, res) {
  try {
    const constraints = [];
    constraints.push(where("tipoUsuario", "==", "Pesquisador"));
    if (!req.isADM) constraints.push(where("idInstituicao", "==", req.user.instituicaoEscolhida.id));
    const q = query(collection(db, "usuarios_instituicoes"), ...constraints);
    const snapshotVinculos = await getDocs(q);
    
    if (snapshotVinculos.empty) return res.status(404).json({ message: "Não existem usuários cadastrados como pesquisadores no sistema" });

    const idsPesquisadores = snapshotVinculos.docs.map(doc => doc.data().idUsuario);
    const pesquisadores = [];

    for (let i = 0; i < idsPesquisadores.length; i += 10) {
      const chunk = idsPesquisadores.slice(i, i+10);

      const snapshot = await getDocs(query(collection(db, "usuarios"), where("__name__", "in", chunk)));
      
      for (const doc of snapshot.docs) {
        pesquisadores.push({
          id: doc.id, 
          ...doc.data(), 
          instituicoes: await obterInstituicoesUsuario(doc.id),
        });
      }
    }

    res.json(pesquisadores);   
  } catch (err) {
    console.error(err);
    res.status(500).json({error: "Ocorreu um erro ao buscar pesquisadores"});
  }
}

export async function editarUsuario(req, res) {
  try {
    const id = req.params.id;
    const alteracoes = req.body;

    const docUser = await getDoc(doc(db, "usuarios", id));

    if (docUser.data().isADM) res.status(402).json({ message: "Você não pode alterar dados de administradores" });
    
    if ((!req.isADM && alteracoes.tipoUsuario) && alteracoes.tipoUsuario === 'Administrador') delete alteracoes.tipoUsuario;

    await updateDoc(doc(db, "usuarios_instituicoes", `${id}_${req.user.instituicaoEscolhida.id}`), {
      tipoUsuario: alteracoes.tipoUsuario
    });

    delete alteracoes.tipoUsuario;

    await updateDoc(doc(db, "usuarios", id), alteracoes);

    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao editar usuário" });
  }
}

export async function excluirUsuario(req, res) {
  try {
    const id = req.params.id;
    const docRef = doc(db, "usuarios", id);

    await deleteDoc(docRef);

    res.status(201).json({ sucess: true });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao excluir usuário" });
  }
}

export async function obterPedidos(req, res) {
  try {
    const snapshot = req.isADM ? await getDocs(collection(db, "pedidosCadastro")) : await getDocs(query(collection(db, "pedidosCadastro"), where("instituicaoRequisitada", "==", req.user.instituicaoEscolhida.id)));

    const pedidos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(pedidos);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar pedidos de cadastro" });
  }
}

export async function obterPedidosInterno(req) {
  try {
    const snapshot = req.isADM ? await getDocs(collection(db, "pedidosCadastro")) : await getDocs(query(collection(db, "pedidosCadastro"), where("instituicaoRequisitada", "==", req.user.instituicaoEscolhida.id)));

    const pedidos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return pedidos;
  } catch(err) {
    console.error(err);
    return [];
  }
}

export async function obterPedido(req, res) {
  try {
    const id = req.params.id;
    const snapshot = await getDoc(doc(db, "pedidosCadastro", id));
    
    if (!snapshot.exists()) return res.status(404).json({ error: "Pedido não existe" });

    const pedido = {
      id,
      ...snapshot.data()
    };

    res.json(pedido);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar o pedido de cadastro" });
  }
}

export async function aprovarPedido(req, res) {
  try {
    const id = req.params.id;
    const docRef = doc(db, "pedidosCadastro", id);
    const pedido = await getDoc(docRef);
    const user = pedido.data();

    user.status = 'Ativo';

    const idUser = await calcularIdUser();

    await setDoc(doc(db, "usuarios_instituicoes", `${idUser}_${user.instituicaoRequisitada}`), {
      idUsuario: idUser,
      idInstituicao: user.instituicaoRequisitada,
      tipoUsuario: user.tipoUsuario
    });

    delete user.instituicaoRequisitada;
    delete user.tipoUsuario;

    await setDoc(doc(db, "usuarios", idUser), user);

    await deleteDoc(docRef);

    res.status(201).json({ sucess: true });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao aprovar o pedido de cadastro" });
  }
}

export async function reprovarPedido(req, res) {
  try {
    const id = req.params.id;
    const docRef = doc(db, "pedidosCadastro", id);

    await deleteDoc(docRef);

    res.status(201).json({ sucess: true });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao reprovar o pedido de cadastro" });
  }
}

export async function associarApicultorFazenda(req, res) {
  try {
    const { idApicultor, idFazenda } = req.params;

    await setDoc(doc(db, "usuarios_fazendas", `${idApicultor}_${idFazenda}`), {
      idUsuario: idApicultor,
      idFazenda
    });

    res.status(201).json( { success: true } );
  } catch (err) {
    console.error(err);
    res.status(500).json( { error: "Erro ao associar apicultor à fazenda" } );
  }
}

export async function desligarApicultorFazenda(req, res) {
  try {
    const { idApicultor, idFazenda } = req.params;

    await deleteDoc(doc(db, "usuarios_fazendas", `${idApicultor}_${idFazenda}`));

    res.status(201).json( { success: true } );
  } catch (err) {
    console.error(err);
    res.status(500).json( { error: "Erro ao desassociar apicultor à fazenda" } );
  }
}

export async function associarUsuarioInstituicao(req, res) {
  try {
    const { idUsuario, idInstituicao } = req.params;
    const { tipoUsuario = 'Apicultor' } = req.query;

    await setDoc(doc(db, "usuarios_instituicoes", `${idUsuario}_${idInstituicao}`), {
      idUsuario,
      idInstituicao,
      tipoUsuario
    });

    res.status(201).json( { success: true } );
  } catch (err) {
    console.error(err);
    res.status(500).json( { error: "Erro ao associar usuário à instituição" } );
  }
}

export async function desassociarUsuarioInstituicao(req, res) {
  try {
    const { idUsuario, idInstituicao } = req.params;

    await deleteDoc(doc(db, "usuarios_instituicoes", `${idUsuario}_${idInstituicao}`));

    res.status(201).json( { success: true } );
  } catch (err) {
    console.error(err);
    res.status(500).json( { error: "Erro ao desassociar usuário à instituição" } );
  }
}

export async function obterFazendasApicultor(isADM = false, idInstituicao = '', idApicultor) {
  try {
    const snapshot = await getDocs(query(collection(db, "usuarios_fazendas"), where("idUsuario", "==", idApicultor)));
    
    if (snapshot.empty) return [];

    const fazendas = [];

    for (const documento of snapshot.docs) {
      const docFazenda = await getDoc(doc(db, "fazendas", documento.data().idFazenda));
      if (!docFazenda.exists() || (!isADM && docFazenda.data().idInstituicao != idInstituicao)) continue;

      fazendas.push({
        id: docFazenda.id,
        nome: docFazenda.data().nome,
        cidade: docFazenda.data().cidade,
        estado: docFazenda.data().estado,
        status: docFazenda.data().status
      });
    }

    return fazendas;
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function obterInstituicoesUsuario(idUsuario) {
  try {
    const snapshot = await getDocs(query(collection(db, "usuarios_instituicoes"), where("idUsuario", "==", idUsuario)));
    
    if (snapshot.empty) return [];

    const instituicoes = [];

    for (const documento of snapshot.docs) {
      const docInstituicao = await getDoc(doc(db, "instituicoes", documento.data().idInstituicao));
      if (!docInstituicao.exists()) continue;

      instituicoes.push({
        id: docInstituicao.id,
        tipoUsuario: documento.data().tipoUsuario,
        nome: docInstituicao.data().nome,
        cidade: docInstituicao.data().cidade,
        estado: docInstituicao.data().estado,
        status: docInstituicao.data().status
      });
    }

    return instituicoes;
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function obterUsuarioPorUsername(req, res) {
  try {
    //console.log(req.params);
    const snapshot = await getDocs(query(collection(db, "usuarios"), where("username", "==", req.params.username)));

    if (snapshot.empty) res.json(404).json({ message: "Usuário não existe" });
    
    const usuarioDoc = snapshot.docs[0];
    const usuario = {
      id: usuarioDoc.id,
      ...usuarioDoc.data(),
      instituicoes: await obterInstituicoesUsuario(usuarioDoc.id)
    };

    res.json(usuario);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ocorreu um erro ao buscar usuário pelo username" });
  }
}

export async function obterInstituicoesUsuarioAPI(req, res) {
  try {
    const snapshot = await getDocs(query(collection(db, "usuarios_instituicoes"), where("idUsuario", "==", req.params.id)));
    
    if (snapshot.empty) return res.status(404).json({ message: "Esse usuário não está associado a nenhuma instituição" });

    const instituicoes = [];

    for (const documento of snapshot.docs) {
      const docInstituicao = await getDoc(doc(db, "instituicoes", documento.data().idInstituicao));
      if (!docInstituicao.exists()) continue;

      instituicoes.push({
        id: docInstituicao.id,
        tipoUsuario: documento.data().tipoUsuario,
        nome: docInstituicao.data().nome,
        cidade: docInstituicao.data().cidade,
        estado: docInstituicao.data().estado,
        status: docInstituicao.data().status
      });
    }

    res.json(instituicoes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ocorreu um erro as filiações do usuário" });
  }
}

async function calcularIdUser() {
  try {
    const snapshot = await getDocs(collection(db, "usuarios"));
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
    return `US-${ano}-${novoId}`;
  } catch(err) {
    console.error(err);
  }
}