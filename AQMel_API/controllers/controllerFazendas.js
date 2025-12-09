import { getDocs, getDoc, collection, query, orderBy, documentId, setDoc, doc, deleteDoc, updateDoc, where, getCountFromServer } from "firebase/firestore";
import db from "../db/firebase.js";

export async function obterFazendas(req, res) {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '',
      status = '',
      regiao = ''
    } = req.query;

    // Construir query base
    let q = collection(db, "fazendas");
    let constraints = [];
    
    // Filtro por instituição (se não for ADM)
    if (!req.isADM) {
      constraints.push(where("idInstituicao", "==", req.user.instituicaoEscolhida.id));
    }

    // Filtro por status
    if (status) {
      constraints.push(where("status", "==", status));
    }

    // Filtro por região
    if (regiao) {
      constraints.push(where("regiao", "==", regiao));
    }

    // Aplicar filtros
    if (constraints.length > 0) {
      q = query(q, ...constraints);
    }

    // Ordenação
    q = query(q, orderBy("nome", "asc"));

    // Executar query
    const snapshot = await getDocs(q);
    
    // Aplicar filtro de busca textual (por nome) APÓS a query do Firestore
    let fazendasFiltradas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filtro de busca textual (por nome) - feito manualmente
    if (search) {
      const searchLower = search.toLowerCase();
      fazendasFiltradas = fazendasFiltradas.filter(fazenda => 
        fazenda.nome.toLowerCase().includes(searchLower) ||
        (fazenda.proprietario && fazenda.proprietario.toLowerCase().includes(searchLower)) ||
        (fazenda.cidade && fazenda.cidade.toLowerCase().includes(searchLower))
      );
    }

    const total = fazendasFiltradas.length;

    // Calcular paginação
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    
    // Aplicar paginação
    const fazendasPaginadas = req.noPages ? fazendasFiltradas : fazendasFiltradas.slice(startIndex, endIndex);

    res.json({
      fazendas: fazendasPaginadas,
      paginacao: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar fazendas" });
  }
}

