import { getDocs, getDoc, collection, query, orderBy, documentId, setDoc, doc, deleteDoc, updateDoc, where, getCountFromServer } from "firebase/firestore";
import db from "../db/firebase.js";

export async function obterInstituicoes(req, res) {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '',
      status = '',
      tipo = ''
    } = req.query;

    // Construir query base
    let q = collection(db, "instituicoes");
    let constraints = [];

    // Filtro por status
    if (status) {
      constraints.push(where("status", "==", status));
    }

    // Filtro por tipo
    if (tipo) {
      constraints.push(where("tipo", "==", tipo));
    }

    // Aplicar filtros
    if (constraints.length > 0) {
      q = query(q, ...constraints);
    }

    // Ordenação
    q = query(q, orderBy("nome", "asc"));

    // Executar query
    const snapshot = await getDocs(q);
    
    // Aplicar filtro de busca textual APÓS a query do Firestore
    let instituicoesFiltradas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filtro de busca textual - feito manualmente
    if (search) {
      const searchLower = search.toLowerCase();
      instituicoesFiltradas = instituicoesFiltradas.filter(instituicao => 
        instituicao.nome.toLowerCase().includes(searchLower) ||
        (instituicao.sigla && instituicao.sigla.toLowerCase().includes(searchLower)) ||
        (instituicao.cidade && instituicao.cidade.toLowerCase().includes(searchLower)) ||
        (instituicao.tipo && instituicao.tipo.toLowerCase().includes(searchLower))
      );
    }

    const total = instituicoesFiltradas.length;

    // Calcular paginação
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    
    // Aplicar paginação
    const instituicoesPaginadas = req.noPages ? instituicoesFiltradas : instituicoesFiltradas.slice(startIndex, endIndex);

    res.json({
      instituicoes: instituicoesPaginadas,
      paginacao: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar instituições" });
  }
}

export async function contarInstituicoes(req, res) {
  try {
    const queryBase = collection(db, "instituicoes");
    
    const total = (await getCountFromServer(queryBase)).data().count;
    const ativas = (await getCountFromServer(query(queryBase, where("status", "==", "Ativa")))).data().count;
    const inativas = (await getCountFromServer(query(queryBase, where("status", "==", "Inativa")))).data().count;

    // Contagem por tipo (opcional - para estatísticas mais detalhadas)
    const tipos = ["Universidade", "Laboratório", "Instituto", "Empresa", "Governamental"];
    const contagemPorTipo = {};
    
    for (const tipo of tipos) {
      contagemPorTipo[tipo] = (await getCountFromServer(query(queryBase, where("tipo", "==", tipo)))).data().count;
    }

    res.json({ 
      total, 
      ativas, 
      inativas,
      porTipo: contagemPorTipo
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao contar instituições" });
  }
}

export async function contarInstituicoesInterno(req, res) {
  try {
    const queryBase = collection(db, "instituicoes");
    
    const total = (await getCountFromServer(queryBase)).data().count;
    const ativas = (await getCountFromServer(query(queryBase, where("status", "==", "Ativa")))).data().count;
    const inativas = (await getCountFromServer(query(queryBase, where("status", "==", "Inativa")))).data().count;

    // Contagem por tipo (opcional - para estatísticas mais detalhadas)
    const tipos = ["Universidade", "Laboratório", "Instituto", "Empresa", "Governamental"];
    const contagemPorTipo = {};
    
    for (const tipo of tipos) {
      contagemPorTipo[tipo] = (await getCountFromServer(query(queryBase, where("tipo", "==", tipo)))).data().count;
    }

    return { 
      total, 
      ativas, 
      inativas,
      porTipo: contagemPorTipo
    };
  } catch (err) {
    console.error(err);
    return { total: 0, ativas: 0, inativas: 0, porTipo: {} };
  }
}

export async function obterInstituicoesInterno(user = false) {
  try {
    const snapshot = await getDocs(collection(db, "instituicoes"));

    const instituicoes = user ? snapshot.docs.map(doc => ({
      id: doc.id,
      tipoUsuario: 'Administrador',
      nome: doc.data().nome,
      cidade: doc.data().cidade,
      estado: doc.data().estado,
      status: doc.data().status      
    }))
    :
    snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return instituicoes;
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function obterInstituicao(req, res) {
  try {
    const { id } = req.params;

    const snapshot = await getDoc(doc(db, "instituicoes", id));

    if (!snapshot.exists()) return res.status(404).json( { message: "Instituição não existe" } );

    const instituicao = {
      id: snapshot.id,
      ...snapshot.data()
    };

    res.json(instituicao);
  } catch (err) {
    console.error(err);
    res.status(500).json( { error: "Ocorreu um erro ao buscar instituição" } );
  }
}

export async function cadastrarInstituicao(req, res) {
  try {
    const instituicao = req.body;

    if (!instituicao) res.json( { message: "Dados inválidos" } );

    await setDoc(doc(db, "instituicoes", await calcularId()), instituicao);

    res.json( { success: true, instituicao } );
  } catch (err) {
    console.error(err);
    res.status(500).json( { error: "Ocorreu um erro ao cadastrar instituição" } );
  }
}

export async function editarInstituicao(req, res) {
  try {
    const { id } = req.params;
    const alteracoes = req.body;

    if (!alteracoes) res.json( { message: "Dados inválidos" } );

    await updateDoc(doc(db, "instituicoes", id), alteracoes);

    res.json( { success: true } );
  } catch (err) {
    console.error(err);
    res.status(500).json( { error: "Ocorreu um erro ao editar instituição" } );
  }
}

export async function excluirInstituicao(req, res) {
  try {
    const { id } = req.params;

    await deleteDoc(doc(db, "instituicoes", id));

    res.json( { success: true } );
  } catch (err) {
    console.error(err);
    res.status(500).json( { error: "Ocorreu um erro ao excluir instituição" } );
  }
}

async function calcularId() {
  try {
    const snapshot = await getDocs(collection(db, "instituicoes"));
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
    return `IN-${novoId}`;
  } catch(err) {
    console.error(err);
  }
}