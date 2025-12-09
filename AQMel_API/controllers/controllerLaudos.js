import { getDocs, getDoc, updateDoc, collection, query, orderBy, documentId, setDoc, doc, deleteDoc, Timestamp, where, getCountFromServer } from "firebase/firestore";
import db from "../db/firebase.js";
import { obterAnaliseInterno } from "./controllerAnalises.js";

export async function obterLaudos(req, res) {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '',
      status = '',
      dataInicio = '',
      dataFim = '',
      pesquisador = ''
    } = req.query;

    // Construir query base
    let q = collection(db, "laudos");
    let constraints = [];
    
    // Filtro por instituição (se não for ADM)
    if (!req.isADM) {
      constraints.push(where("idInstituicao", "==", req.user.instituicaoEscolhida.id));
    }

    //console.log(req.user.id);
    if (req.user.instituicaoEscolhida.tipoUsuario === "Apicultor") {
      constraints.push(where("status", "==", "Emitido"));
      constraints.push(where("idProdutor", "==", req.user.id));
    }

    // Filtro por status
    if (req.user.instituicaoEscolhida.tipoUsuario != "Apicultor" && status) {
      constraints.push(where("status", "==", status));
    }

    if (pesquisador) {
      constraints.push(where("idUsuario", "==", pesquisador));
    }

    // Filtro por data
    if (dataInicio || dataFim) {
      if (dataInicio && dataFim) {
        constraints.push(where("dataEmissao", ">=", dataInicio));
        constraints.push(where("dataEmissao", "<=", dataFim));
      } else if (dataInicio) {
        constraints.push(where("dataEmissao", ">=", dataInicio));
      } else if (dataFim) {
        constraints.push(where("dataEmissao", "<=", dataFim));
      }
    }

    // Aplicar filtros
    if (constraints.length > 0) {
      q = query(q, ...constraints);
    }

    // Ordenação
    q = query(q, orderBy("dataEmissao", "desc"));

    // Executar query
    const snapshot = await getDocs(q);
    
    // Aplicar filtro de busca textual (por ID, responsável ou análises) APÓS a query do Firestore
    let laudosFiltrados = [];
    
    for (const documento of snapshot.docs) {
      const laudo = {
        id: documento.id,
        ...documento.data(),
        analises: await buscarAnalisesLaudo(documento.id)
      };
      
      // Aplicar filtro de busca
      const searchLower = search.toLowerCase();
      const matchesSearch = !search || 
        laudo.id.toLowerCase().includes(searchLower) ||
        (laudo.responsavel && laudo.responsavel.toLowerCase().includes(searchLower)) ||
        // Buscar também nos IDs das análises vinculadas
        (laudo.analises && laudo.analises.some(analise => 
          analise.id && analise.id.toLowerCase().includes(searchLower)
        ));
      
      if (matchesSearch) {
        laudosFiltrados.push(laudo);
      }
    }

    const total = laudosFiltrados.length;

    // Calcular paginação
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    
    // Aplicar paginação
    const laudosPaginados = req.noPages ? laudosFiltrados : laudosFiltrados.slice(startIndex, endIndex);

    res.json({
      laudos: laudosPaginados,
      paginacao: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar laudos" });
  }
}

