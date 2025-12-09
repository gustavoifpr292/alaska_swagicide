import { getDocs, getDoc, collection, query, orderBy, documentId, setDoc, doc, deleteDoc, where, getCountFromServer, updateDoc } from "firebase/firestore";
import db from "../db/firebase.js";

export async function obterAnalises(req, res) {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '',
      status = '',
      tipo = '',
      dataInicio = '',
      dataFim = '',
      pesquisador = ''
    } = req.query;

    // Construir query base
    let q = collection(db, "analises");
    let constraints = [];
    
    // Filtro por instituição (se não for ADM)
    if (!req.isADM) {
      constraints.push(where("idInstituicao", "==", req.user.instituicaoEscolhida.id));
    }

    // Filtro por status
    if (status) {
      constraints.push(where("status", "==", status));
    }

    // Filtro por tipo
    if (tipo) {
      constraints.push(where("tipo", "==", tipo));
    }

    if (pesquisador) {
      constraints.push(where("idUsuario", "==", pesquisador));
    }

    // Filtro por data
    if (dataInicio || dataFim) {
      if (dataInicio && dataFim) {
        constraints.push(where("dataAnalisada", ">=", dataInicio));
        constraints.push(where("dataAnalisada", "<=", dataFim));
      } else if (dataInicio) {
        constraints.push(where("dataAnalisada", ">=", dataInicio));
      } else if (dataFim) {
        constraints.push(where("dataAnalisada", "<=", dataFim));
      }
    }

    // Aplicar filtros
    if (constraints.length > 0) {
      q = query(q, ...constraints);
    }

    // Ordenação
    q = query(q, orderBy("dataAnalisada", "desc"));

    // Executar query
    const snapshot = await getDocs(q);
    
    // Aplicar filtro de busca textual (por ID ou amostra) APÓS a query do Firestore
    let analisesFiltradas = [];
    
    for (const documento of snapshot.docs) {
      const analise = {
        id: documento.id,
        ...documento.data(),
        parametros: await buscarParametrosAnalise(documento.id)
      };
      
      // Aplicar filtro de busca
      const searchLower = search.toLowerCase();
      const matchesSearch = !search || 
        analise.id.toLowerCase().includes(searchLower) ||
        (analise.idAmostra && analise.idAmostra.toLowerCase().includes(searchLower)) ||
        (analise.responsavel && analise.responsavel.toLowerCase().includes(searchLower));
      
      if (matchesSearch) {
        analisesFiltradas.push(analise);
      }
    }

    const total = analisesFiltradas.length;

    // Calcular paginação
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    
    // Aplicar paginação
    const analisesPaginadas = req.noPages ? analisesFiltradas : analisesFiltradas.slice(startIndex, endIndex);

    res.json({
      analises: analisesPaginadas,
      paginacao: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar análises" });
  }
}

