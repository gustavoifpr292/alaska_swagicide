// controllers/controllerDashboard.js
import { contarAmostrasInterno } from "./controllerAmostras.js";
import { contarAnalisesInterno } from "./controllerAnalises.js";
import { contarLaudosInterno } from "./controllerLaudos.js";
import { contarUsuariosInterno } from "./controllerUsers.js";
import { contarInstituicoesInterno } from "./controllerInstituicoes.js";
import { contarFazendasInterno } from "./controllerFazendas.js";
import { obterAmostrasInterno } from "./controllerAmostras.js";
import { obterLaudosInterno } from "./controllerLaudos.js";
import { obterAnalisesInterno } from "./controllerAnalises.js";
import { obterPedidosInterno } from "./controllerUsers.js";

export async function obterDadosDashboard(req, res) {
  try {
    const { tipoUsuario, instituicaoEscolhida, isADM, id } = req.user;
    
    let dados = {
      perfil: tipoUsuario,
      instituicao: instituicaoEscolhida,
      cards: {},
      graficos: {},
      recentes: {},
      alertas: []
    };

    // 🎯 DADOS PARA TODOS OS PERFIS
    dados.cards.estatisticasGerais = await obterEstatisticasGerais(req, res);
    
    // 📊 DADOS ESPECÍFICOS POR PERFIL
    switch (tipoUsuario) {
      case 'Apicultor':
        Object.assign(dados, await obterDadosApicultor(req, id));
        break;
      case 'Pesquisador':
        Object.assign(dados, await obterDadosPesquisador(req));
        break;
      case 'Coordenador':
        Object.assign(dados, await obterDadosCoordenador(req));
        break;
      case 'Administrador':
        Object.assign(dados, await obterDadosAdministrador(req));
        break;
    }

    // ⚠️ ALERTAS COMUNS
    dados.alertas = await obterAlertasSistema(req, dados);

    res.json(dados);
  } catch (err) {
    console.error("Erro no dashboard:", err);
    res.status(500).json({ error: "Erro ao carregar dados do dashboard" });
  }
}

// 📈 ESTATÍSTICAS GERAIS
async function obterEstatisticasGerais(req) {
  const [amostras, analises, laudos, usuarios] = await Promise.all([
    contarAmostrasInterno({...req, noPages: true}),
    contarAnalisesInterno({...req, noPages: true}),
    contarLaudosInterno({...req, noPages: true}),
    contarUsuariosInterno({...req, noPages: true})
  ]);

  return {
    amostras: amostras.total || 0,
    amostrasPendentes: amostras.pendentes || 0,
    analises: analises.total || 0,
    analisesPendentes: analises.pendentes || 0,
    laudos: laudos.total || 0,
    laudosPendentes: laudos.pendentes || 0,
    usuarios: usuarios.total || 0
  };
}

// 🐝 DADOS PARA APICULTOR
async function obterDadosApicultor(req, apicultorId) {
  // Buscar amostras recentes do apicultor
  const amostrasReq = {...req, query: { 
    produtor: apicultorId, 
    limit: 5,
    page: 1 
  }};
  
  // Buscar laudos recentes do apicultor
  const laudosReq = {...req, query: { 
    limit: 5,
    page: 1 
  }};

  const [amostrasRecentes, laudosRecentes] = await Promise.all([
    obterAmostrasInterno(amostrasReq),
    obterLaudosInterno({...laudosReq, params: {id: apicultorId}})
  ]);

  return {
    cards: {
      minhasAmostras: amostrasRecentes?.paginacao?.total || 0,
      meusLaudos: laudosRecentes?.paginacao?.total || 0
    },
    recentes: {
      amostras: amostrasRecentes?.amostras?.slice(0, 5) || [],
      laudos: laudosRecentes?.laudos?.slice(0, 5) || []
    },
    graficos: {
      tipoCultura: await obterGraficoTipoCulturaApicultor(req)
    }
  };
}

async function obterGraficoUsoPorInstituicao(req) {
  try {
    // Pega todas as instituições
    const { porTipo } = await contarInstituicoesInterno({ ...req, isADM: true });

    const resultado = {};

    // Para cada instituição, obter quantidade de amostras/analises/laudos
    for (const idInstituicao of Object.keys(porTipo)) {
      const reqInst = {
        ...req,
        isADM: false,
        user: { ...req.user, instituicaoEscolhida: { id: idInstituicao } }
      };

      const [amostras, analises, laudos] = await Promise.all([
        contarAmostrasInterno(reqInst),
        contarAnalisesInterno(reqInst),
        contarLaudosInterno(reqInst)
      ]);

      resultado[idInstituicao] = {
        amostras: amostras.total || 0,
        analises: analises.total || 0,
        laudos: laudos.total || 0
      };
    }

    return resultado;

  } catch (e) {
    console.error("Erro em obterGraficoUsoPorInstituicao:", e);
    return {};
  }
}