export async function contarFazendas(req, res) {
  try {
    let queryBase = req.isADM ? collection(db, "fazendas") : query(collection(db, "fazendas"), where("idInstituicao", "==", req.user.instituicaoEscolhida.id));
    
    const total = (await getCountFromServer(queryBase)).data().count;
    const ativas = (await getCountFromServer(query(queryBase, where("status", "==", "Ativa")))).data().count;
    const inativas = (await getCountFromServer(query(queryBase, where("status", "==", "Inativa")))).data().count;

    res.json({ total, ativas, inativas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao contar fazendas" });
  }
}

export async function contarFazendasInterno(req, res) {
  try {
    let queryBase = req.isADM ? collection(db, "fazendas") : query(collection(db, "fazendas"), where("idInstituicao", "==", req.user.instituicaoEscolhida.id));
    
    const total = (await getCountFromServer(queryBase)).data().count;
    const ativas = (await getCountFromServer(query(queryBase, where("status", "==", "Ativa")))).data().count;
    const inativas = (await getCountFromServer(query(queryBase, where("status", "==", "Inativa")))).data().count;

    return { total, ativas, inativas };
  } catch (err) {
    console.error(err);
    return { total: 0, ativas: 0, inativas: 0 };
  }
}

export async function obterFazenda(req, res) {
  const { id } = req.params;

  try {
    const snapshot = await getDoc(doc(db, "fazendas", id));

    if (!snapshot.exists()) return res.status(404).json( { message: "Fazenda não existe" } );

    const fazenda = {
      id: snapshot.id,
      ...snapshot.data()
    };

    res.json(fazenda);
  } catch (err) {
    console.error(err);
    res.status(500).json( { error: "Erro ao buscar fazenda" } );
  }
}

export async function cadastrarFazenda(req, res) {
  try {
    const fazenda = req.body;

    if (!fazenda) return res.json( { message: "As informações para o cadastro da fazenda não estão disponíveis na requisição" } );
    
    await setDoc(doc(db, "fazendas", await calcularId()), fazenda);

    res.status(201).json( { success: true } );
  } catch (err) {
    console.error(err);
    res.status(500).json( { error: "Erro ao cadastrar fazenda" } );
  }
}

export async function editarFazenda(req, res) {
  try {
    const { id } = req.params;
    const fazendaAlteracoes = req.body;

    if (!fazendaAlteracoes) return res.json( { message: "Não há atributos para editar" } );

    await updateDoc(doc(db, "fazendas", id), fazendaAlteracoes);

    res.status(201).json( { success: true } );
  } catch (err) {
    console.error(err);
    res.status(500).json( { error: "Erro ao editar dados da fazenda" } );
  }
}

export async function excluirFazenda(req, res) {
  try {
    const { id } = req.params;
    
    await deleteDoc(doc(db, "fazendas", id));

    res.status(201).json( { success: true } );
  } catch (err) {
    console.error(err);
    res.status(500).json( { error: "Erro ao excluir fazenda" } );
  }
}

export async function obterFazendasProdutor(req, res) {
  try {
    const { id } = req.params;

    const { 
      page = 1, 
      limit = 10, 
      search = '',
      status = '',
      regiao = ''
    } = req.query;

    // Construir query base
    let q = collection(db, "fazendas");
    let constraints = [];
    
    // Filtro por instituição (se não for ADM)
    if (!req.isADM) {
      constraints.push(where("idInstituicao", "==", req.user.instituicaoEscolhida.id));
    }

    // Filtro por status
    if (status) {
      constraints.push(where("status", "==", status));
    }

    // Filtro por região
    if (regiao) {
      constraints.push(where("regiao", "==", regiao));
    }

    // Aplicar filtros
    if (constraints.length > 0) {
      q = query(q, ...constraints);
    }

    // Ordenação
    q = query(q, orderBy("nome", "asc"));

    const docsVinculos = (await getDocs(query(collection(db, "usuarios_fazendas"), where("idUsuario", "==", id)))).docs;
    const idsFazendas = docsVinculos.map(doc => doc.data().idFazenda);
    let fazendasFiltradas = [];

    for (let i = 0; i < idsFazendas.length; i += 10) {
      const chunk = idsFazendas.slice(i, i+10);
      q = query(q, where("__name__", "in", chunk));

      const snapshot = await getDocs(q);

      snapshot.docs.forEach(doc => {
        fazendasFiltradas.push({ id: doc.id, ...doc.data() });
      });
    }

    // Filtro de busca textual (por nome) - feito manualmente
    if (search) {
      const searchLower = search.toLowerCase();
      fazendasFiltradas = fazendasFiltradas.filter(fazenda => 
        fazenda.nome.toLowerCase().includes(searchLower) ||
        (fazenda.proprietario && fazenda.proprietario.toLowerCase().includes(searchLower)) ||
        (fazenda.cidade && fazenda.cidade.toLowerCase().includes(searchLower))
      );
    }

    const total = fazendasFiltradas.length;

    // Calcular paginação
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    
    // Aplicar paginação
    const fazendasPaginadas = req.noPages ? fazendasFiltradas : fazendasFiltradas.slice(startIndex, endIndex);

    res.json({
      fazendas: fazendasPaginadas,
      paginacao: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao obter fazendas associadas ao produtor" });
  }
}

async function calcularId() {
  try {
    const snapshot = await getDocs(collection(db, "fazendas"));
    let maior = 0;

    snapshot.forEach(doc => {
      const id = doc.id;
      const partes = id.split("-");
      const numero = parseInt(partes[1], 10);

      if (numero > maior) {
        maior = numero;
      }
    });

    const novoId = (maior + 1).toString().padStart(2, "0");
    return `FZ-${novoId}`;
  } catch(err) {
    console.error(err);
  }
}