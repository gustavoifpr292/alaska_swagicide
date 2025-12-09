import API_BASE_URL from '../../../chave_api.js'

document.addEventListener('DOMContentLoaded', () => {
  //const API_BASE_URL = 'http://localhost:3000';
  let laudos = [];
  let analisesDisponiveis = [];
  let editIndex = null;
  let usuarioLogado = null;
  let paginacaoAtual = null;

  // Variáveis de estado para filtros e paginação
  let currentPage = 1;
  let currentLimit = 10;
  let currentFilters = {
    search: '',
    status: '',
    dataInicio: '',
    dataFim: '',
    pesquisador: ''
  };

  // Elementos DOM
  const reportForm = document.getElementById('reportForm');
  const saveReportBtn = document.getElementById('saveReportBtn');
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('newReportModal'));
  const tbody = document.querySelector('tbody');
  const addLaudoBtn = document.getElementById('addLaudo');
  const addAnaliseBtn = document.getElementById('addAnalise');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.querySelector('.loading-text');
  const progressFill = document.querySelector('.progress-fill');

  // === SISTEMA DE LOADING ===
  let loadingCount = 0;
  let currentLoadingMessage = '';

  function showLoading(message = 'Processando...', isLongOperation = false) {
    if (loadingCount === 0) {
      if (loadingText) {
        loadingText.textContent = message;
        currentLoadingMessage = message;
      }
      if (isLongOperation) {
        loadingOverlay.classList.add('long-operation');
      } else {
        loadingOverlay.classList.remove('long-operation');
      }
      loadingOverlay.classList.add('show');
      document.body.style.overflow = 'hidden';
    } else {
      if (message !== currentLoadingMessage && loadingText) {
        loadingText.textContent = message;
        currentLoadingMessage = message;
      }
    }
    loadingCount++;
  }

  function hideLoading() {
    loadingCount = Math.max(0, loadingCount - 1);
    
    if (loadingCount === 0) {
      loadingOverlay.classList.remove('show');
      document.body.style.overflow = '';
      if (progressFill) {
        progressFill.style.animation = 'none';
        setTimeout(() => {
          progressFill.style.animation = '';
        }, 10);
      }
      currentLoadingMessage = '';
    }
  }

  function updateLoadingText(message) {
    if (loadingText && loadingCount > 0) {
      loadingText.textContent = message;
      currentLoadingMessage = message;
    }
  }

  // === SISTEMA DE VALIDAÇÃO DE COMPATIBILIDADE ===
  const SistemaValidacaoLaudos = {
    validarCompatibilidade(analises) {
      if (analises.length <= 1) return { valido: true };
      
      const erros = [];
      const warnings = [];
      
      const apicultoresIds = [...new Set(analises.map(a => a.idApicultor || a.apicultor))];
      if (apicultoresIds.length > 1) {
        erros.push('Análises de apicultores diferentes não podem estar no mesmo laudo');
      }
      
      const fazendasIds = [...new Set(analises.map(a => a.idFazenda || a.fazenda))];
      if (fazendasIds.length > 1) {
        erros.push('Análises de fazendas/origens diferentes não podem estar no mesmo laudo');
      }
      
      const tipos = [...new Set(analises.map(a => a.tipo))];
      if (tipos.length > 1) {
        warnings.push('Atenção: Misturando diferentes tipos de análise no mesmo laudo');
      }
      
      const datas = analises.map(a => new Date(a.data || a.dataAnalisada));
      const diffTempo = Math.max(...datas) - Math.min(...datas);
      const diffDias = diffTempo / (1000 * 60 * 60 * 24);
      
      if (diffDias > 30) {
        warnings.push(`Atenção: Análises com ${Math.round(diffDias)} dias de diferença`);
      }
      
      return {
        valido: erros.length === 0,
        erros,
        warnings
      };
    },
    
    agruparAnalisesCompativeis(analises) {
      const grupos = {};
      
      analises.forEach(analise => {
        const chave = `${analise.idApicultor || analise.apicultor}-${analise.idFazenda || analise.fazenda}`;
        if (!grupos[chave]) {
          grupos[chave] = [];
        }
        grupos[chave].push(analise);
      });
      
      return grupos;
    },

    obterOrigens(origem = '') {
      if (!origem) return {nomeApicultor: 'N/A', nomeFazenda: 'N/A'};
      const origens = origem.split(" - ");
      const nomeApicultor = origens[0].trim();
      const nomeFazenda = `${origens[2]} - ${origens[3]}`.trim();
      return {nomeApicultor, nomeFazenda};
    },

    obterInfoAnaliseParaSelect(analise) {
      const nomes = this.obterOrigens(analise.origem);
      return {
        id: analise.id,
        tipo: analise.tipo || 'N/A',
        data: analise.dataAnalisada || analise.data || 'N/A',
        apicultor: nomes.nomeApicultor,
        fazenda: nomes.nomeFazenda,
        status: analise.status || 'N/A'
      };
    },
    
    sugerirAgrupamentos(analises) {
      const grupos = this.agruparAnalisesCompativeis(analises);
      const sugestoes = [];
      
      Object.entries(grupos).forEach(([chave, analisesGrupo]) => {
        if (analisesGrupo.length > 0) {
          const primeira = analisesGrupo[0];
          const nomes = this.obterOrigens(primeira.origem);
          sugestoes.push({
            nome: `Laudo - ${nomes.nomeApicultor} (${nomes.nomeFazenda})`,
            analises: analisesGrupo,
            quantidade: analisesGrupo.length,
            apicultor: primeira.idApicultor || primeira.apicultor,
            fazenda: primeira.idFazenda || primeira.fazenda,
            nomeApicultor: nomes.nomeApicultor,
            nomeFazenda: nomes.nomeFazenda
          });
        }
      });
      
      return sugestoes;
    },
    
    obterInfoOrigem(analises) {
      if (!analises || analises.length === 0) return { apicultor: 'N/A', fazenda: 'N/A' };
      const primeira = analises[0];
      const nomes = this.obterOrigens(primeira.origem);
      return {
        apicultor: nomes.nomeApicultor || `Apicultor ${primeira.idApicultor}`,
        fazenda: nomes.nomeFazenda || `Fazenda ${primeira.idFazenda}`,
        idApicultor: primeira.idApicultor,
        idFazenda: primeira.idFazenda
      };
    }
  };

  // === SISTEMA DE NOTIFICAÇÕES ===
  function showNotification({
    title,
    message,
    type = 'info',
    duration = 5000,
    action = null
  } = {}) {
    const container = document.getElementById('notificationContainer');
    const notificationId = 'notification-' + Date.now();
    
    const icons = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.id = notificationId;
    
    notification.innerHTML = `
      <div class="notification-icon">
        <i class="material-symbols-rounded">${icons[type]}</i>
      </div>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close" onclick="closeNotification('${notificationId}')">
        <i class="material-symbols-rounded">close</i>
      </button>
      ${duration > 0 ? `
        <div class="notification-progress">
          <div class="notification-progress-bar" style="animation-duration: ${duration}ms"></div>
        </div>
      ` : ''}
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    if (duration > 0) {
      setTimeout(() => {
        closeNotification(notificationId);
      }, duration);
    }
    
    return notificationId;
  }

  function closeNotification(notificationId) {
    const notification = document.getElementById(notificationId);
    if (notification) {
      notification.classList.remove('show');
      notification.classList.add('hiding');
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }

  window.closeNotification = closeNotification;

  function showSuccess(message, title = 'Sucesso!') {
    return showNotification({
      title,
      message,
      type: 'success',
      duration: 4000
    });
  }

  function showError(message, title = 'Erro!') {
    return showNotification({
      title,
      message,
      type: 'error',
      duration: 6000
    });
  }

  function showWarning(message, title = 'Atenção!') {
    return showNotification({
      title,
      message,
      type: 'warning',
      duration: 5000
    });
  }

  function showInfo(message, title = 'Informação') {
    return showNotification({
      title,
      message,
      type: 'info',
      duration: 4000
    });
  }

  // === FUNÇÕES DE SEGURANÇA ===
  function getAuthToken() {
    return localStorage.getItem('token');
  }

  function isAuthenticated() {
    return !!getAuthToken();
  }

  function checkAuth() {
    if (!isAuthenticated()) {
      showError('Você precisa fazer login primeiro', 'Sessão Expirada');
      setTimeout(() => {
        window.location.href = '../pages/login.html';
      }, 2000);
      return false;
    }
    return true;
  }

  function getAuthHeaders(colecao = null, authorized = null) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    };
    
    if (colecao) {
      headers['ObjectCollection'] = colecao;
    }

    if (authorized) {
      headers['Authorized'] = 1;
    }
    
    return headers;
  }

  function handleAuthError() {
    hideLoading();
    localStorage.removeItem('token');
    showError('Sua sessão expirou. Redirecionando para login...', 'Sessão Expirada');
    setTimeout(() => {
      window.location.href = '../pages/login.html';
    }, 2000);
  }

  async function getUser() {
    if (!isAuthenticated()) return null;
    
    try {
      const response = await fetch(`${API_BASE_URL}/profile`, {
        headers: getAuthHeaders()
      });

      if (response.status === 401) {
        handleAuthError();
        return null;
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar dados do usuário');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      return null;
    }
  }

  async function carregarPesquisadoresFilter() {
    if (!checkAuth()) return;

    showLoading('Carregando pesquisadores...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/usuarios/pesquisadores`, {
        headers: getAuthHeaders('usuarios', true)
      });

      const select = document.getElementById('filter-pesquisadores');

      if (!response.ok) {
        if (response.status != 404) throw new Error("Há algo de errado na resposta da API")
        //console.log(await response.json());
        const option = document.createElement('option');
        option.text = "Não há pesquisadores disponíveis";
        option.disabled = true;
        select.appendChild(option);
        hideLoading();
        return;
      }

      const pesquisadores = await response.json();

      pesquisadores.forEach(pesquisador => {
        const option = document.createElement('option');
        option.value = pesquisador.id;
        option.text = `${pesquisador.nome} - ${pesquisador.username}`;
        select.appendChild(option);
      });

      hideLoading();
    } catch (error) {
      console.error('Erro ao carregar pesquisadores:', error);
      hideLoading();
      showError('Erro ao carregar pesquisadores', 'Erro de Carregamento');
    }
  }

  // === SISTEMA DE FILTROS ===
  function configurarFiltros() {
    // Filtro de busca por código
    const searchFilter = document.getElementById('search-filter');
    if (searchFilter) {
      searchFilter.addEventListener('input', debounce((e) => {
        currentFilters.search = e.target.value;
        currentPage = 1;
        carregarLaudos(currentPage, currentFilters);
      }, 500));
    }

    // Filtro de status
    const statusFilter = document.getElementById('filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        currentFilters.status = e.target.value;
        currentPage = 1;
        carregarLaudos(currentPage, currentFilters);
      });
    }

    // Filtro de data início
    const dataInicioFilter = document.getElementById('filter-data-inicio');
    if (dataInicioFilter) {
      dataInicioFilter.addEventListener('change', (e) => {
        currentFilters.dataInicio = e.target.value;
        currentPage = 1;
        carregarLaudos(currentPage, currentFilters);
      });
    }

    // Filtro de data fim
    const dataFimFilter = document.getElementById('filter-data-fim');
    if (dataFimFilter) {
      dataFimFilter.addEventListener('change', (e) => {
        currentFilters.dataFim = e.target.value;
        currentPage = 1;
        carregarLaudos(currentPage, currentFilters);
      });
    }

    const pesquisadoresFilter = document.getElementById('filter-pesquisadores');
    if (pesquisadoresFilter) {
      pesquisadoresFilter.addEventListener('change', (e) => {
        currentFilters.pesquisador = e.target.value;
        currentPage = 1;
        carregarLaudos(currentPage, currentFilters);
      });
    }

    // Botão limpar filtros
    adicionarBotaoLimparFiltros();
  }

  function adicionarBotaoLimparFiltros() {
    const cardHeader = document.querySelector('.card-header .row');
    if (!cardHeader) return;

    if (document.getElementById('limpar-filtros')) return;

    const limparBtn = document.createElement('button');
    limparBtn.id = 'limpar-filtros';
    limparBtn.className = 'btn btn-outline-secondary mb-0';
    limparBtn.innerHTML = '<i class="material-symbols-rounded me-1">clear_all</i> Limpar';
    limparBtn.addEventListener('click', limparFiltros);

    const col = document.createElement('div');
    col.className = 'col-md-1 text-end';
    col.appendChild(limparBtn);
    cardHeader.appendChild(col);
  }

  function limparFiltros() {
    // Limpar valores dos inputs
    document.getElementById('search-filter').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-data-inicio').value = '';
    document.getElementById('filter-data-fim').value = '';
    document.getElementById('filter-pesquisadores').value = '';

    // Resetar filtros
    currentFilters = {
      search: '',
      status: '',
      dataInicio: '',
      dataFim: '',
      pesquisador: ''
    };
    currentPage = 1;

    // Recarregar laudos
    carregarLaudos();
    showInfo('Filtros limpos', 'Filtros');
  }

  // === SISTEMA DE PAGINAÇÃO ===
  function atualizarPaginacao(paginacao) {
    const paginationContainer = document.querySelector('.pagination');
    if (!paginationContainer || !paginacao) return;

    const { page, pages, total } = paginacao;
    
    let paginationHTML = `
      <li class="page-item ${page === 1 ? 'disabled' : ''}">
        <a class="page-link" href="javascript:;" onclick="mudarPagina(${page - 1})">
          <i class="material-symbols-rounded">chevron_left</i>
        </a>
      </li>
    `;

    // Gerar números de página
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) {
        paginationHTML += `
          <li class="page-item ${i === page ? 'active' : ''}">
            <a class="page-link" href="javascript:;" onclick="mudarPagina(${i})">${i}</a>
          </li>
        `;
      } else if (i === page - 3 || i === page + 3) {
        paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
      }
    }

    paginationHTML += `
      <li class="page-item ${page === pages ? 'disabled' : ''}">
        <a class="page-link" href="javascript:;" onclick="mudarPagina(${page + 1})">
          <i class="material-symbols-rounded">chevron_right</i>
        </a>
      </li>
    `;

    paginationContainer.innerHTML = paginationHTML;
    
    // Atualizar contador
    const quantElement = document.getElementById('quantLaudos');
    if (quantElement) {
      const start = ((page - 1) * currentLimit) + 1;
      const end = Math.min(page * currentLimit, total);
      quantElement.textContent = `${start}-${end} de ${total} laudos`;
    }
  }

  function mudarPagina(novaPagina) {
    if (!paginacaoAtual) return;
  
    if (novaPagina < 1 || novaPagina > paginacaoAtual.pages) return;
  
    currentPage = novaPagina;
    carregarLaudos(currentPage, currentFilters);
  }

  // === FUNÇÃO DE DEBOUNCE ===
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // ========== FUNÇÕES PARA LAUDOS ==========

  async function fetchLaudos(filters = {}, page = 1, limit = 10) {
    if (!checkAuth()) return { laudos: [], paginacao: {} };
    
    showLoading('Carregando laudos...');
    
    try {
      // Construir query string com filtros
      const queryParams = new URLSearchParams({
        page,
        limit,
        ...filters
      });

      const response = await fetch(`${API_BASE_URL}/laudos/?${queryParams}`, {
        headers: getAuthHeaders('laudos')
      });
      
      if (response.status === 401) {
        handleAuthError();
        return { laudos: [], paginacao: {} };
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar laudos');
      }
      
      updateLoadingText('Processando dados...');
      const dados = await response.json();
      return dados;
      
    } catch (error) {
      console.error('Erro:', error);
      showError('Não foi possível carregar os laudos', 'Erro de Conexão');
      return { laudos: [], paginacao: {} };
    } finally {
      hideLoading();
    }
  }

  async function fetchAnalisesParaLaudos() {
    if (!checkAuth()) return [];
    
    showLoading('Carregando análises...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/analises/`, {
        headers: { noPages: 1, ...getAuthHeaders("analises")}
      });
      
      if (response.status === 401) {
        handleAuthError();
        return [];
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar análises');
      }
      
      updateLoadingText('Processando dados...');
      const analises = (await response.json()).analises;
      //return analises.filter(analise => analise.status === 'Concluída');
      return analises;
    } catch (error) {
      console.error('Erro:', error);
      showError('Não foi possível carregar as análises', 'Erro de Conexão');
      return [];
    } finally {
      hideLoading();
    }
  }

  async function salvarLaudo(laudo, id = null) {
    if (!checkAuth()) return;
    
    showLoading(id ? 'Atualizando laudo...' : 'Salvando laudo...');
    
    try {
      const url = id ? `${API_BASE_URL}/laudos/${id}` : `${API_BASE_URL}/laudos/`;
      const method = id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: getAuthHeaders("laudos"),
        body: JSON.stringify(laudo)
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao salvar laudo');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao salvar laudo', 'Erro de Salvamento');
      throw error;
    }
  }

  async function excluirLaudoAPI(id) {
    if (!checkAuth()) return;
    
    showLoading('Excluindo laudo...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/laudos/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders('laudos')
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao excluir laudo');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao excluir laudo', 'Erro de Exclusão');
      throw error;
    }
  }

  async function vincularAnaliseLaudoAPI(idLaudo, idAnalise) {
    if (!checkAuth()) return;
    
    showLoading('Vinculando análise...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/laudos/${idLaudo}/${idAnalise}`, {
        method: 'POST',
        headers: getAuthHeaders('laudos')
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao vincular análise');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao vincular análise', 'Erro de Vinculação');
      throw error;
    }
  }

  async function desvincularAnaliseLaudoAPI(idLaudo, idAnalise) {
    if (!checkAuth()) return;
    
    showLoading('Desvinculando análise...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/laudos/${idLaudo}/${idAnalise}`, {
        method: 'DELETE',
        headers: getAuthHeaders('laudos')
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao desvincular análise');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao desvincular análise', 'Erro de Desvinculação');
      throw error;
    }
  }

  async function carregarCardsLaudos() {
    if (!checkAuth()) return;
    
    showLoading('Carregando estatísticas...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/laudos/count`, {
        headers: getAuthHeaders("laudos"),
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar estatísticas');
      }
      
      const totais = await response.json();
      atualizarCards(totais);
      
    } catch (error) {
      console.error('Erro ao carregar cards:', error);
      showError('Erro ao carregar estatísticas', 'Erro de Conexão');
    } finally {
      hideLoading();
    }
  }

  function atualizarCards(totais) {
    const cards = document.querySelectorAll('.card-header h4');
    if (cards.length >= 3) {
      cards[0].textContent = totais.laudosHoje || '0';
      cards[1].textContent = totais.pendentes || '0';
      cards[2].textContent = totais.emitidos || '0';
    }
  }

  // ========== FUNÇÕES DE CARREGAMENTO E RENDERIZAÇÃO ==========

  async function carregarLaudos(page = 1, filters = currentFilters) {
    if (!checkAuth()) return;
    
    try {
      const resultado = await fetchLaudos(filters, page, currentLimit);
      laudos = resultado.laudos || [];
      renderizarLaudos();
      paginacaoAtual = resultado.paginacao; 
      atualizarPaginacao(resultado.paginacao);
      atualizarEstatisticas();
      
      if (laudos.length > 0) {
        showSuccess(`${resultado.paginacao?.total || laudos.length} laudos encontrados`, 'Dados Carregados');
      } else {
        showWarning('Nenhum laudo encontrado com os filtros aplicados', 'Sem Dados');
      }
    } catch (error) {
      console.error('Erro ao carregar laudos:', error);
    }
  }

  async function carregarAnalisesDisponiveis() {
    if (!checkAuth()) return;
    
    try {
      analisesDisponiveis = await fetchAnalisesParaLaudos();
      
      if (analisesDisponiveis.length > 0) {
        showInfo(`${analisesDisponiveis.length} análises disponíveis`, 'Análises Carregadas');
      } else {
        showWarning('Nenhuma análise concluída disponível', 'Sem Análises');
      }
    } catch (error) {
      console.error('Erro ao carregar análises:', error);
    }
  }

  function renderizarLaudos() {
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (laudos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4">
            <i class="material-symbols-rounded text-muted mb-2" style="font-size: 3rem;">description</i>
            <p class="text-muted mb-0">Nenhum laudo encontrado</p>
          </td>
        </tr>
      `;
      return;
    }

    laudos.forEach((laudo) => {
      const primeiraAnalise = laudo.analises && laudo.analises[0] ? laudo.analises[0] : {};
      const infoOrigem = SistemaValidacaoLaudos.obterInfoOrigem(laudo.analises || []);
      const permissaoEditarOuExcluir = (usuarioLogado.id === laudo.idUsuario && laudo.status === "Pendente") || usuarioLogado.tipoUsuario === 'Administrador';      

      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td>
          <div class="d-flex px-2 py-1">
            <div class="d-flex flex-column justify-content-center">
              <h6 class="mb-0 text-sm">${laudo.id}</h6>
              <p class="text-xs text-secondary mb-0">${infoOrigem.apicultor}</p>
            </div>
          </div>
        </td>
        <td>
          <p class="text-sm font-weight-bold mb-0">${primeiraAnalise.id || 'N/A'}</p>
          <p class="text-xs text-secondary mb-0">
            ${laudo.analises ? laudo.analises.length + ' análise(s)' : 'Sem análises'} | ${infoOrigem.fazenda}
          </p>
        </td>
        <td class="align-middle text-center text-sm">
          <span class="text-xs font-weight-bold">${laudo.responsavel || 'N/A'}</span>
        </td>
        <td class="align-middle text-center">
          <span class="text-secondary text-xs font-weight-bold">${laudo.dataEmissao || laudo.data || 'N/A'}</span>
        </td>
        <td class="align-middle text-center">
          <span class="badge badge-sm ${getStatusBadgeClass(laudo.status)}">${laudo.status || 'Pendente'}</span>
        </td>
        <td class="align-middle text-center">
          ${permissaoEditarOuExcluir ? `<a href="javascript:;" class="text-secondary font-weight-bold text-xs" onclick="editarLaudo('${laudo.id}')" data-toggle="tooltip" title="Editar">
            <i class="material-symbols-rounded">edit</i>
          </a>` : ''}
          <a href="javascript:;" class="text-secondary font-weight-bold text-xs ms-2" onclick="visualizarLaudo('${laudo.id}')" data-toggle="tooltip" title="Visualizar">
            <i class="material-symbols-rounded">visibility</i>
          </a>
          <a href="javascript:;" class="text-secondary font-weight-bold text-xs ms-2" onclick="imprimirLaudo('${laudo.id}')" data-toggle="tooltip" title="Imprimir">
            <i class="material-symbols-rounded">print</i>
          </a>
          ${permissaoEditarOuExcluir ? `<a href="javascript:;" class="text-danger font-weight-bold text-xs ms-2" onclick="removerLaudo('${laudo.id}')" data-toggle="tooltip" title="Excluir">
            <i class="material-symbols-rounded">delete</i>
          </a>` : ''}
        </td>
      `;

      tbody.appendChild(tr);
    });

    const quantElement = document.getElementById('quantLaudos');
    if (quantElement) {
      quantElement.textContent = `${laudos.length} laudos`;
    }
  }

  function atualizarEstatisticas() {
    // Esta função pode ser mantida para lógica adicional se necessário
    // Os cards principais agora são atualizados por atualizarCards()
  }

  // ========== FUNÇÕES AUXILIARES ==========

  function getStatusBadgeClass(status) {
    switch(status?.toLowerCase()) {
      case 'emitido': return 'bg-gradient-success';
      case 'pendente': return 'bg-gradient-warning';
      case 'rejeitado': return 'bg-gradient-danger';
      default: return 'bg-gradient-secondary';
    }
  }

  function formatDateForInput(dateString) {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return '';
    }
  }

  function formatarData(dataString) {
    if (!dataString) return '';
    
    try {
      const date = new Date(dataString);
      return date.toLocaleDateString('pt-BR');
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return dataString;
    }
  }

  function getDataAtual() {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
  }

  function diferenca(a, b) {
    const c = new Set();
    for (let i = 0; i < a.length; i++) {
      let diferentao = true;
      for (let j = 0; j < b.length; j++) {
        if (a[i].id === b[j].id) diferentao = false;
      }
      if (diferentao) c.add(a[i].id);
    }
    return Array.from(c);
  }

  function interseccao(a, b) {
    const c = new Set();
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        if (a[i].id == b[j]) c.add(a[i]);
      }
    }
    return Array.from(c);
  }

  // ========== FUNÇÕES PARA LAUDOS (CRUD) ==========

  async function buscarLaudoPorId(id) {
    if (!checkAuth()) return null;
    
    showLoading('Carregando laudo...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/laudos/${id}`, {
        headers: getAuthHeaders('laudos')
      });
      
      if (response.status === 401) {
        handleAuthError();
        return null;
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar laudo');
      }
      
      const laudo = await response.json();
      return laudo;
      
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao carregar laudo', 'Erro de Carregamento');
      return null;
    } finally {
      hideLoading();
    }
  }

  function preencherFormulario(laudo, disabled = false) {
    const inputs = reportForm.querySelectorAll('input, select, textarea');
    
    document.getElementById('idLaudo').value = laudo.id || 'LD-2024-XXXX';
    
    if (window.editIndex) {
      document.getElementById('dataEmissao').value = formatDateForInput(laudo.dataEmissao || laudo.data);
    } else {
      document.getElementById('dataEmissao').value = getDataAtual();
    }
    
    document.getElementById('responsavelLaudo').value = usuarioLogado ? usuarioLogado.nome : (laudo.responsavel || '');
    document.getElementById('conclusaoLaudo').value = laudo.conclusao || '';
    document.getElementById('observacoesLaudo').value = laudo.observacoes || '';

    const tbody = document.querySelector('#newReportModal tbody');
    tbody.innerHTML = '';
    
    if (laudo.analises && Array.isArray(laudo.analises)) {
      const infoOrigem = SistemaValidacaoLaudos.obterInfoOrigem(laudo.analises);
      
      const headerRow = document.createElement('tr');
      headerRow.innerHTML = `
        <td colspan="5" class="bg-light">
          <small class="text-primary">
            <i class="material-symbols-rounded fs-6">person</i> ${infoOrigem.apicultor} | 
            <i class="material-symbols-rounded fs-6">location_on</i> ${infoOrigem.fazenda}
          </small>
        </td>
      `;
      tbody.appendChild(headerRow);
      
      laudo.analises.forEach(analise => {
        const infoAnalise = SistemaValidacaoLaudos.obterInfoAnaliseParaSelect(analise);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <select class="form-control form-control-sm analise-select" ${disabled ? 'disabled' : 'required'}>
              <option value="${analise.id}">${analise.id} - ${analise.tipo}</option>
            </select>
          </td>
          <td class="text-sm">${infoAnalise.tipo}</td>
          <td class="text-sm">${infoAnalise.apicultor}</td>
          <td class="text-sm">${infoAnalise.fazenda}</td>
          <td class="text-sm">${formatarData(infoAnalise.data)}</td>
          <td>
            <button class="btn btn-sm ${disabled ? 'bg-gradient-secondary' : 'bg-gradient-danger'} mb-0" 
                    ${disabled ? 'disabled' : ''} 
                    onclick="this.closest('tr').remove()">
              <i class="material-symbols-rounded fs-6">${disabled ? 'lock' : 'delete'}</i>
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    inputs.forEach((el, i) => {
      el.disabled = i === 0 || i === 2 || disabled;
    });

    document.getElementById('dataEmissao').disabled = true;
    saveReportBtn.style.display = disabled ? 'none' : 'inline-block';
  }

  function getDadosFormularioLaudo() {
    let analisesSelecionadas = [];
    document.querySelectorAll('.analise-select').forEach(select => {
      if (select.value) {
        analisesSelecionadas.push(select.value);
      }
    });

    return {
      dataEmissao: document.getElementById('dataEmissao').value,
      responsavel: document.getElementById('responsavelLaudo').value,
      conclusao: document.getElementById('conclusaoLaudo').value,
      observacoes: document.getElementById('observacoesLaudo').value,
      idInstituicao: usuarioLogado.instituicaoEscolhida.id,
      status: 'Pendente',
      analises: analisesSelecionadas
    };
  }

  function adicionarLinhaAnalise() {
    const tbody = document.querySelector('#newReportModal tbody');
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>
        <select class="form-control form-control-sm analise-select" required>
          <option value="">Selecione uma análise...</option>
          ${analisesDisponiveis.map(analise => {
            const info = SistemaValidacaoLaudos.obterInfoAnaliseParaSelect(analise);
            return `<option value="${analise.id}">
              ${analise.id} - ${info.tipo} (${info.apicultor})
            </option>`;
          }).join('')}
        </select>
      </td>
      <td class="text-sm">-</td>
      <td class="text-sm">-</td>
      <td class="text-sm">-</td>
      <td class="text-sm">-</td>
      <td>
        <button type="button" class="btn btn-sm bg-gradient-danger mb-0" onclick="this.closest('tr').remove()">
          <i class="material-symbols-rounded fs-6">delete</i>
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  }

  // ========== SISTEMA DE SUGESTÕES AUTOMÁTICAS ==========

  async function sugerirLaudosAutomaticos() {
    if (!checkAuth()) return;
    
    try {
      showLoading('Analisando compatibilidade de análises...');
      
      const analises = await fetchAnalisesParaLaudos();
      const sugestoes = SistemaValidacaoLaudos.sugerirAgrupamentos(analises);
      
      hideLoading();
      
      if (sugestoes.length > 0) {
        mostrarModalSugestoes(sugestoes);
      } else {
        showInfo('Nenhum agrupamento sugerido encontrado', 'Sugestões');
      }
      
    } catch (error) {
      console.error('Erro ao gerar sugestões:', error);
      hideLoading();
    }
  }

  function mostrarModalSugestoes(sugestoes) {
    const modalHtml = `
      <div class="modal fade" id="sugestoesModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-gradient-info text-white">
              <h5 class="modal-title">
                <i class="material-symbols-rounded me-2">lightbulb</i>
                Sugestões de Laudos por Origem
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="text-sm mb-3">Sugestões baseadas no mesmo apicultor e fazenda:</p>
              <div class="list-group">
                ${sugestoes.map(sugestao => `
                  <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                      <div>
                        <h6 class="mb-1">${sugestao.nome}</h6>
                        <p class="mb-1 text-sm">${sugestao.quantidade} análise(s) do mesmo produtor</p>
                        <small class="text-muted">Apicultor: ${sugestao.nomeApicultor} | Fazenda: ${sugestao.nomeFazenda}</small>
                      </div>
                      <button class="btn btn-sm bg-gradient-primary" onclick="criarLaudoComAnalises([${sugestao.analises.map(a => `'${a.id}'`).join(',')}])">
                        <i class="material-symbols-rounded me-1">add</i> Criar
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    if (!document.getElementById('sugestoesModal')) {
      document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    
    const modal = new bootstrap.Modal(document.getElementById('sugestoesModal'));
    modal.show();
  }

  async function criarLaudoComAnalises(idsAnalises) {
    const modalSugestoes = bootstrap.Modal.getInstance(document.getElementById('sugestoesModal'));
    if (modalSugestoes) modalSugestoes.hide();
    
    abrirModalNovoLaudo();
    
    setTimeout(() => {
      const tbody = document.querySelector('#newReportModal tbody');
      tbody.innerHTML = '';
      
      const primeiraAnalise = analisesDisponiveis.find(a => a.id === idsAnalises[0]);
      if (primeiraAnalise) {
        const infoOrigem = SistemaValidacaoLaudos.obterInfoOrigem([primeiraAnalise]);
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
          <td colspan="5" class="bg-light">
            <small class="text-primary">
              <i class="material-symbols-rounded fs-6">person</i> ${infoOrigem.apicultor} | 
              <i class="material-symbols-rounded fs-6">location_on</i> ${infoOrigem.fazenda}
            </small>
          </td>
        `;
        tbody.appendChild(headerRow);
      }
      
      idsAnalises.forEach(idAnalise => {
        const analise = analisesDisponiveis.find(a => a.id === idAnalise);
        if (analise) {
          const infoAnalise = SistemaValidacaoLaudos.obterInfoAnaliseParaSelect(analise);
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <select class="form-control form-control-sm analise-select" required>
                <option value="${analise.id}">${analise.id} - ${infoAnalise.tipo} (${infoAnalise.apicultor})</option>
              </select>
            </td>
            <td class="text-sm">${infoAnalise.tipo}</td>
            <td class="text-sm">${infoAnalise.apicultor}</td>
            <td class="text-sm">${formatarData(infoAnalise.data)}</td>
            <td>
              <button class="btn btn-sm bg-gradient-danger mb-0" onclick="this.closest('tr').remove()">
                <i class="material-symbols-rounded fs-6">delete</i>
              </button>
            </td>
          `;
          tbody.appendChild(tr);
        }
      });
      
      showSuccess('Análises compatíveis adicionadas automaticamente!', 'Laudo Sugerido');
    }, 500);
  }

  // ========== EVENT LISTENERS ==========

  saveReportBtn.addEventListener('click', async () => {
    if (!checkAuth()) return;
    
    if (!reportForm.checkValidity()) {
      reportForm.reportValidity();
      return;
    }

    let analisesSelecionadas = [];
    const analisesIds = [];
    
    document.querySelectorAll('.analise-select').forEach(select => {
      if (select.value) {
        analisesIds.push(select.value);
        const analiseCompleta = analisesDisponiveis.find(a => a.id === select.value);
        if (analiseCompleta) {
          analisesSelecionadas.push(analiseCompleta);
        }
      }
    });

    if (analisesSelecionadas.length === 0) {
      showWarning('Selecione pelo menos uma análise.', 'Análise Obrigatória');
      return;
    }

    const validacao = SistemaValidacaoLaudos.validarCompatibilidade(analisesSelecionadas);
    
    if (!validacao.valido) {
      showError(validacao.erros.join('\n'), 'Incompatibilidade Detectada');
      return;
    }
    
    if (validacao.warnings && validacao.warnings.length > 0) {
      showWarning(validacao.warnings.join('\n'), 'Atenção à Compatibilidade');
    }

    const laudoData = getDadosFormularioLaudo();
    laudoData['idProdutor'] = analisesSelecionadas[0].idProdutor;

    try {
      let laudoId;
      
      if (window.editIndex) {
        //console.log(laudoData.analises[0].idProdutor);
        await salvarLaudo({...laudoData, idUsuario: usuarioLogado.id}, window.editIndex);
        const response = await buscarLaudoPorId(window.editIndex);
        const analisesExistentes = response.analises;
        laudoId = window.editIndex;

        if (analisesExistentes.length > laudoData.analises.length) {
          const diff = diferenca(analisesExistentes, interseccao(analisesExistentes, laudoData.analises));
          for (const idAnalise of diff) {
            await desvincularAnaliseLaudoAPI(laudoId, idAnalise);
          }
        } else if (analisesExistentes.length < laudoData.analises.length) {
          for (const idAnalise of laudoData.analises) {
            await vincularAnaliseLaudoAPI(laudoId, idAnalise);
          }
        }
        
        showSuccess('Laudo atualizado com sucesso!', 'Atualização Concluída');
        window.editIndex = null;
      } else {
        console.log(laudoData);
        const response = await salvarLaudo({...laudoData, idUsuario: usuarioLogado.id});
        laudoId = response.laudo.id;

        for (const idAnalise of laudoData.analises) {
          await vincularAnaliseLaudoAPI(laudoId, idAnalise);
        }
        
        showSuccess('Laudo criado com sucesso!', 'Laudo Salvo');
      }

      await carregarLaudos();
      reportForm.reset();
      modal.hide();
    } catch (error) {
      console.error('Erro ao salvar laudo:', error);
    }
  });

  if (addAnaliseBtn) {
    addAnaliseBtn.addEventListener('click', function(e) {
      e.preventDefault();
      adicionarLinhaAnalise();
    });
  }

  document.addEventListener('change', function(e) {
    if (e.target.classList.contains('analise-select')) {
      const selectedAnalise = analisesDisponiveis.find(a => a.id === e.target.value);
      if (selectedAnalise) {
        const infoAnalise = SistemaValidacaoLaudos.obterInfoAnaliseParaSelect(selectedAnalise);
        const tr = e.target.closest('tr');
        tr.querySelector('td:nth-child(2)').textContent = infoAnalise.tipo;
        tr.querySelector('td:nth-child(3)').textContent = infoAnalise.apicultor;
        tr.querySelector('td:nth-child(4)').textContent = infoAnalise.fazenda;
        tr.querySelector('td:nth-child(5)').textContent = formatarData(infoAnalise.data);
      }
    }
  });

  // ========== FUNÇÕES GLOBAIS ==========

  async function editarLaudo(id) {
    if (!checkAuth()) return;
    
    try {
      const laudo = await buscarLaudoPorId(id);
      if (laudo) {
        window.editIndex = id;
        preencherFormulario(laudo, false);
        modal.show();
        showInfo('Laudo carregado para edição', 'Modo Edição');
      }
    } catch (error) {
      console.error('Erro ao editar laudo:', error);
    }
  }

  async function visualizarLaudo(id) {
    if (!checkAuth()) return;
    
    try {
      const laudo = await buscarLaudoPorId(id);
      if (laudo) {
        preencherFormulario(laudo, true);
        modal.show();
        showInfo('Visualizando dados do laudo', 'Modo Visualização');
      }
    } catch (error) {
      console.error('Erro ao visualizar laudo:', error);
    }
  }

  function obterInfoOrigem(analises) {
    if (!analises || analises.length === 0) return { apicultor: 'N/A', fazenda: 'N/A' };
    
    const primeira = analises[0];
    if (!primeira.origem) return { apicultor: 'N/A', fazenda: 'N/A' };
    
    const origens = primeira.origem.split(" - ");
    const nomeApicultor = origens[0]?.trim() || 'N/A';
    const nomeFazenda = origens[2] ? origens[2].trim() : 'N/A';
    const localizacao = origens[3] ? origens[3].trim() : 'N/A';

    return {
        apicultor: nomeApicultor,
        fazenda: nomeFazenda,
        localizacao
    };
}

async function imprimirLaudo(id) {
    if (!checkAuth()) return;
    
    showLoading('Gerando PDF do laudo...', true);
    
    try {
        const laudo = await buscarLaudoPorId(id);
        
        if (!laudo) {
            throw new Error('Laudo não encontrado');
        }

        // Gerar conteúdo HTML para o PDF
        const conteudoPDF = gerarConteudoPDF(laudo);
        
        // Configurações do PDF
        const opcoes = {
            margin: [10, 10, 10, 10],
            filename: `laudo_${laudo.id}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                logging: false
            },
            jsPDF: { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'portrait' 
            }
        };

        // Gerar e baixar PDF
        await html2pdf().set(opcoes).from(conteudoPDF).save();
        
        hideLoading();
        showSuccess('PDF gerado com sucesso!', 'Download Iniciado');
        
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        hideLoading();
        showError('Erro ao gerar o PDF do laudo', 'Erro de Impressão');
    }
}

function gerarConteudoPDF(laudo) {
    const primeiraAnalise = laudo.analises && laudo.analises[0] ? laudo.analises[0] : {};
    const infoOrigem = obterInfoOrigem(laudo.analises || []);
    const dataEmissao = formatarData(laudo.dataEmissao || laudo.data);
    const dataExtenso = obterDataPorExtenso(laudo.dataEmissao || laudo.data);

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: 'Arial', sans-serif;
                    line-height: 1.4;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    background-color: #fffaf0;
                }
                .pdf-container {
                    max-width: 210mm;
                    margin: 0 auto;
                    padding: 15mm;
                    background: white;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                }
                .header {
                    text-align: center;
                    border-bottom: 3px solid #B4690F;
                    padding-bottom: 15px;
                    margin-bottom: 25px;
                    background: linear-gradient(135deg, #fffaf0 0%, #ffeccc 100%);
                    border-radius: 8px;
                    padding: 20px;
                }
                .logo {
                    font-size: 28px;
                    font-weight: bold;
                    color: #632D03;
                    margin-bottom: 5px;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
                }
                .titulo {
                    font-size: 20px;
                    font-weight: bold;
                    margin: 10px 0;
                    color: #944D04;
                }
                .subtitulo {
                    font-size: 14px;
                    color: #B4690F;
                    font-style: italic;
                }
                .section {
                    margin: 20px 0;
                    page-break-inside: avoid;
                    background: white;
                    border-radius: 6px;
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                .section-title {
                    background: linear-gradient(135deg, #B4690F 0%, #944D04 100%);
                    color: white;
                    padding: 12px 15px;
                    font-weight: bold;
                    margin-bottom: 0;
                    font-size: 14px;
                }
                .section-content {
                    padding: 15px;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin: 10px 0;
                }
                .info-item {
                    margin-bottom: 10px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #f0e6d6;
                }
                .info-label {
                    font-weight: bold;
                    color: #632D03;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .info-value {
                    color: #333;
                    font-size: 13px;
                    margin-top: 4px;
                }
                .table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 10px 0;
                    font-size: 11px;
                    border-radius: 6px;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .table th {
                    background: linear-gradient(135deg, #944D04 0%, #632D03 100%);
                    color: white;
                    border: 1px solid #532502;
                    padding: 10px 8px;
                    text-align: left;
                    font-weight: bold;
                    font-size: 10px;
                }
                .table td {
                    border: 1px solid #e8d9c3;
                    padding: 8px;
                    background: #fffaf0;
                }
                .table tr:nth-child(even) td {
                    background: #fef6e6;
                }
                .badge {
                    display: inline-block;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 10px;
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .badge-success {
                    background: linear-gradient(135deg, #2dce89 0%, #1a9f6e 100%);
                    color: white;
                }
                .badge-warning {
                    background: linear-gradient(135deg, #fb6340 0%, #d4492a 100%);
                    color: white;
                }
                .badge-secondary {
                    background: linear-gradient(135deg, #B4690F 0%, #944D04 100%);
                    color: white;
                }
                .badge-info {
                    background: linear-gradient(135deg, #11cdef 0%, #0a9cbd 100%);
                    color: white;
                }
                .conclusao-box {
                    border: 2px solid #B4690F;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 15px 0;
                    background: linear-gradient(135deg, #fffaf0 0%, #fef6e6 100%);
                    box-shadow: 0 2px 8px rgba(180, 105, 15, 0.1);
                }
                .assinatura {
                    margin-top: 60px;
                    border-top: 2px solid #B4690F;
                    padding-top: 20px;
                    text-align: center;
                    background: #fffaf0;
                    padding: 30px;
                    border-radius: 8px;
                }
                .assinatura-line {
                    width: 300px;
                    height: 1px;
                    background: #B4690F;
                    margin: 40px auto 10px;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 15px;
                    border-top: 2px dashed #B4690F;
                    font-size: 10px;
                    color: #944D04;
                    text-align: center;
                    background: #fffaf0;
                    padding: 15px;
                    border-radius: 6px;
                }
                .page-break {
                    page-break-before: always;
                }
                .honey-divider {
                    height: 4px;
                    background: linear-gradient(90deg, #632D03, #B4690F, #632D03);
                    margin: 20px 0;
                    border-radius: 2px;
                }
                .valor-destaque {
                    font-weight: bold;
                    color: #632D03;
                    font-size: 12px;
                }
                .referencia {
                    font-size: 9px;
                    color: #944D04;
                    font-style: italic;
                }
                @media print {
                    body { 
                        margin: 0; 
                        background: white;
                    }
                    .pdf-container { 
                        padding: 10mm; 
                        box-shadow: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="pdf-container">
                <!-- Cabeçalho -->
                <div class="header">
                    <div class="logo">${usuarioLogado.isADM ? "AQMel System" : usuarioLogado.instituicaoEscolhida.nome}</div>
                    <div class="titulo">LAUDO TÉCNICO DE ANÁLISE DE MEL</div>
                    <div class="subtitulo">Certificação de Qualidade e Pureza</div>
                </div>

                <div class="honey-divider"></div>

                <!-- Informações do Laudo -->
                <div class="section">
                    <div class="section-title">INFORMAÇÕES DO LAUDO</div>
                    <div class="section-content">
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Número do Laudo:</span>
                                <div class="info-value">${laudo.id}</div>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Data de Emissão:</span>
                                <div class="info-value">${dataEmissao}</div>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Status:</span>
                                <div class="info-value">
                                    <span class="badge ${
                                        laudo.status === 'Emitido' ? 'badge-success' : 
                                        laudo.status === 'Validado' ? 'badge-info' :
                                        laudo.status === 'Pendente' ? 'badge-warning' : 'badge-secondary'
                                    }">${laudo.status}</span>
                                </div>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Responsável Técnico:</span>
                                <div class="info-value">${laudo.responsavel || 'Não informado'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Informações do Produtor -->
                <div class="section">
                    <div class="section-title">INFORMAÇÕES DO PRODUTOR</div>
                    <div class="section-content">
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Apicultor:</span>
                                <div class="info-value">${infoOrigem.apicultor}</div>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Fazenda/Origem:</span>
                                <div class="info-value">${infoOrigem.fazenda}</div>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Espécie Apícola:</span>
                                <div class="info-value">${primeiraAnalise.especie || 'Apis mellifera'}</div>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Safra/Colheita:</span>
                                <div class="info-value">${primeiraAnalise.safra || 'Não informada'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Análises Vinculadas -->
                <div class="section">
                    <div class="section-title">ANÁLISES VINCULADAS</div>
                    <div class="section-content">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Tipo de Análise</th>
                                    <th>Data</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${laudo.analises && laudo.analises.length > 0 ? 
                                    laudo.analises.map(analise => `
                                        <tr>
                                            <td><strong>${analise.id}</strong></td>
                                            <td>${analise.tipo || 'N/A'}</td>
                                            <td>${formatarData(analise.dataAnalisada || analise.data)}</td>
                                            <td>
                                                <span class="badge ${
                                                    analise.status === 'Concluída' ? 'badge-success' : 'badge-warning'
                                                }">
                                                    ${analise.status || 'Pendente'}
                                                </span>
                                            </td>
                                        </tr>
                                    `).join('') : 
                                    `<tr><td colspan="4" style="text-align: center; color: #944D04;">Nenhuma análise vinculada</td></tr>`
                                }
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Resultados das Análises -->
                ${laudo.analises && laudo.analises.length > 0 ? `
                <div class="section">
                    <div class="section-title">RESULTADOS DAS ANÁLISES</div>
                    <div class="section-content">
                        ${gerarTabelaResultadosPDF(laudo.analises)}
                    </div>
                </div>
                ` : ''}

                <!-- Conclusão -->
                <div class="section">
                    <div class="section-title">CONCLUSÃO TÉCNICA</div>
                    <div class="section-content">
                        <div class="conclusao-box">
                            <div style="margin-bottom: 15px; text-align: center;">
                                <strong style="color: #632D03; font-size: 14px;">RESULTADO FINAL:</strong>
                                <br>
                                <span class="badge ${
                                    laudo.conclusao === 'Aprovado' ? 'badge-success' : 
                                    laudo.conclusao === 'Reprovado' ? 'badge-warning' : 'badge-secondary'
                                }" style="margin: 10px 0; font-size: 12px; padding: 8px 20px;">
                                    ${laudo.conclusao || 'Pendente'}
                                </span>
                            </div>
                            <div style="border-top: 1px dashed #B4690F; padding-top: 15px;">
                                <strong style="color: #632D03;">Observações Técnicas:</strong><br>
                                <div style="margin-top: 8px; color: #333; line-height: 1.5;">
                                    ${laudo.observacoes || 'O produto atende aos parâmetros de qualidade estabelecidos pela legislação vigente.'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="honey-divider"></div>

                <!-- Assinatura -->
                <div class="assinatura">
                    <div style="margin-bottom: 20px; color: #632D03;">
                        <em>"Certificamos a veracidade das informações contidas neste laudo"</em>
                    </div>
                    
                    <div class="assinatura-line"></div>
                    
                    <div style="margin-top: 10px;">
                        <strong style="color: #632D03;">${laudo.responsavel || 'Responsável Técnico'}</strong><br>
                        <span style="color: #944D04; font-size: 11px;">AQMel LAB - Laboratório de Análise de Mel</span><br>
                        <span style="color: #B4690F; font-size: 10px;">CREA/CRQ: ___________________</span>
                    </div>
                    
                    <div style="margin-top: 25px; color: #632D03;">
                        Data: ${dataExtenso}
                    </div>
                </div>

                <!-- Rodapé -->
                <div class="footer">
                    <p><strong>Laudo gerado automaticamente pelo Sistema AQMel APP</strong></p>
                    <p>Laboratório certificado - Sistema de Gestão da Qualidade</p>
                    <p>Documento válido sem assinatura digital - Nº ${laudo.id}</p>
                    <p style="margin-top: 8px; color: #B4690F;">
                        <em>Comprometidos com a qualidade e pureza do mel brasileiro</em> 
                    </p>
                </div>
            </div>
        </body>
        </html>
    `;
}

function gerarTabelaResultadosPDF(analises) {
    const parametrosUnicos = extrairParametrosUnicos(analises);
    
    let html = `
        <table class="table">
            <thead>
                <tr>
                    <th style="width: 25%;">Parâmetro Analisado</th>
                    ${analises.map(analise => `
                        <th style="text-align: center;">
                            ${analise.id}<br>
                            <small style="color: #fef6e6;">${analise.tipo || ''}</small>
                        </th>
                    `).join('')}
                </tr>
            </thead>
            <tbody>
    `;
    
    parametrosUnicos.forEach(parametro => {
        html += `
            <tr>
                <td>
                    <strong>${parametro.nome}</strong><br>
                    <small class="referencia">${parametro.unidade}</small>
                </td>
        `;
        
        analises.forEach(analise => {
            const valorParametro = findParametroByIndex(analise, parametro);
            const valor = valorParametro.valor;
            
            html += `
                <td style="text-align: center;">
                    <span class="valor-destaque">${valor || '-'}</span>
                    ${valorParametro.referencia ? `
                        <br><small class="referencia">Ref: ${valorParametro.referencia}</small>
                    ` : ''}
                </td>
            `;
        });
        
        html += `</tr>`;
    });
    
    html += `</tbody></table>`;
    return html;
}

  function extrairParametrosUnicos(analises) {
    const parametros = [];
    
    analises.forEach(analise => {
      if (analise.parametros && typeof analise.parametros === 'object') {
        for (const parametro of analise.parametros) {
          if (!listContainsParametro(parametros, parametro)) parametros.push(parametro);
        }
      }
    });
    
    return Array.from(parametros).sort();
  }

  function listContainsParametro(lista, parametro) {
    for (const elemento of lista) {
      if (elemento.id == parametro.id) return true;
    }
    return false;
  }

  function findParametroByIndex(analise, parametro) {
    const parametros = analise.parametros;

    for (const parametroLista of parametros) {
      if (parametroLista.id == parametro.id) return parametroLista;
    }

    return { valor: '-', unidade: '', referencia: '' };
  }

function obterDataPorExtenso(dataString) {
    if (!dataString) return 'N/A';
    
    try {
        const date = new Date(dataString);
        const options = { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric',
            timeZone: 'America/Sao_Paulo'
        };
        return date.toLocaleDateString('pt-BR', options);
    } catch (error) {
        return dataString;
    }
}

  async function removerLaudo(id) {
    if (!checkAuth()) return;
    
    if (confirm("Tem certeza que deseja remover este laudo?")) {
      try {
        await excluirLaudoAPI(id);
        await carregarLaudos();
        showSuccess('Laudo removido com sucesso!', 'Exclusão Concluída');
      } catch (error) {
        console.error('Erro ao remover laudo:', error);
      }
    }
  }

  function abrirModalNovoLaudo() {
    if (!checkAuth()) return;
    
    window.editIndex = null;
    reportForm.reset();
    
    document.getElementById('dataEmissao').value = getDataAtual();
    
    if (usuarioLogado) {
      document.getElementById('responsavelLaudo').value = usuarioLogado.nome;
    }
    
    const tbody = document.querySelector('#newReportModal tbody');
    tbody.innerHTML = '';
    adicionarLinhaAnalise();
    
    const elementosModal = Array.from(reportForm.elements);
    elementosModal.forEach(el => el.disabled = false);
    document.getElementById('idLaudo').disabled = true;
    document.getElementById('dataEmissao').disabled = true;
    document.getElementById('responsavelLaudo').disabled = true;
    
    saveReportBtn.style.display = 'inline-block';
    modal.show();
    showInfo('Preencha os dados do novo laudo', 'Novo Laudo');
  }

  function ocultarItensMenuPorPerfil(tipoUsuario) {
    const itensMenu = {
        'dashboard': document.querySelector('a[href*="dashboard.html"]').parentElement,
        'amostras': document.querySelector('a[href*="amostras.html"]').parentElement,
        'analises': document.querySelector('a[href*="analises.html"]').parentElement,
        'laudos': document.querySelector('a[href*="laudos.html"]').parentElement,
        'usuarios': document.querySelector('a[href*="usuarios.html"]').parentElement,
        'fazendas': document.querySelector('a[href*="fazendas.html"]').parentElement,
        'instituicoes': document.querySelector('a[href*="instituicoes.html"]').parentElement,
        'parametros': document.querySelector('a[href*="parametros.html"]').parentElement,
        'laudosRevisao': document.querySelector('a[href*="laudosRevisao.html"]').parentElement
    };

    // Resetar todos os itens primeiro (caso de logout/login)
    Object.values(itensMenu).forEach(item => {
        if (item) item.style.display = 'list-item';
    });

    // Aplicar regras por tipo de usuário
    switch(tipoUsuario) {
        case 'Apicultor':
            // Apicultor só vê: Dashboard, Fazendas, Laudos
            if (itensMenu.amostras) itensMenu.amostras.style.display = 'none';
            if (itensMenu.analises) itensMenu.analises.style.display = 'none';
            if (itensMenu.usuarios) itensMenu.usuarios.style.display = 'none';
            if (itensMenu.instituicoes) itensMenu.instituicoes.style.display = 'none';
            if (itensMenu.parametros) itensMenu.parametros.style.display = 'none';
            if (itensMenu.laudosRevisao) itensMenu.laudosRevisao.style.display = 'none';
            break;

        case 'Pesquisador':
            // Pesquisador vê: Dashboard, Amostras, Análises, Laudos
            if (itensMenu.usuarios) itensMenu.usuarios.style.display = 'none';
            if (itensMenu.fazendas) itensMenu.fazendas.style.display = 'none';
            if (itensMenu.instituicoes) itensMenu.instituicoes.style.display = 'none';
            if (itensMenu.parametros) itensMenu.parametros.style.display = 'none';
            if (itensMenu.laudosRevisao) itensMenu.laudosRevisao.style.display = 'none';
            break;

        case 'Coordenador':
            // Coordenador vê tudo exceto Instituições
            if (itensMenu.instituicoes) itensMenu.instituicoes.style.display = 'none';
            break;

        case 'Administrador':
            // Administrador vê tudo - não oculta nada
            break;

        default:
            console.warn('Tipo de usuário não reconhecido:', tipoUsuario);
    }

    // Também ocultar a seção "Administração" se todos os itens abaixo estiverem ocultos
    ocultarSecaoAdministracaoSeNecessario(tipoUsuario);
}

function ocultarSecaoAdministracaoSeNecessario(tipoUsuario) {
    // Encontrar a seção Administração pela estrutura do menu
    const secaoAdministracao = document.querySelector('.nav-item.mt-3 h6')?.closest('.nav-item');
    
    if (!secaoAdministracao) return;

    // Encontrar os itens da seção Administração
    const itensAdministracao = [];
    let nextElement = secaoAdministracao.nextElementSibling;
    
    // Coletar todos os itens até a próxima seção ou fim do menu
    while (nextElement && !nextElement.querySelector('h6')) {
        itensAdministracao.push(nextElement);
        nextElement = nextElement.nextElementSibling;
    }

    // Verificar se todos os itens estão ocultos
    const todosOcultos = itensAdministracao.length > 0 && itensAdministracao.every(item => 
        item.style.display === 'none' || window.getComputedStyle(item).display === 'none'
    );

    if (todosOcultos || tipoUsuario === 'Apicultor') {
        secaoAdministracao.style.display = 'none';
    } else {
        secaoAdministracao.style.display = 'list-item';
    }
}

/**
 * Adaptar os links de Fazendas e Laudos para Apicultores
 */
function adaptarLinksParaApicultor(tipoUsuario, usuarioId) {
    if (tipoUsuario !== 'Apicultor') return;

    // Adaptar link de Fazendas para mostrar apenas as do apicultor
    const linkFazendas = document.querySelector('a[href*="fazendas.html"]');
    if (linkFazendas) {
        linkFazendas.href = `../pages/fazendas.html?apicultor=${usuarioId}`;
    }

    // Adaptar link de Laudos para mostrar apenas os relacionados às suas amostras
    const linkLaudos = document.querySelector('a[href*="laudos.html"]');
    if (linkLaudos) {
        linkLaudos.href = `../pages/laudos.html?apicultor=${usuarioId}`;
    }
}

function ocultarFuncoesLaboratorio() {
  document.getElementById('addLaudo').style.display = 'none';
  if (document.getElementById('sugerir-laudos')) document.getElementById('sugerir-laudos').style.display = 'none';
  document.getElementById('titulo').innerHTML = 'Seus Laudos';
  document.getElementById('subtitulo').innerHTML = 'Visualização dos laudos das análises das suas amostras de mel';
    
  const cardsHeader = document.querySelectorAll('.row .col-xl-3 .card .card-header');
  for (const card of cardsHeader) card.style.display = 'none';

  const cardsFooter = document.querySelectorAll('.card-footer');
  for (const card of cardsFooter) card.style.display = 'none';
}

  // ========== INICIALIZAÇÃO ==========

  async function inicializar() {
    if (checkAuth()) {
      usuarioLogado = await getUser();
      
      if (!usuarioLogado) {
        showError('Não foi possível carregar dados do usuário', 'Erro de Autenticação');
        return;
      }

      if (usuarioLogado && usuarioLogado.instituicaoEscolhida.tipoUsuario) {
        ocultarItensMenuPorPerfil(usuarioLogado.instituicaoEscolhida.tipoUsuario);
        adaptarLinksParaApicultor(usuarioLogado.instituicaoEscolhida.tipoUsuario, usuarioLogado.id);
      }

      if (!usuarioLogado.isADM && usuarioLogado.instituicaoEscolhida.tipoUsuario === "Apicultor") ocultarFuncoesLaboratorio();

      showInfo('Sistema de laudos carregado', 'Bem-vindo');
      
      try {
        showLoading('Carregando dados do sistema...', true);
        
        configurarFiltros();
        
        if (usuarioLogado.isADM || usuarioLogado.instituicaoEscolhida.tipoUsuario != "Apicultor") await carregarCardsLaudos();

        await carregarPesquisadoresFilter();
        
        const resultados = await Promise.allSettled([
          carregarLaudos(),
          carregarAnalisesDisponiveis()
        ]);
        
        const erros = resultados.filter(r => r.status === 'rejected');
        if (erros.length > 0) {
          showWarning('Alguns dados podem estar incompletos', 'Atenção');
        }
        
      } catch (error) {
        console.error('Erro ao inicializar:', error);
        showError('Erro ao carregar o sistema de laudos', 'Erro de Inicialização');
      } finally {
        hideLoading();
      }
      
      if (addLaudoBtn) {
        addLaudoBtn.addEventListener('click', abrirModalNovoLaudo);
      }

      modal._element.addEventListener('show.bs.modal', function() {
        const tbody = document.querySelector('#newReportModal tbody');
        if (tbody.children.length === 0) {
          adicionarLinhaAnalise();
        }
      });
    }
  }

  // Variáveis globais para os event handlers do HTML
  window.editIndex = null;
  window.editarLaudo = editarLaudo;
  window.visualizarLaudo = visualizarLaudo;
  window.imprimirLaudo = imprimirLaudo;
  window.removerLaudo = removerLaudo;
  window.sugerirLaudosAutomaticos = sugerirLaudosAutomaticos;
  window.limparFiltros = limparFiltros;
  window.criarLaudoComAnalises = criarLaudoComAnalises;
  window.mudarPagina = mudarPagina;

  inicializar();
});