export async function obterAnalisesInterno(req) {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '',
      status = '',
      tipo = '',
      dataInicio = '',
      dataFim = '',
      pesquisador = ''
    } = req.query;

    // Construir query base
    let q = collection(db, "analises");
    let constraints = [];
    
    // Filtro por instituição (se não for ADM)
    if (!req.isADM) {
      constraints.push(where("idInstituicao", "==", req.user.instituicaoEscolhida.id));
    }

    // Filtro por status
    if (status) {
      constraints.push(where("status", "==", status));
    }

    // Filtro por tipo
    if (tipo) {
      constraints.push(where("tipo", "==", tipo));
    }

    if (pesquisador) {
      constraints.push(where("idUsuario", "==", pesquisador));
    }

    // Filtro por data
    if (dataInicio || dataFim) {
      if (dataInicio && dataFim) {
        constraints.push(where("dataAnalisada", ">=", dataInicio));
        constraints.push(where("dataAnalisada", "<=", dataFim));
      } else if (dataInicio) {
        constraints.push(where("dataAnalisada", ">=", dataInicio));
      } else if (dataFim) {
        constraints.push(where("dataAnalisada", "<=", dataFim));
      }
    }

    // Aplicar filtros
    if (constraints.length > 0) {
      q = query(q, ...constraints);
    }

    // Ordenação
    q = query(q, orderBy("dataAnalisada", "desc"));

    // Executar query
    const snapshot = await getDocs(q);
    
    // Aplicar filtro de busca textual (por ID ou amostra) APÓS a query do Firestore
    let analisesFiltradas = [];
    
    for (const documento of snapshot.docs) {
      const analise = {
        id: documento.id,
        ...documento.data(),
        parametros: await buscarParametrosAnalise(documento.id)
      };
      
      // Aplicar filtro de busca
      const searchLower = search.toLowerCase();
      const matchesSearch = !search || 
        analise.id.toLowerCase().includes(searchLower) ||
        (analise.idAmostra && analise.idAmostra.toLowerCase().includes(searchLower)) ||
        (analise.responsavel && analise.responsavel.toLowerCase().includes(searchLower));
      
      if (matchesSearch) {
        analisesFiltradas.push(analise);
      }
    }

    const total = analisesFiltradas.length;

    // Calcular paginação
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    
    // Aplicar paginação
    const analisesPaginadas = req.noPages ? analisesFiltradas : analisesFiltradas.slice(startIndex, endIndex);

    return {
      analises: analisesPaginadas,
      paginacao: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (err) {
    console.error(err);
    return {};
  }
}

export async function contarAnalises(req, res) {
  try {
    let queryBase = req.isADM ? collection(db, "analises") : query(collection(db, "analises"), where("idInstituicao", "==", req.user.instituicaoEscolhida.id));
    
    const total = (await getCountFromServer(queryBase)).data().count;
    const pendentes = (await getCountFromServer(query(queryBase, where("status", "==", "Pendente")))).data().count;
    const concluidas = (await getCountFromServer(query(queryBase, where("status", "==", "Concluída")))).data().count;
    
    const hoje = new Date().toISOString().split('T')[0];
    const analisesHoje = (await getCountFromServer(query(queryBase, where("dataAnalisada", ">=", hoje)))).data().count;

    res.json({ total, pendentes, concluidas, analisesHoje });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao contar análises" });
  }
}

export async function contarAnalisesInterno(req) {
  try {
    let queryBase = req.isADM ? collection(db, "analises") : query(collection(db, "analises"), where("idInstituicao", "==", req.user.instituicaoEscolhida.id));
    
    const total = (await getCountFromServer(queryBase)).data().count;
    const pendentes = (await getCountFromServer(query(queryBase, where("status", "==", "Pendente")))).data().count;
    const concluidas = (await getCountFromServer(query(queryBase, where("status", "==", "Concluída")))).data().count;
    
    const hoje = new Date().toISOString().split('T')[0];
    const analisesHoje = (await getCountFromServer(query(queryBase, where("dataAnalisada", ">=", hoje)))).data().count;

    return { total, pendentes, concluidas, analisesHoje };
  } catch (err) {
    console.error(err);
    return { total: 0, pendentes: 0, concluidas: 0, analisesHoje: 0 };
  }
}

export async function obterAnalise(req, res) {
  try {
    const { id } = req.params;
    const snapshot = await getDoc(doc(db, "analises", id));

    if (!snapshot.exists()) return res.status(404).json({ error: "Análise não existe" });

    const analise = {
      id,
      ...snapshot.data(),
      //dataAnalisada: snapshot.data().dataAnalisada.toDate().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      parametros: await buscarParametrosAnalise(id)
    };

    res.json(analise);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar análise" });
  }
}

export async function obterAnaliseInterno(id) {
  try {
    const snapshot = await getDoc(doc(db, "analises", id));

    if (!snapshot.exists()) return "Análise não existe";

    const analise = {
      id,
      ...snapshot.data(),
      //dataAnalisada: snapshot.data().dataAnalisada.toDate().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      parametros: await buscarParametrosAnalise(id)
    };

    return analise;
  } catch (err) {
    console.error(err);
    return "Erro ao buscar análise";
  }
}