// 🔬 DADOS PARA PESQUISADOR
async function obterDadosPesquisador(req, res) {
  // Buscar análises atribuídas ao pesquisador
  const analisesReq = {...req, query: { 
    pesquisador: req.user.id,
    limit: 10,
    page: 1 
  }};

  const analisesRecentes = await obterAnalisesInterno(analisesReq);

  return {
    cards: {
      analisesPendentes: analisesRecentes?.analises?.filter(a => a.status === 'Pendente').length || 0,
      analisesConcluidas: analisesRecentes?.analises?.filter(a => a.status === 'Concluída').length || 0
    },
    recentes: {
      analises: analisesRecentes?.analises?.slice(0, 5) || []
    },
    graficos: {
      statusAnalises: await obterGraficoStatusAnalisesPesquisador(req)
    }
  };
}

// 👨‍💼 DADOS PARA COORDENADOR
async function obterDadosCoordenador(req) {
  const [pedidosPendentes, fazendas, usuarios] = await Promise.all([
    obterPedidosInterno({...req, noPages: true}),
    contarFazendasInterno({...req, noPages: true}),
    contarUsuariosInterno({...req, noPages: true})
  ]);

  return {
    cards: {
      pedidosPendentes: pedidosPendentes?.length || 0,
      fazendasAtivas: fazendas.ativas || 0,
      pesquisadores: usuarios.pesquisadores || 0,
      apicultores: usuarios.apicultores || 0
    },
    graficos: {
      desempenhoEquipe: await obterGraficoDesempenhoEquipe(req),
      tipoAnalises: await obterGraficoTipoAnalises(req)
    }
  };
}

// ⚙️ DADOS PARA ADMINISTRADOR
async function obterDadosAdministrador(req) {
  const [instituicoes, estatisticasGlobais] = await Promise.all([
    contarInstituicoesInterno({...req, noPages: true}),
    obterEstatisticasGlobais(req)
  ]);

  return {
    cards: {
      instituicoesAtivas: instituicoes.ativas || 0,
      ...estatisticasGlobais
    },
    graficos: {
      instituicoesPorTipo: instituicoes.porTipo || {},
      usoPorInstituicao: await obterGraficoUsoPorInstituicao(req)
    }
  };
}

// 📊 FUNÇÕES AUXILIARES PARA GRÁFICOS
async function obterGraficoTipoCulturaApicultor(req) {
  // Implementar lógica para agrupar amostras por tipo de cultura
  const amostrasReq = {...req, query: { 
    produtor: req.user.id,
    noPages: true
  }};
  
  try {
    const amostras = await obterAmostrasInterno(amostrasReq);
    const agrupado = {};
    
    amostras.amostras?.forEach(amostra => {
      const cultura = amostra.cultura || 'Não informado';
      agrupado[cultura] = (agrupado[cultura] || 0) + 1;
    });
    
    return agrupado;
  } catch (err) {
    console.error("Erro ao gerar gráfico de cultura:", err);
    return {};
  }
}

async function obterGraficoStatusAnalisesPesquisador(req) {
  const analisesReq = {...req, query: { 
    pesquisador: req.user.id,
    noPages: true
  }};
  
  try {
    const analises = await obterAnalisesInterno(analisesReq);
    const status = {
      'Pendente': 0,
      'Em Andamento': 0,
      'Concluída': 0
    };
    
    analises.analises?.forEach(analise => {
      status[analise.status] = (status[analise.status] || 0) + 1;
    });
    
    return status;
  } catch (err) {
    console.error("Erro ao gerar gráfico de status:", err);
    return {};
  }
}

async function obterGraficoDesempenhoEquipe(req) {
  // Implementar lógica de desempenho da equipe
  return {
    'Pesquisador 1': 15,
    'Pesquisador 2': 12,
    'Pesquisador 3': 8
  };
}

async function obterEstatisticasGlobais(req) {
  // Para admin - estatísticas de todo o sistema
  return {
    totalInstituicoes: 0,
    totalUsuarios: 0,
    totalAmostras: 0,
    syncStatus: 'Sincronizado'
  };
}

// ⚠️ SISTEMA DE ALERTAS
async function obterAlertasSistema(req, dados) {
  const alertas = [];
  const hoje = new Date();
  
  // Alertas baseados nos dados do dashboard
  if (dados.cards.estatisticasGerais?.analisesPendentes > 10) {
    alertas.push({
      tipo: 'warning',
      mensagem: `${dados.cards.estatisticasGerais.analisesPendentes} análises pendentes`,
      icone: 'pending_actions'
    });
  }
  
  if (dados.cards?.pedidosPendentes > 0) {
    alertas.push({
      tipo: 'info',
      mensagem: `${dados.cards.pedidosPendentes} pedidos de cadastro pendentes`,
      icone: 'person_add'
    });
  }
  
  return alertas;
}

export default {
  obterDadosDashboard
};