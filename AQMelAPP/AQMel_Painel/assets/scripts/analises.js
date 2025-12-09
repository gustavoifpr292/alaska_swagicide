import API_BASE_URL from '../../../chave_api.js'

document.addEventListener('DOMContentLoaded', () => {
  //const API_BASE_URL = 'http://localhost:3000';
  let analises = [];
  let amostras = [];
  // parametrosDisponiveis NÃO será usado para montar o modal de análise (não puxamos todos os parâmetros)
  let usuarioLogado = null;
  let editIndex = null;
  let paginacaoAtual = null;

  // Mapa com os parâmetros atualmente exibidos no modal (id -> { id, nome, unidade, tipo })
  let currentDisplayedParametros = {};

  // Variáveis de estado para filtros e paginação
  let currentPage = 1;
  let currentLimit = 10;
  let currentFilters = {
    search: '',
    status: '',
    tipo: '',
    dataInicio: '',
    dataFim: '',
    pesquisador: ''
  };

  let loadingCount = 0;
  let currentLoadingMessage = '';

  // Elementos DOM
  const analysisForm = document.getElementById('analysisForm');
  const saveAnalysisBtn = document.getElementById('saveAnalysisBtn');
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('newAnalysisModal'));
  const tbody = document.querySelector('tbody');
  const addAnaliseBtn = document.getElementById('addAnalise');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.querySelector('.loading-text');
  const progressFill = document.querySelector('.progress-fill');

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

  // === SISTEMA DE LOADING ===

  function showLoading(message = 'Processando...', isLongOperation = false) {
    if (!loadingOverlay || !loadingText) {
      // fallback se elementos não existir
      return;
    }

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

    if (loadingCount === 0 && loadingOverlay) {
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
      }, 1200);
      return false;
    }
    return true;
  }

  function getAuthHeaders(colecao = null, authorized = false) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    };

    if (colecao) {
      headers['ObjectCollection'] = colecao;
    }

    if (authorized) {
      headers['Authorized'] = true;
    }

    return headers;
  }

  function handleAuthError() {
    hideLoading();
    localStorage.removeItem('token');
    showError('Sua sessão expirou. Redirecionando para login...', 'Sessão Expirada');
    setTimeout(() => {
      window.location.href = '../pages/login.html';
    }, 1200);
  }

  function handleUnauthorizedAction() {
    hideLoading();
    showError('Essa ação não pode ser feita.', 'Ação Proibida');
  }

  // === SISTEMA DE FILTROS ===
  function configurarFiltros() {
    const searchFilter = document.getElementById('search-filter');
    if (searchFilter) {
      searchFilter.addEventListener('input', debounce((e) => {
        currentFilters.search = e.target.value;
        currentPage = 1;
        carregarAnalises(currentPage, currentFilters);
      }, 500));
    }

    const tipoFilter = document.getElementById('filter-type');
    if (tipoFilter) {
      tipoFilter.addEventListener('change', (e) => {
        currentFilters.tipo = e.target.value;
        currentPage = 1;
        carregarAnalises(currentPage, currentFilters);
      });
    }

    const statusFilter = document.getElementById('filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        currentFilters.status = e.target.value;
        currentPage = 1;
        carregarAnalises(currentPage, currentFilters);
      });
    }

    const dataInicioFilter = document.getElementById('filter-data-inicio');
    if (dataInicioFilter) {
      dataInicioFilter.addEventListener('change', (e) => {
        currentFilters.dataInicio = e.target.value;
        currentPage = 1;
        carregarAnalises(currentPage, currentFilters);
      });
    }

    const dataFimFilter = document.getElementById('filter-data-fim');
    if (dataFimFilter) {
      dataFimFilter.addEventListener('change', (e) => {
        currentFilters.dataFim = e.target.value;
        currentPage = 1;
        carregarAnalises(currentPage, currentFilters);
      });
    }

    const pesquisadoresFilter = document.getElementById('filter-pesquisadores');
    if (pesquisadoresFilter) {
      pesquisadoresFilter.addEventListener('change', (e) => {
        currentFilters.pesquisador = e.target.value;
        currentPage = 1;
        carregarAnalises(currentPage, currentFilters);
      });
    }

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
    document.getElementById('search-filter').value = '';
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-data-inicio').value = '';
    document.getElementById('filter-data-fim').value = '';
    document.getElementById('filter-pesquisadores').value = '';

    currentFilters = {
      search: '',
      status: '',
      tipo: '',
      dataInicio: '',
      dataFim: '',
      pesquisador: ''
    };
    currentPage = 1;

    carregarAnalises();
    showInfo('Filtros limpos', 'Filtros');
  }

  // === PAGINAÇÃO ===
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

    const quantElement = document.getElementById('quantAnalises');
    if (quantElement) {
      const start = ((page - 1) * currentLimit) + 1;
      const end = Math.min(page * currentLimit, total);
      quantElement.textContent = `${start}-${end} de ${total} análises`;
    }
  }

  function mudarPagina(novaPagina) {
    if (!paginacaoAtual) return;
  
    if (novaPagina < 1 || novaPagina > paginacaoAtual.pages) return;
  
    currentPage = novaPagina;
    carregarAnalises(currentPage, currentFilters);
  }

  // === DEBOUNCE ===
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

  // === ANÁLISES / API ===

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

  async function fetchAnalises(filters = {}, page = 1, limit = 10) {
    if (!checkAuth()) return { analises: [], paginacao: {} };

    showLoading('Carregando análises...');

    try {
      const queryParams = new URLSearchParams({
        page,
        limit,
        ...filters
      });

      const response = await fetch(`${API_BASE_URL}/analises/?${queryParams}`, {
        headers: getAuthHeaders('analises')
      });

      if (response.status === 401) {
        handleAuthError();
        return { analises: [], paginacao: {} };
      }

      if (!response.ok) {
        throw new Error('Erro ao buscar análises');
      }

      updateLoadingText('Processando análises...');
      const dados = await response.json();
      return dados;

    } catch (error) {
      console.error('Erro:', error);
      showError('Não foi possível carregar as análises', 'Erro de Conexão');
      return { analises: [], paginacao: {} };
    } finally {
      hideLoading();
    }
  }

  // === NOVA: render de parâmetros a partir da amostra (Accordion - Opção B) ===
  function carregarParametrosDaAmostra(amostra) {
    const container = document.getElementById("parametrosContainer");
    container.innerHTML = "";
    currentDisplayedParametros = {}; // reset

    if (!amostra || !amostra.parametrosSolicitados || amostra.parametrosSolicitados.length === 0) {
      container.innerHTML = `
        <div class="text-muted">Nenhum parâmetro solicitado para esta amostra.</div>
      `;
      return;
    }

    // Agrupar por tipo/categoria (Físico-Químico, Microbiológico, Sensorial)
    const grupos = {};
    amostra.parametrosSolicitados.forEach(p => {
      const tipo = p.tipo || 'Geral';
      if (!grupos[tipo]) grupos[tipo] = [];
      grupos[tipo].push(p);
      // armazenar no mapa global para referência posterior (determinarTipo)
      currentDisplayedParametros[p.id] = p;
    });

    // Criar um accordion bootstrap-like simples
    const accordionId = `paramAccordion_${Date.now()}`;
    const accordion = document.createElement('div');
    accordion.className = 'accordion';
    accordion.id = accordionId;

    let idx = 0;
    const orderedTipos = ['Físico-Químico', 'Microbiológico', 'Sensorial']; // ordem preferencial
    // adicionar tipos que existem, na ordem preferencial, depois os restantes
    const tiposExistentes = Object.keys(grupos);
    const tiposOrdenados = orderedTipos.filter(t => tiposExistentes.includes(t)).concat(tiposExistentes.filter(t => !orderedTipos.includes(t)));

    tiposOrdenados.forEach(tipo => {
      idx++;
      const parametros = grupos[tipo];
      const item = document.createElement('div');
      item.className = 'accordion-item mb-2';

      const headerId = `${accordionId}_h_${idx}`;
      const collapseId = `${accordionId}_c_${idx}`;

      item.innerHTML = `
        <h2 class="accordion-header" id="${headerId}">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
            ${tipo} (${parametros.length})
          </button>
        </h2>
        <div id="${collapseId}" class="accordion-collapse collapse">
          <div class="accordion-body">
            <div class="row" id="${collapseId}_row"></div>
          </div>
        </div>
      `;

      accordion.appendChild(item);

      // preencher o row com inputs
      const row = item.querySelector(`#${collapseId}_row`);
      parametros.forEach(param => {
        //console.log(param);
        const col = document.createElement('div');
        col.className = 'col-md-6';
        col.innerHTML = `
          <div class="input-group input-group-outline mb-3 is-filled">
            <label class="form-label">${param.nome || param.id} ${param.unidade ? `(${param.unidade})` : ''}</label>
            <input type="${param.tipo === 'Físico-Químico' || param.tipo === "Microbiológico" ? 'number' : 'text'}"
                   class="form-control parametro-input"
                   data-parametro-id="${param.id.split("_")[1]}"
                   step="${param.tipo === 'number' ? '0.01' : ''}" data-parametro-tipo="${param.tipo}">
          </div>
        `;
        row.appendChild(col);
      });
    });

    container.appendChild(accordion);

    // abrir automaticamente o primeiro collapse
    const firstCollapse = container.querySelector('.accordion-collapse');
    if (firstCollapse) {
      // usar bootstrap collapse show
      firstCollapse.classList.add('show');
      const firstBtn = container.querySelector('.accordion-button');
      if (firstBtn) firstBtn.classList.remove('collapsed');
    }
  }

  async function salvarAnalise(analise, id = null) {
    if (!checkAuth()) return;

    showLoading(id ? 'Atualizando análise...' : 'Salvando análise...');

    try {
      const url = id ? `${API_BASE_URL}/analises/${id}` : `${API_BASE_URL}/analises/`;
      const method = id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: getAuthHeaders("analises"),
        body: JSON.stringify(analise)
      });

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (response.status === 402) {
        handleUnauthorizedAction();
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao salvar análise');
      }

      const resultado = await response.json();
      hideLoading();
      return resultado;

    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao salvar análise', 'Erro de Salvamento');
      throw error;
    }
  }

  async function excluirAnaliseAPI(id) {
    if (!checkAuth()) return;

    showLoading('Excluindo análise...');

    try {
      const response = await fetch(`${API_BASE_URL}/analises/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders('analises')
      });

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (response.status === 402) {
        handleUnauthorizedAction();
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao excluir análise');
      }

      const resultado = await response.json();
      hideLoading();
      return resultado;

    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao excluir análise', 'Erro de Exclusão');
      throw error;
    }
  }

  async function atribuirParametroAPI(idAnalise, idParametro, valor) {
    if (!checkAuth()) return;

    showLoading('Atribuindo parâmetros...');

    try {
      const response = await fetch(`${API_BASE_URL}/analises/${idAnalise}/${idParametro}`, {
        method: 'POST',
        headers: getAuthHeaders('analises'),
        body: JSON.stringify({ valor })
      });

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao atribuir parâmetro');
      }

      const resultado = await response.json();
      hideLoading();
      return resultado;

    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao atribuir parâmetro', 'Erro de Atribuição');
      throw error;
    }
  }

  // === CARREGAMENTO / RENDERIZAÇÃO ===

  async function carregarAnalises(page = 1, filters = currentFilters) {
    if (!checkAuth()) return;

    try {
      const resultado = await fetchAnalises(filters, page, currentLimit);
      analises = resultado.analises || [];
      renderizarAnalises();
      paginacaoAtual = resultado.paginacao; 
      atualizarPaginacao(resultado.paginacao);
      atualizarEstatisticas();

      if (analises.length > 0) {
        showSuccess(`${resultado.paginacao?.total || analises.length} análises encontradas`, 'Dados Carregados');
      } else {
        showWarning('Nenhuma análise encontrada com os filtros aplicados', 'Sem Dados');
      }
    } catch (error) {
      console.error('Erro ao carregar análises:', error);
    }
  }

  function renderizarAnalises() {
    if (!tbody) return;

    tbody.innerHTML = '';

    if (analises.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4">
            <i class="material-symbols-rounded text-muted mb-2" style="font-size: 3rem;">biotech</i>
            <p class="text-muted mb-0">Nenhuma análise encontrada</p>
          </td>
        </tr>
      `;
      return;
    }

    analises.forEach((analise) => {
      const permissaoEditarOuExcluir = (usuarioLogado && usuarioLogado.id === analise.idUsuario && analise.status === "Pendente") || (usuarioLogado && usuarioLogado.tipoUsuario === 'Administrador');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="d-flex px-2 py-1">
            <div class="d-flex flex-column justify-content-center">
              <h6 class="mb-0 text-sm">${analise.id}</h6>
            </div>
          </div>
        </td>
        <td>
          <p class="text-sm font-weight-bold mb-0">${analise.idAmostra || 'N/A'}</p>
          <p class="text-xs text-secondary mb-0">${analise.origem || 'Análise Local'}</p>
        </td>
        <td class="align-middle text-center text-sm">
          <span class="text-xs font-weight-bold">${analise.tipo || 'N/A'}</span>
        </td>
        <td class="align-middle text-center">
          <span class="text-secondary text-xs font-weight-bold">${analise.responsavel || 'N/A'}</span>
        </td>
        <td class="align-middle text-center">
          <span class="text-secondary text-xs font-weight-bold">${formatarData(analise.dataAnalisada || analise.data) || 'N/A'}</span>
        </td>
        <td class="align-middle text-center">
          <span class="badge badge-sm ${getStatusBadgeClass(analise.status)}">${analise.status || 'Pendente'}</span>
        </td>
        <td class="align-middle text-center">
          ${permissaoEditarOuExcluir ? `<a href="javascript:;" class="text-secondary font-weight-bold text-xs" onclick="editarAnalise('${analise.id}')" data-toggle="tooltip" title="Editar"> 
            <i class="material-symbols-rounded">edit</i> 
          </a>` : ''}
          <a href="javascript:;" class="text-secondary font-weight-bold text-xs ms-2" onclick="visualizarAnalise('${analise.id}')" data-toggle="tooltip" title="Visualizar">
            <i class="material-symbols-rounded">visibility</i>
          </a>
          ${permissaoEditarOuExcluir ? `<a href="javascript:;" class="text-danger font-weight-bold text-xs ms-2" onclick="removerAnalise('${analise.id}')" data-toggle="tooltip" title="Excluir">
            <i class="material-symbols-rounded">delete</i>
          </a>` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });

    const quantElement = document.getElementById('quantAnalises');
    if (quantElement) {
      quantElement.textContent = `${analises.length} análises`;
    }
  }

  // remover renderizarParametros antigo (não usado) - mantive para referência mas não será chamado

  async function carregarCardsAnalises() {
    if (!checkAuth()) return;

    showLoading('Carregando estatísticas...');

    try {
      const response = await fetch(`${API_BASE_URL}/analises/count`, {
        headers: getAuthHeaders("analises"),
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
      cards[0].textContent = totais.analisesHoje || '0';
      cards[1].textContent = totais.pendentes || '0';
      cards[2].textContent = totais.concluidas || '0';
    }
  }

  function atualizarEstatisticas() {
    // placeholder
  }

  // === AUXILIARES ===

  function getStatusBadgeClass(status) {
    switch ((status || '').toLowerCase()) {
      case 'concluída': return 'bg-gradient-success';
      case 'pendente': return 'bg-gradient-warning';
      case 'cancelada': return 'bg-gradient-danger';
      case 'em análise': return 'bg-gradient-info';
      default: return 'bg-gradient-secondary';
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

  // pegar dados preenchidos nos inputs de parâmetros (usando data-parametro-id)
  function getDadosParametros() {
    const inputs = document.querySelectorAll(".parametro-input");
    const dados = {};

    inputs.forEach(inp => {
      const id = inp.dataset.parametroId;
      const valor = (inp.value || '').toString().trim();
      const tipo = inp.dataset.parametroTipo;

      if (valor) {
        dados[id] = {valor, tipo};
      }
    });

    return dados;
  }

  // determinar tipo da análise com base nos parâmetros atualmente exibidos (currentDisplayedParametros)
  function determinarTipo(idAmostra, parametrosData) {
    const categoriasPreenchidas = new Set();

    //console.log(currentDisplayedParametros);
    Object.keys(parametrosData).forEach(paramId => {
      const param = currentDisplayedParametros[`${idAmostra}_${paramId}`];
      if (param && param.tipo) {
        categoriasPreenchidas.add(param.tipo);
      }
    });

    //console.log(categoriasPreenchidas);

    if ((categoriasPreenchidas.has('Físico-Químico') && categoriasPreenchidas.has('Microbiológico')) ||
      (categoriasPreenchidas.has('Físico-Químico') && categoriasPreenchidas.has('Sensorial'))) {
      return 'Combinada';
    } else if (categoriasPreenchidas.has('Físico-Químico')) {
      return 'Físico-Química';
    } else if (categoriasPreenchidas.has('Microbiológico')) {
      return 'Microbiológica';
    } else if (categoriasPreenchidas.has('Sensorial')) {
      return 'Sensorial';
    }
    return 'Geral';
  }

  async function buscarAnalisePorId(id) {
    if (!checkAuth()) return null;

    showLoading('Carregando análise...');

    try {
      const response = await fetch(`${API_BASE_URL}/analises/${id}`, {
        headers: getAuthHeaders('analises')
      });

      if (response.status === 401) {
        handleAuthError();
        return null;
      }

      if (!response.ok) {
        throw new Error('Erro ao buscar análise');
      }

      const analise = await response.json();
      hideLoading();
      return analise;

    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Erro ao carregar análise', 'Erro de Carregamento');
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

  async function carregarAmostrasNoSelect() {
    if (!checkAuth()) return;

    showLoading('Carregando amostras...');

    try {
      const response = await fetch(`${API_BASE_URL}/amostras/`, {
        headers: {
          ...getAuthHeaders('amostras'),
          noPages: 1
        }
      });

      if (response.ok) {
        amostras = (await response.json()).amostras;
        const select = document.getElementById('selectAmostra');

        select.innerHTML = '<option value="">Selecione uma amostra...</option>';

        amostras.forEach(amostra => {
          const option = document.createElement('option');
          option.value = amostra.id;
          option.textContent = `${amostra.id} - ${amostra.origem}`;
          select.appendChild(option);
        });
        hideLoading();
      } else {
        throw new Error('Erro ao carregar amostras');
      }
    } catch (error) {
      console.error('Erro ao carregar amostras:', error);
      hideLoading();
      showError('Erro ao carregar amostras', 'Erro de Carregamento');
    }
  }

  function preencherFormulario(analise, disabled = false) {
    const inputs = analysisForm.querySelectorAll('input, select');

    inputs[0].value = formatDateForInput(analise.dataAnalisada || analise.data);
    inputs[2].value = analise.idAmostra || '';

    if (analise.responsavel) {
      inputs[1].value = analise.responsavel || '';
    } else {
      inputs[1].value = usuarioLogado ? usuarioLogado.nome : '';
    }

    //console.log(analise);
    // Depois de carregar os parâmetros da amostra, preencher valores existentes
    if (analise.parametros && Array.isArray(analise.parametros)) {
      // analise.parametros é array de { id, valor }
      //console.log(analise.parametros);
      analise.parametros.forEach(parametro => {
        const input = document.querySelector(`.parametro-input[data-parametro-id="${parametro.id}"]`);
        if (input) {
          input.value = parametro.valor || '';
        }
      });
    }

    inputs.forEach((el, i) => {
      el.disabled = i === 1 || disabled;
    });

    // Desabilitar inputs de parâmetros se for visualização
    document.querySelectorAll('.parametro-input').forEach(input => {
      input.disabled = disabled;
    });

    saveAnalysisBtn.style.display = disabled ? 'none' : 'inline-block';
  }

  function limparParametros() {
    document.querySelectorAll('.parametro-input').forEach(input => {
      input.value = '';
    });
    currentDisplayedParametros = {};
  }

  function findAmostra(idAmostra) {
    for (const amostra of amostras) {
      if (amostra.id == idAmostra) return amostra;
    }
    return null;
  }

  // === EVENT LISTENERS ===

  // Salvar análise
  saveAnalysisBtn.addEventListener('click', async () => {
    if (!checkAuth()) return;

    if (!analysisForm.checkValidity()) {
      analysisForm.reportValidity();
      return;
    }

    const inputs = analysisForm.querySelectorAll('input, select');
    const parametrosData = getDadosParametros();
    //console.log(parametrosData);
    const parametros = Object.keys(parametrosData).map(id => ({
      id,
      valor: parametrosData[id].valor,
      tipo: parametrosData[id].tipo
    }));

    //console.log(parametros);

    const user = await getUser();

    if (!user) {
      showError('Não foi possível obter dados do usuário', 'Erro de Autenticação');
      return;
    }

    const amostra = findAmostra(inputs[2].value);
    if (!amostra) {
      showError('Amostra selecionada inválida', 'Erro');
      return;
    }

    //console.log(parametrosData);
    const novaAnalise = {
      dataAnalisada: inputs[0].value,
      idAmostra: inputs[2].value,
      idProdutor: amostra.idProdutor,
      idFazenda: amostra.idFazenda,
      idUsuario: user.id,
      responsavel: user.nome,
      idInstituicao: user.instituicaoEscolhida.id,
      tipo: determinarTipo(inputs[2].value, parametrosData),
      origem: amostra.origem,
      status: 'Pendente',
      parametros
    };

    // Atualizar status da amostra localmente (API)
    try {
      const response = await fetch(`${API_BASE_URL}/amostras/${amostra.id}`, {
        method: 'PUT',
        headers: getAuthHeaders('amostras', true),
        body: JSON.stringify({ status: "Analisado" })
      });

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (response.status === 402) {
        handleUnauthorizedAction();
        return;
      }

    } catch (err) {
      console.error("Erro ao atualizar status da amostra", err);
    }

    try {
      let analiseId;
      if (window.editIndex) {
        await salvarAnalise(novaAnalise, window.editIndex);
        analiseId = window.editIndex;
        window.editIndex = null;
        showSuccess('Análise atualizada com sucesso!', 'Atualização Concluída');
      } else {
        const response = await salvarAnalise(novaAnalise);
        analiseId = response.id;
        showSuccess('Análise criada com sucesso!', 'Análise Salva');
      }

      await carregarAnalises();
      analysisForm.reset();
      modal.hide();
      limparParametros();
    } catch (error) {
      console.error('Erro ao salvar análise:', error);
    }
  });

  // === FUNÇÕES GLOBAIS: edição / visualização / exclusão ===

  async function editarAnalise(id) {
    if (!checkAuth()) return;

    try {
      const analise = await buscarAnalisePorId(id);
      if (analise) {
        window.editIndex = id;

        // Carregar parâmetros da amostra associada (buscar localmente ou via API)
        let amostra = findAmostra(analise.idAmostra);
        if (!amostra) {
          try {
            const r = await fetch(`${API_BASE_URL}/amostras/${analise.idAmostra}`, { headers: getAuthHeaders('amostras') });
            if (r.ok) amostra = await r.json();
          } catch (err) {
            console.error('Erro ao buscar amostra para edição:', err);
          }
        }

        if (amostra) {
          carregarParametrosDaAmostra(amostra);
        } else {
          // se não conseguir buscar amostra, limpar parâmetros para evitar inconsistência
          limparParametros();
        }

        // preencher os valores após carregar parametros
        preencherFormulario(analise, false);
        modal.show();
        showInfo('Análise carregada para edição', 'Modo Edição');
      }
    } catch (error) {
      console.error('Erro ao editar análise:', error);
    }
  }

  async function visualizarAnalise(id) {
    if (!checkAuth()) return;

    limparParametros();
    try {
      const analise = await buscarAnalisePorId(id);

      if (analise) {
        // carregar parametros da amostra pra exibição
        let amostra = findAmostra(analise.idAmostra);
        if (!amostra) {
          try {
            const r = await fetch(`${API_BASE_URL}/amostras/${analise.idAmostra}`, { headers: getAuthHeaders('amostras') });
            if (r.ok) amostra = await r.json();
          } catch (err) {
            console.error('Erro ao buscar amostra para visualizar:', err);
          }
        }

        if (amostra) {
          carregarParametrosDaAmostra(amostra);
        }

        preencherFormulario(analise, true);
        modal.show();
        showInfo('Visualizando dados da análise', 'Modo Visualização');
      }
    } catch (error) {
      console.error('Erro ao visualizar análise:', error);
    }
  }

  async function removerAnalise(id) {
    if (!checkAuth()) return;

    if (confirm("Tem certeza que deseja remover esta análise?")) {
      try {
        await excluirAnaliseAPI(id);
        await carregarAnalises();
        showSuccess('Análise removida com sucesso!', 'Exclusão Concluída');
      } catch (error) {
        console.error('Erro ao remover análise:', error);
      }
    }
  }

  function abrirModalNovaAnalise() {
    if (!checkAuth()) return;

    window.editIndex = null;
    analysisForm.reset();
    limparParametros();

    if (usuarioLogado) {
      const responsavelInput = document.getElementById('responsavelAnalise');
      if (responsavelInput) responsavelInput.value = usuarioLogado.nome;
    }

    const elementosModal = Array.from(analysisForm.elements);
    elementosModal.forEach(el => el.disabled = false);
    // manter responsável desabilitado
    const responsavelInput = document.getElementById('responsavelAnalise');
    if (responsavelInput) responsavelInput.disabled = true;

    saveAnalysisBtn.style.display = 'inline-block';
    modal.show();
    showInfo('Preencha os dados da nova análise', 'Nova Análise');
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

    Object.values(itensMenu).forEach(item => {
      if (item) item.style.display = 'list-item';
    });

    switch (tipoUsuario) {
      case 'Apicultor':
        if (itensMenu.amostras) itensMenu.amostras.style.display = 'none';
        if (itensMenu.analises) itensMenu.analises.style.display = 'none';
        if (itensMenu.usuarios) itensMenu.usuarios.style.display = 'none';
        if (itensMenu.instituicoes) itensMenu.instituicoes.style.display = 'none';
        if (itensMenu.parametros) itensMenu.parametros.style.display = 'none';
        if (itensMenu.laudosRevisao) itensMenu.laudosRevisao.style.display = 'none';
        break;

      case 'Pesquisador':
        if (itensMenu.usuarios) itensMenu.usuarios.style.display = 'none';
        if (itensMenu.fazendas) itensMenu.fazendas.style.display = 'none';
        if (itensMenu.instituicoes) itensMenu.instituicoes.style.display = 'none';
        if (itensMenu.parametros) itensMenu.parametros.style.display = 'none';
        if (itensMenu.laudosRevisao) itensMenu.laudosRevisao.style.display = 'none';
        break;

      case 'Coordenador':
        if (itensMenu.instituicoes) itensMenu.instituicoes.style.display = 'none';
        break;

      case 'Administrador':
        break;

      default:
        console.warn('Tipo de usuário não reconhecido:', tipoUsuario);
    }

    ocultarSecaoAdministracaoSeNecessario();
  }

  function ocultarSecaoAdministracaoSeNecessario() {
    const secaoAdministracao = document.querySelector('.nav-item.mt-3 h6')?.closest('.nav-item');

    if (!secaoAdministracao) return;

    const itensAdministracao = [];
    let nextElement = secaoAdministracao.nextElementSibling;

    while (nextElement && !nextElement.querySelector('h6')) {
      itensAdministracao.push(nextElement);
      nextElement = nextElement.nextElementSibling;
    }

    const todosOcultos = itensAdministracao.length > 0 && itensAdministracao.every(item =>
      item.style.display === 'none' || window.getComputedStyle(item).display === 'none'
    );

    if (todosOcultos) {
      secaoAdministracao.style.display = 'none';
    } else {
      secaoAdministracao.style.display = 'list-item';
    }
  }

  function adaptarLinksParaApicultor(tipoUsuario, usuarioId) {
    if (tipoUsuario !== 'Apicultor') return;

    const linkFazendas = document.querySelector('a[href*="fazendas.html"]');
    if (linkFazendas) {
      linkFazendas.href = `../pages/fazendas.html?apicultor=${usuarioId}`;
    }

    const linkLaudos = document.querySelector('a[href*="laudos.html"]');
    if (linkLaudos) {
      linkLaudos.href = `../pages/laudos.html?apicultor=${usuarioId}`;
    }
  }

  // === INICIALIZAÇÃO ===

  async function carregarTudo() {
    if (!checkAuth()) return;

    try {
      showLoading('Carregando dados do sistema...', true);

      usuarioLogado = await getUser();

      if (usuarioLogado && usuarioLogado.instituicaoEscolhida?.tipoUsuario) {
        ocultarItensMenuPorPerfil(usuarioLogado.instituicaoEscolhida.tipoUsuario);
        adaptarLinksParaApicultor(usuarioLogado.instituicaoEscolhida.tipoUsuario, usuarioLogado.id);
      }

      configurarFiltros();

      await carregarPesquisadoresFilter();

      await carregarCardsAnalises();

      // Carregar análises e amostras (não carregamos todos os parâmetros)
      const resultados = await Promise.allSettled([
        carregarAnalises(),
        carregarAmostrasNoSelect()
      ]);

      const erros = resultados.filter(r => r.status === 'rejected');
      if (erros.length > 0) {
        showWarning('Alguns dados podem estar incompletos', 'Atenção');
      } else {
        showSuccess('Sistema de análises carregado com sucesso!', 'Bem-vindo');
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showError('Erro ao inicializar o sistema', 'Erro de Inicialização');
    } finally {
      hideLoading();
    }
  }

  // quando selecionar amostra no modal, buscar seus parâmetros e renderizar
  const selectAmostraEl = document.getElementById("selectAmostra");
  if (selectAmostraEl) {
    selectAmostraEl.addEventListener("change", async function () {
      const amostraId = this.value;
      if (!amostraId) {
        // limpar parametros se desmarcou
        limparParametros();
        return;
      }

      // tentar encontrar no array carregado
      let amostra = findAmostra(amostraId);

      // se não encontrada localmente, buscar na API
      if (!amostra) {
        try {
          showLoading('Carregando amostra...');
          const response = await fetch(`${API_BASE_URL}/amostras/${amostraId}`, {
            headers: getAuthHeaders("amostras", true)
          });
          hideLoading();
          if (!response.ok) throw new Error("Erro ao buscar amostra.");
          amostra = await response.json();
        } catch (err) {
          console.error(err);
          showError("Não foi possível carregar os parâmetros desta amostra.");
          return;
        }
      }

      carregarParametrosDaAmostra(amostra);
    });
  }

  // Variáveis globais para handlers HTML
  window.editIndex = null;
  window.editarAnalise = editarAnalise;
  window.visualizarAnalise = visualizarAnalise;
  window.removerAnalise = removerAnalise;
  window.limparFiltros = limparFiltros;
  window.mudarPagina = mudarPagina;

  if (addAnaliseBtn) {
    addAnaliseBtn.addEventListener('click', abrirModalNovaAnalise);
  }

  if (checkAuth()) {
    carregarTudo();
  }
});