export async function cadastrarAnalise(req, res) {
  try {
    const analise = req.body;
    let { id } = req.params;

    if (!analise) return res.status(400).json({ error: "Dados inválidos" });
    
    id = id ?? await calcularId();

    const { parametros } = analise;
    //console.log(parametros);

    for (const parametro of parametros) {

      await setDoc(doc(db, "analises_parametros", `${id}_${parametro.id}`), {
        idAnalise: id,
        idParametro: parametro.id,
        valor: parametro.valor,
        //tipo: parametro.tipo
      })
    }

    delete analise.parametros;

    await setDoc(doc(db, "analises", id), analise);
    
    res.status(201).json({ sucess: true, analise, id });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao cadastrar análise" });
  }
}

export async function editarAnalise(req, res) {
  try {
    const { id } = req.params;
    const alteracoes = req.body;
    //console.log(alteracoes);
    const { status } = req.object;

    if (status === 'Concluída' && !req.isADM) return res.status(402).json({ message: "Essa análise não pode mais ser editada" });

    const { parametros } = alteracoes;

    const snapshotParametrosAnalise = await getDocs(query(collection(db, "analises_parametros"), where("idAnalise", "==", id)));

    const parametrosRemover = [];

    for (const documento of snapshotParametrosAnalise.docs) {
      const parametro = {id: documento.data().idParametro, valor: documento.data().valor};

      if (!parametros.includes(parametro)) parametrosRemover.push({...parametro, id: documento.id});
    }

    for (const parametro of parametrosRemover) {
      await deleteDoc(doc(db, "analises_parametros", parametro.id));
    }

    for (const parametro of parametros) {
      await setDoc(doc(db, "analises_parametros", `${id}_${parametro.id}`), {idAnalise: id, idParametro: parametro.id, valor: parametro.valor});
    }

    delete alteracoes.parametros;
    await updateDoc(doc(db, "analises", id), alteracoes);

    return res.json({ success: true });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao editar análise" });
  }
}

export async function excluirAnalise(req, res) {
  try {
    const { id } = req.params;
    const docRef = doc(db, "analises", id);
    await deleteDoc(docRef);
    res.json({ sucess: true });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao excluir análise" });
  }
}

export async function atribuirParametro(req, res) {
  try {
    const { id, idParametro } = req.params;
    const { valor } = req.body;
    //console.log(id);
    //console.log(idParametro);
    //console.log(valor);

    const idRelacao = `${id}_${idParametro}`;
    //console.log(idRelacao);
    await setDoc(doc(db, "analises_parametros", idRelacao), {
      idAnalise: id,
      idParametro,
      valor
    });

    res.status(201).json({ sucess: true });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atribuir parâmetro" });
  }
}

async function buscarParametrosAnalise(id) {
  try {
    const snapshot = await getDocs(query(collection(db, "analises_parametros"), where("idAnalise", "==", id)));
    //console.log(snapshot.docs[0].data().idAnalise);
    const parametros = [];

    for (const documento of snapshot.docs) {
      const docParametro = await getDoc(doc(db, "parametros", documento.data().idParametro));      
      const { tipo, unidade } = docParametro.data();
      //console.log(tipo);
      const parametro = {
        id: docParametro.id,
        nome: docParametro.data().nome,
        valor: documento.data().valor,
        tipo,
        unidade
      }
      
      //console.log(parametro);

      parametros.push(parametro);
    }

    //console.log(parametros);

    return parametros;
  } catch(err) {
    console.error(err);
  }
}

async function calcularId() {
  try {
    const snapshot = await getDocs(collection(db, "analises"));
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
    return `AN-${ano}-${novoId}`;
  } catch(err) {
    console.error(err);
  }
}