export async function obterLaudosInterno(req) {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '',
      status = '',
      dataInicio = '',
      dataFim = '',
      pesquisador = ''
    } = req.query;

    // Construir query base
    let q = collection(db, "laudos");
    let constraints = [];
    
    // Filtro por instituição (se não for ADM)
    if (!req.isADM) {
      constraints.push(where("idInstituicao", "==", req.user.instituicaoEscolhida.id));
    }

    if (req.user.instituicaoEscolhida.tipoUsuario === "Apicultor") {
      constraints.push(where("status", "==", "Emitido"));
      constraints.push(where("idProdutor", "==", req.user.id));
    }

    // Filtro por status
    if (status) {
      constraints.push(where("status", "==", status));
    }

    if (pesquisador) {
      constraints.push(where("idUsuario", "==", pesquisador));
    }

    // Filtro por data
    if (dataInicio || dataFim) {
      if (dataInicio && dataFim) {
        constraints.push(where("dataEmissao", ">=", dataInicio));
        constraints.push(where("dataEmissao", "<=", dataFim));
      } else if (dataInicio) {
        constraints.push(where("dataEmissao", ">=", dataInicio));
      } else if (dataFim) {
        constraints.push(where("dataEmissao", "<=", dataFim));
      }
    }

    // Aplicar filtros
    if (constraints.length > 0) {
      q = query(q, ...constraints);
    }

    // Ordenação
    q = query(q, orderBy("dataEmissao", "desc"));

    // Executar query
    const snapshot = await getDocs(q);
    
    // Aplicar filtro de busca textual (por ID, responsável ou análises) APÓS a query do Firestore
    let laudosFiltrados = [];
    
    for (const documento of snapshot.docs) {
      const laudo = {
        id: documento.id,
        ...documento.data(),
        analises: await buscarAnalisesLaudo(documento.id)
      };
      
      // Aplicar filtro de busca
      const searchLower = search.toLowerCase();
      const matchesSearch = !search || 
        laudo.id.toLowerCase().includes(searchLower) ||
        (laudo.responsavel && laudo.responsavel.toLowerCase().includes(searchLower)) ||
        // Buscar também nos IDs das análises vinculadas
        (laudo.analises && laudo.analises.some(analise => 
          analise.id && analise.id.toLowerCase().includes(searchLower)
        ));
      
      if (matchesSearch) {
        laudosFiltrados.push(laudo);
      }
    }

    const total = laudosFiltrados.length;

    // Calcular paginação
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    
    // Aplicar paginação
    const laudosPaginados = req.noPages ? laudosFiltrados : laudosFiltrados.slice(startIndex, endIndex);

    return {
      laudos: laudosPaginados,
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

export async function contarLaudos(req, res) {
  try {
    let queryBase = req.isADM ? collection(db, "laudos") : query(collection(db, "laudos"), where("idInstituicao", "==", req.user.instituicaoEscolhida.id));
    
    const total = (await getCountFromServer(queryBase)).data().count;
    const pendentes = (await getCountFromServer(query(queryBase, where("status", "==", "Pendente")))).data().count;
    const emitidos = (await getCountFromServer(query(queryBase, where("status", "==", "Emitido")))).data().count;
    
    const hoje = new Date().toISOString().split('T')[0];
    const laudosHoje = (await getCountFromServer(query(queryBase, where("dataEmissao", ">=", hoje)))).data().count;

    res.json({ total, pendentes, emitidos, laudosHoje });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao contar laudos" });
  }
}

export async function contarLaudosInterno(req) {
  try {
    let queryBase = req.isADM ? collection(db, "laudos") : query(collection(db, "laudos"), where("idInstituicao", "==", req.user.instituicaoEscolhida.id));
    
    const total = (await getCountFromServer(queryBase)).data().count;
    const pendentes = (await getCountFromServer(query(queryBase, where("status", "==", "Pendente")))).data().count;
    const emitidos = (await getCountFromServer(query(queryBase, where("status", "==", "Emitido")))).data().count;
    
    const hoje = new Date().toISOString().split('T')[0];
    const laudosHoje = (await getCountFromServer(query(queryBase, where("dataEmissao", ">=", hoje)))).data().count;

    return { total, pendentes, emitidos, laudosHoje };
  } catch (err) {
    console.error(err);
    return { total: 0, pendentes: 0, emitidos: 0, laudosHoje: 0 };
  }
}

export async function obterLaudosApicultor(req, res) {
  try {
    const { id } = req.params; // ID do apicultor
    const { page = 1, limit = 10 } = req.query;

    // Buscar análises do apicultor primeiro
    const analisesSnapshot = await getDocs(
      query(collection(db, "analises"), where("idApicultor", "==", id), where("status", "==", "Emitido"))
    );
    
    const analisesIds = analisesSnapshot.docs.map(doc => doc.id);
    
    if (analisesIds.length === 0) {
      return res.json({ laudos: [], paginacao: { total: 0, pages: 0 } });
    }

    // Buscar laudos que contenham essas análises
    const laudosAnalisesSnapshot = await getDocs(
      query(collection(db, "laudos_analises"), where("idAnalise", "in", analisesIds))
    );
    
    const laudosIds = [...new Set(laudosAnalisesSnapshot.docs.map(doc => doc.data().idLaudo))];
    
    if (laudosIds.length === 0) {
      return res.json({ laudos: [], paginacao: { total: 0, pages: 0 } });
    }

    // Buscar os laudos
    const laudosSnapshot = await getDocs(
      query(collection(db, "laudos"), where("id", "in", laudosIds))
    );

    const laudos = await Promise.all(
      laudosSnapshot.docs.map(async (doc) => {
        const laudo = { id: doc.id, ...doc.data() };
        laudo.analises = await buscarAnalisesLaudo(doc.id);
        return laudo;
      })
    );

    // Paginação
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const laudosPaginados = laudos.slice(startIndex, endIndex);

    res.json({
      laudos: laudosPaginados,
      paginacao: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: laudos.length,
        pages: Math.ceil(laudos.length / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar laudos do apicultor" });
  }
}

export async function obterLaudo(req, res) {
  try {
    const { id } = req.params;
    const snapshot = await getDoc(doc(db, "laudos", id));

    if (!snapshot.exists()) return res.status(404).json({ error: "Laudo não existe" });

    const laudo = {
      id,
      ...snapshot.data(),
      //dataEmissao: traduzirTimestamp(snapshot.data().dataEmissao),
      analises: await buscarAnalisesLaudo(id)
    };

    //laudo.dataEmissao = laudo.dataEmissao.toDate().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    
    /*const horario = laudo.dataEmissao.split(/[\/|,|:| ]/).filter(Boolean);
    const d = new Date(horario[2], horario[1], horario[0], horario[3], horario[4], horario[5]);
    console.log(d);*/
    //if (id == "LD-2025-0006") console.log(laudo);
    res.json(laudo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar laudo" });
  }
}

export async function cadastrarLaudo(req, res) {
  try {
    let laudo = req.body;
    let { id } = req.params;

    if (!laudo) return res.status(400).json({ error: "Dados inválidos" });
    
    id = id ?? await calcularId();

    await setDoc(doc(db, "laudos", id), laudo);

    laudo = {...laudo, id};
    
    res.status(201).json({ sucess: true, laudo });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao cadastrar laudo" });
  }
}

export async function editarLaudo(req, res) {
  try {
    const { id } = req.params;
    const alteracoes = req.body;
    const { status } = req.object;

    if (status === 'Emitido' && !req.isADM) return res.json({ message: "Este laudo não pode mais ser editado" });
    
    await updateDoc(doc(db, "laudos", id), alteracoes);

    res.json({ success: true });    
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao editar laudo" });
  }
}

export async function excluirLaudo(req, res) {
  try {
    const { id } = req.params;
    const docRef = doc(db, "laudos", id);
    await deleteDoc(docRef);
    res.json({ sucess: true });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao excluir laudo" });
  }
}

export async function atribuirAnalise(req, res) {
  const idLaudo = req.params.id;
  const idAnalise = req.params.id2;
  //const {idLaudo, idAnalise} = req.params;
  //console.log(idLaudo);
  //console.log(idAnalise);
  
  try {
    await setDoc(doc(db, "laudos_analises", `${idLaudo}_${idAnalise}`), {
      idLaudo,
      idAnalise
    });

    await updateDoc(doc(db, "analises", idAnalise), {status: "Concluída"});

    res.status(201).json({ sucess: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atribuir análise" });
  }
}

export async function desatribuirAnalise(req, res) {
  const idLaudo = req.params.id;
  const idAnalise = req.params.id2;
  //const {idLaudo, idAnalise} = req.params;
  //console.log(idLaudo);
  //console.log(idAnalise);
  
  try {
    await deleteDoc(doc(db, "laudos_analises", `${idLaudo}_${idAnalise}`));

    res.status(201).json({ sucess: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao desatribuir análise" });
  }
}

export async function aprovarLaudo(req, res) {
  const { id } = req.params;
  
  try {
    await updateDoc(doc(db, "laudos", id), {status: "Emitido"});
    res.status(201).json({sucess: true});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao aprovar laudo" });
  } 
}

export async function reprovarLaudo(req, res) {
  const { id } = req.params;
  const { observacoes } = req.body;  

  try {
    await updateDoc(doc(db, "laudos", id), {status: "Reprovado", observacoes});
    res.status(201).json({sucess: true});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao reprovar laudo" });
  }
  
}

async function buscarAnalisesLaudo(id) {
  try {
    const snapshot = await getDocs(query(collection(db, "laudos_analises"), where("idLaudo", "==", id)));
    const analises = [];
    for (const documento of snapshot.docs) {
      /*const docAnalise = await getDoc(doc(db, "analises", documento.data().idAnalise));
      const analise = {
        id: docAnalise.id,
        ...docAnalise.data()
      };*/

      const analise = await obterAnaliseInterno(documento.data().idAnalise);
      //console.log(analise);
      analises.push(analise);
    }

    return analises;
  } catch(err) {
    console.error(err);
  }
}

async function calcularId() {
  try {
    const snapshot = await getDocs(collection(db, "laudos"));
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
    return `LD-${ano}-${novoId}`;
  } catch(err) {
    console.error(err);
  }
}

function traduzirTimestamp(time) {
  return time.toDate().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}