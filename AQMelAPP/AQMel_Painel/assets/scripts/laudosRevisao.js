import API_BASE_URL from '../../../chave_api.js'

document.addEventListener('DOMContentLoaded', () => {
  //const API_BASE_URL = 'http://localhost:3000';
  let laudos = [];
  let laudoSelecionado = null;
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
  const tabelaPendentes = document.querySelector('#approveReportModal tbody');
  const tabelaTodos = document.querySelector('.table-responsive .table tbody');
  const reviewPanel = document.getElementById('reviewPanel');
  const resultsTable = document.getElementById('resultsTable');
  const submitReviewBtn = document.getElementById('submitReviewBtn');
  const cancelReviewBtn = document.getElementById('cancelReviewBtn');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.querySelector('.loading-text');
  const progressFill = document.querySelector('.progress-fill');
  const modalRevisao = new bootstrap.Modal(document.getElementById('approveReportModal'));

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
    const searchFilter = document.getElementById('search-filter');
    const statusFilter = document.getElementById('filter-status');
    const dataInicioFilter = document.getElementById('filter-data-inicio');
    const dataFimFilter = document.getElementById('filter-data-fim');

    if (searchFilter) searchFilter.value = '';
    if (statusFilter) statusFilter.value = '';
    if (dataInicioFilter) dataInicioFilter.value = '';
    if (dataFimFilter) dataFimFilter.value = '';

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

  // === FUNÇÕES PARA LAUDOS ===
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

  async function carregarLaudos(page = 1, filters = currentFilters) {
    if (!checkAuth()) return;
    
    try {
      const resultado = await fetchLaudos(filters, page, currentLimit);
      laudos = resultado.laudos || [];
      renderizarLaudos();
      paginacaoAtual = resultado.paginacao; 
      atualizarPaginacao(resultado.paginacao);
      preencherTabelaPendentes(); // Atualiza também a tabela de pendentes
      
      if (laudos.length > 0) {
        showSuccess(`${resultado.paginacao?.total || laudos.length} laudos encontrados`, 'Dados Carregados');
      } else {
        showWarning('Nenhum laudo encontrado com os filtros aplicados', 'Sem Dados');
      }
    } catch (error) {
      console.error('Erro ao carregar laudos:', error);
    }
  }

  // === FUNÇÕES DE RENDERIZAÇÃO ===
  function renderizarLaudos() {
    if (!tabelaTodos) return;
    
    tabelaTodos.innerHTML = '';

    if (laudos.length === 0) {
      tabelaTodos.innerHTML = `
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
      
      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td>
          <div class="d-flex px-2 py-1">
            <div class="d-flex flex-column justify-content-center">
              <h6 class="mb-0 text-sm">${laudo.id}</h6>
            </div>
          </div>
        </td>
        <td>
          <p class="text-sm font-weight-bold mb-0">${primeiraAnalise.id || 'N/A'}</p>
          <p class="text-xs text-secondary mb-0">${primeiraAnalise.tipo || 'Sem análises'}</p>
        </td>
        <td class="align-middle text-center text-sm">
          <span class="text-xs font-weight-bold">${primeiraAnalise.tipo || '-'}</span>
        </td>
        <td class="align-middle text-center">
          <span class="text-secondary text-xs font-weight-bold">${laudo.dataEmissao || laudo.data || '-'}</span>
        </td>
        <td class="align-middle text-center">
          <span class="badge badge-sm ${getStatusBadgeClass(laudo.status)}">${laudo.status || 'Pendente'}</span>
        </td>
        <td class="align-middle text-center">
          <a href="javascript:;" class="text-secondary font-weight-bold text-xs" onclick="visualizarLaudo('${laudo.id}')" data-toggle="tooltip" title="Visualizar">
            <i class="material-symbols-rounded">visibility</i>
          </a>
          <a href="javascript:;" class="text-secondary font-weight-bold text-xs ms-2" onclick="imprimirLaudo('${laudo.id}')" data-toggle="tooltip" title="Imprimir">
            <i class="material-symbols-rounded">print</i>
          </a>
          ${laudo.status === 'Pendente' ? `
          <a href="javascript:;" class="text-success font-weight-bold text-xs ms-2" onclick="revisarLaudo('${laudo.id}')" data-toggle="tooltip" title="Revisar">
            <i class="material-symbols-rounded">rate_review</i>
          </a>
          ` : ''}
        </td>
      `;

      tabelaTodos.appendChild(tr);
    });
  }

  function preencherTabelaPendentes() {
    if (!tabelaPendentes) return;
    
    const laudosPendentes = laudos.filter(laudo => laudo.status === 'Pendente');
    tabelaPendentes.innerHTML = '';
    
    if (laudosPendentes.length === 0) {
      tabelaPendentes.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4">
            <i class="material-symbols-rounded text-muted mb-2" style="font-size: 3rem;">assignment_turned_in</i>
            <p class="text-muted mb-0">Nenhum laudo pendente encontrado</p>
          </td>
        </tr>
      `;
      return;
    }

    laudosPendentes.forEach((laudo) => {
      const primeiraAnalise = laudo.analises && laudo.analises[0] ? laudo.analises[0] : {};
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><h6 class="mb-0 text-sm">${laudo.id}</h6></td>
        <td>
          <p class="text-sm font-weight-bold mb-0">${primeiraAnalise.id || 'N/A'}</p>
          <p class="text-xs text-secondary mb-0">${primeiraAnalise.tipo || 'Sem análises'}</p>
        </td>
        <td class="align-middle text-sm">${laudo.responsavel || '-'}</td>
        <td class="align-middle text-sm">${laudo.dataEmissao || laudo.data || '-'}</td>
        <td class="align-middle"><span class="badge badge-sm bg-gradient-warning">Pendente</span></td>
        <td class="align-middle">
          <button class="btn btn-sm bg-gradient-success mb-0 me-1" onclick="revisarLaudo('${laudo.id}')">
            <i class="material-symbols-rounded fs-6">visibility</i> Revisar
          </button>
        </td>
      `;
      tabelaPendentes.appendChild(tr);
    });
  }

  // === FUNÇÕES AUXILIARES ===
  function getStatusBadgeClass(status) {
    switch(status?.toLowerCase()) {
      case 'emitido': return 'bg-gradient-success';
      case 'validado': return 'bg-gradient-info';
      case 'pendente': return 'bg-gradient-warning';
      case 'rejeitado': return 'bg-gradient-danger';
      default: return 'bg-gradient-secondary';
    }
  }

  // === FUNÇÕES PARA TABELA COMPARATIVA ===
  function listContainsParametro(lista, parametro) {
    for (const elemento of lista) {
      if (elemento.id == parametro.id) return true;
    }
    return false;
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

  function findParametroByIndex(analise, parametro) {
    const parametros = analise.parametros;

    for (const parametroLista of parametros) {
      if (parametroLista.id == parametro.id) return parametroLista;
    }

    return { valor: '-', unidade: '', referencia: '' };
  }

  function criarTabelaComparativa(analises) {
    const parametrosUnicos = extrairParametrosUnicos(analises);
    
    let html = `
      <table class="table table-bordered table-hover align-items-center mb-0">
        <thead class="thead-light">
          <tr>
            <th class="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7 bg-gray-100">Parâmetro</th>
    `;
    
    analises.forEach((analise, index) => {
      html += `
        <th class="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7 text-center bg-gray-50">
          <div class="d-flex flex-column">
            <span class="text-xs font-weight-bold">${analise.id}</span>
            <small class="text-xs text-muted">${analise.tipo || 'N/A'}</small>
          </div>
        </th>
      `;
    });
    
    html += `</tr></thead><tbody>`;
    
    parametrosUnicos.forEach(parametro => {
      html += `<tr><td class="text-sm font-weight-bold bg-gray-100">${parametro.nome} (${parametro.unidade})</td>`;
      
      analises.forEach(analise => {
        const valorParametro = findParametroByIndex(analise, parametro);
        const valor = valorParametro.valor;
        const unidade = valorParametro.unidade || '';
        const referencia = valorParametro.referencia || '';
        
        html += `
          <td class="text-center align-middle">
            <div class="d-flex flex-column">
              <span class="text-sm font-weight-bold ${valor && valor !== '-' ? 'text-dark' : 'text-muted'}">
                ${valor || '-'}
              </span>
              ${unidade ? `<small class="text-xs text-muted">${unidade}</small>` : ''}
              ${referencia ? `<small class="text-xs text-info">Ref: ${referencia}</small>` : ''}
            </div>
          </td>
        `;
      });
      
      html += `</tr>`;
    });
    
    html += `</tbody></table>`;
    
    return html;
  }

  // === FUNÇÕES PARA REVISÃO ===
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

  async function exibirPainelRevisao(laudoId) {
    if (!checkAuth()) return;
    
    showLoading('Carregando detalhes do laudo...', true);
    
    try {
      laudoSelecionado = await buscarLaudoPorId(laudoId);
      
      if (!laudoSelecionado) {
        throw new Error('Laudo não encontrado');
      }

      document.getElementById('reportId').textContent = laudoSelecionado.id;
      document.getElementById('reportAnalyst').textContent = laudoSelecionado.responsavel || '-';
      document.getElementById('reportIssueDate').textContent = laudoSelecionado.dataEmissao || laudoSelecionado.data || '-';
      document.getElementById('reportConclusion').value = laudoSelecionado.conclusao || '';
      document.getElementById('reviewComments').value = '';

      const analisesHTML = laudoSelecionado.analises && laudoSelecionado.analises.length > 0 
        ? laudoSelecionado.analises.map(analise => 
            `${analise.id} - ${analise.tipo || 'N/A'}`
          ).join('<br>')
        : 'Nenhuma análise vinculada';
      
      document.getElementById('reportSample').innerHTML = analisesHTML;

      updateLoadingText('Gerando tabela comparativa...');
      resultsTable.innerHTML = '';
      
      if (laudoSelecionado.analises && laudoSelecionado.analises.length > 0) {
        const tabelaComparativa = criarTabelaComparativa(laudoSelecionado.analises);
        resultsTable.innerHTML = tabelaComparativa;
      } else {
        resultsTable.innerHTML = `
          <div class="text-center text-muted py-4">
            <i class="material-symbols-rounded opacity-10 mb-2">science_off</i>
            <p class="mb-0">Nenhuma análise vinculada a este laudo</p>
          </div>
        `;
      }

      hideLoading();
      showInfo('Laudo carregado com sucesso', 'Pronto para Revisão');
      reviewPanel.classList.remove('d-none');
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Erro ao carregar os detalhes do laudo', 'Erro de Carregamento');
    }
  }

  async function submeterRevisao() {
    if (!checkAuth()) return;
    
    const decision = document.querySelector('input[name="reportDecision"]:checked');
    const comments = document.getElementById('reviewComments').value.trim();

    if (!decision) {
      showWarning('Selecione uma decisão antes de continuar', 'Decisão Necessária');
      return;
    }

    if (decision.value === 'reject' && comments === '') {
      showWarning('Para reprovar o laudo, insira comentários explicativos', 'Comentários Obrigatórios');
      return;
    }

    showLoading(decision.value === 'approve' ? 'Aprovando laudo...' : 'Reprovando laudo...');

    try {
      const endpoint = decision.value === 'approve' 
        ? `${API_BASE_URL}/laudos/revisao/aprovar/${laudoSelecionado.id}`
        : `${API_BASE_URL}/laudos/revisao/reprovar/${laudoSelecionado.id}`;

      const body = decision.value === 'reject' ? { observacoes: comments } : {};

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders("revisaoLaudos"),
        body: JSON.stringify(body)
      });

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error('Erro ao submeter revisão');
      }

      const resultado = await response.json();
      
      if (resultado.sucess || resultado.success) {
        const acao = decision.value === 'approve' ? 'aprovado' : 'reprovado';
        
        hideLoading();
        showSuccess(`Laudo ${laudoSelecionado.id} ${acao} com sucesso!`, 'Revisão Concluída');
        
        reviewPanel.classList.add('d-none');
        
        // Recarrega os laudos para refletir a mudança de status
        await carregarLaudos(currentPage, currentFilters);
        await carregarCardsLaudos(); // Atualiza os cards também
      }
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Erro ao enviar a revisão do laudo', 'Erro de Envio');
    }
  }

  // === FUNÇÃO PARA ABRIR MODAL DE REVISÃO ===
  function abrirModalRevisao() {
    if (!checkAuth()) return;
    
    // Primeiro abre o modal
    modalRevisao.show();
    
    // Depois carrega os laudos pendentes
    setTimeout(() => {
      preencherTabelaPendentes();
      showInfo('Modal de revisão aberto', 'Revisar Laudos');
    }, 500);
  }

  async function visualizarLaudo(id) {
    if (!checkAuth()) return;
    
    showLoading('Carregando detalhes do laudo...', true);
    
    try {
        const laudo = await buscarLaudoPorId(id);
        
        if (!laudo) {
            throw new Error('Laudo não encontrado');
        }

        // Criar modal de visualização dinamicamente
        criarModalVisualizacao(laudo);
        
        hideLoading();
        
    } catch (error) {
        console.error('Erro:', error);
        hideLoading();
        showError('Erro ao carregar os detalhes do laudo', 'Erro de Carregamento');
    }
  }

  function criarModalVisualizacao(laudo) {
    const modalId = 'visualizacaoLaudoModal';
    
    // Remove modal existente se houver
    const modalExistente = document.getElementById(modalId);
    if (modalExistente) {
        modalExistente.remove();
    }

    const primeiraAnalise = laudo.analises && laudo.analises[0] ? laudo.analises[0] : {};
    const infoOrigem = obterInfoOrigem(laudo.analises || []);
    
    const modalHTML = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
            <div class="modal-dialog modal-xl modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-gradient-info text-white">
                        <h5 class="modal-title">
                            <i class="material-symbols-rounded me-2">visibility</i>
                            Visualizar Laudo - ${laudo.id}
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    
                    <div class="modal-body pt-4">
                        <!-- Cabeçalho do Laudo -->
                        <div class="row mb-4">
                            <div class="col-md-12">
                                <div class="card  text-white">
                                    <div class="card-body p-3">
                                        <div class="row">
                                            <div class="col-md-4 text-center border-end">
                                                <h6 class="mb-1">Número do Laudo</h6>
                                                <h4 class="mb-0">${laudo.id}</h4>
                                            </div>
                                            <div class="col-md-4 text-center border-end">
                                                <h6 class="mb-1">Data de Emissão</h6>
                                                <h5 class="mb-0">${formatarData(laudo.dataEmissao || laudo.data)}</h5>
                                            </div>
                                            <div class="col-md-4 text-center">
                                                <h6 class="mb-1">Status</h6>
                                                <span class="badge badge-lg ${getStatusBadgeClass(laudo.status)}">${laudo.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="row">
                            <!-- Informações do Produtor -->
                            <div class="col-md-6 mb-4">
                                <div class="card">
                                    <div class="card-header p-3 pb-2">
                                        <h6 class="mb-0">
                                            <i class="material-symbols-rounded me-2 fs-6">person</i>
                                            Informações do Produtor
                                        </h6>
                                    </div>
                                    <div class="card-body p-3">
                                        <div class="d-flex flex-column">
                                            <div class="mb-3">
                                                <strong class="text-sm">Apicultor:</strong>
                                                <p class="text-sm mb-0">${infoOrigem.apicultor}</p>
                                            </div>
                                            <div class="mb-3">
                                                <strong class="text-sm">Fazenda/Origem:</strong>
                                                <p class="text-sm mb-0">${infoOrigem.fazenda}</p>
                                            </div>
                                            <div>
                                                <strong class="text-sm">Localização:</strong>
                                                <p class="text-sm mb-0">${infoOrigem.localizacao || 'Não informado'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Informações Técnicas -->
                            <div class="col-md-6 mb-4">
                                <div class="card">
                                    <div class="card-header p-3 pb-2">
                                        <h6 class="mb-0">
                                            <i class="material-symbols-rounded me-2 fs-6">business</i>
                                            Informações Técnicas
                                        </h6>
                                    </div>
                                    <div class="card-body p-3">
                                        <div class="d-flex flex-column">
                                            <div class="mb-3">
                                                <strong class="text-sm">Responsável:</strong>
                                                <p class="text-sm mb-0">${laudo.responsavel || 'Não informado'}</p>
                                            </div>
                                            <div class="mb-3">
                                                <strong class="text-sm">Instituição:</strong>
                                                <p class="text-sm mb-0">${laudo.idInstituicao || 'Não informado'}</p>
                                            </div>
                                            <div>
                                                <strong class="text-sm">Data de Análise:</strong>
                                                <p class="text-sm mb-0">${formatarData(primeiraAnalise.dataAnalisada || primeiraAnalise.data)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Análises Vinculadas -->
                        <div class="row mb-4">
                            <div class="col-md-12">
                                <div class="card">
                                    <div class="card-header p-3 pb-2">
                                        <h6 class="mb-0">
                                            <i class="material-symbols-rounded me-2 fs-6">science</i>
                                            Análises Vinculadas
                                        </h6>
                                    </div>
                                    <div class="card-body p-3">
                                        <div class="table-responsive">
                                            <table class="table table-bordered table-hover align-items-center mb-0">
                                                <thead class="thead-light">
                                                    <tr>
                                                        <th class="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Código</th>
                                                        <th class="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Tipo</th>
                                                        <th class="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Data</th>
                                                        <th class="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${laudo.analises && laudo.analises.length > 0 ? 
                                                        laudo.analises.map(analise => `
                                                            <tr>
                                                                <td class="text-sm font-weight-bold">${analise.id}</td>
                                                                <td class="text-sm">${analise.tipo || 'N/A'}</td>
                                                                <td class="text-sm">${formatarData(analise.dataAnalisada || analise.data)}</td>
                                                                <td class="text-center">
                                                                    <span class="badge badge-sm ${analise.status === 'Concluída' ? 'bg-gradient-success' : 'bg-gradient-warning'}">
                                                                        ${analise.status || 'Pendente'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        `).join('') : 
                                                        `<tr><td colspan="4" class="text-center text-muted py-3">Nenhuma análise vinculada</td></tr>`
                                                    }
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Resultados das Análises -->
                        <div class="row mb-4">
                            <div class="col-md-12">
                                <div class="card">
                                    <div class="card-header p-3 pb-2">
                                        <h6 class="mb-0">
                                            <i class="material-symbols-rounded me-2 fs-6">analytics</i>
                                            Resultados das Análises
                                        </h6>
                                    </div>
                                    <div class="card-body p-3">
                                        ${laudo.analises && laudo.analises.length > 0 ? 
                                            criarTabelaComparativa(laudo.analises) : 
                                            `<div class="text-center text-muted py-4">
                                                <i class="material-symbols-rounded opacity-10 mb-2">science_off</i>
                                                <p class="mb-0">Nenhuma análise vinculada a este laudo</p>
                                            </div>`
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Conclusão e Observações -->
                        <div class="row">
                            <div class="col-md-6 mb-4">
                                <div class="card">
                                    <div class="card-header p-3 pb-2">
                                        <h6 class="mb-0">
                                            <i class="material-symbols-rounded me-2 fs-6">check_circle</i>
                                            Conclusão
                                        </h6>
                                    </div>
                                    <div class="card-body p-3">
                                        <div class="d-flex align-items-center">
                                            <span class="badge badge-lg ${
                                                laudo.conclusao === 'Aprovado' ? 'bg-gradient-success' : 
                                                laudo.conclusao === 'Reprovado' ? 'bg-gradient-danger' : 
                                                'bg-gradient-warning'
                                            } me-3">
                                                ${laudo.conclusao || 'Pendente'}
                                            </span>
                                            <span class="text-sm">${obterDescricaoConclusao(laudo.conclusao)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="col-md-6 mb-4">
                                <div class="card">
                                    <div class="card-header p-3 pb-2">
                                        <h6 class="mb-0">
                                            <i class="material-symbols-rounded me-2 fs-6">notes</i>
                                            Observações
                                        </h6>
                                    </div>
                                    <div class="card-body p-3">
                                        <p class="text-sm mb-0">${laudo.observacoes || 'Nenhuma observação registrada.'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Histórico de Revisões -->
                        ${laudo.revisoes && laudo.revisoes.length > 0 ? `
                        <div class="row">
                            <div class="col-md-12">
                                <div class="card">
                                    <div class="card-header p-3 pb-2">
                                        <h6 class="mb-0">
                                            <i class="material-symbols-rounded me-2 fs-6">history</i>
                                            Histórico de Revisões
                                        </h6>
                                    </div>
                                    <div class="card-body p-3">
                                        <div class="timeline">
                                            ${laudo.revisoes.map(revisao => `
                                                <div class="timeline-item mb-3">
                                                    <div class="timeline-content">
                                                        <div class="d-flex justify-content-between align-items-center mb-1">
                                                            <strong class="text-sm">${revisao.revisor || 'Sistema'}</strong>
                                                            <small class="text-muted">${formatarData(revisao.data)}</small>
                                                        </div>
                                                        <p class="text-sm mb-1">${revisao.acao || 'Revisão realizada'}</p>
                                                        ${revisao.observacoes ? `<p class="text-xs text-muted mb-0">${revisao.observacoes}</p>` : ''}
                                                    </div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
                            <i class="material-symbols-rounded me-1">close</i> Fechar
                        </button>
                        <button type="button" class="btn bg-gradient-info" onclick="imprimirLaudo('${laudo.id}')">
                            <i class="material-symbols-rounded me-1">print</i> Imprimir
                        </button>
                        ${laudo.status === 'Pendente' ? `
                        <button type="button" class="btn bg-gradient-success" onclick="iniciarRevisao('${laudo.id}')">
                            <i class="material-symbols-rounded me-1">rate_review</i> Iniciar Revisão
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Adiciona o modal ao body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Mostra o modal
    const modal = new bootstrap.Modal(document.getElementById(modalId));
    modal.show();

    // Remove o modal do DOM quando fechado
    document.getElementById(modalId).addEventListener('hidden.bs.modal', function () {
        this.remove();
    });
  }

  // === FUNÇÕES AUXILIARES PARA VISUALIZAÇÃO ===
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

function formatarData(dataString) {
    if (!dataString) return 'N/A';
    
    try {
        const date = new Date(dataString);
        return date.toLocaleDateString('pt-BR');
    } catch (error) {
        console.error('Erro ao formatar data:', error);
        return dataString;
    }
}

function obterDescricaoConclusao(conclusao) {
    const descricoes = {
        'Aprovado': 'O produto atende a todos os parâmetros de qualidade estabelecidos.',
        'Reprovado': 'O produto não atende a um ou mais parâmetros de qualidade.',
        'Condicional': 'O produto atende aos parâmetros críticos, mas possui observações.',
        'Pendente': 'Aguardando análise e conclusão técnica.'
    };
    
    return descricoes[conclusao] || 'Status não definido.';
}

function iniciarRevisao(laudoId) {
    // Fecha o modal de visualização
    const modal = bootstrap.Modal.getInstance(document.getElementById('visualizacaoLaudoModal'));
    if (modal) modal.hide();
    
    // Abre o modal de revisão
    setTimeout(() => {
        revisarLaudo(laudoId);
    }, 500);
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
                    <div class="section-title">📋 INFORMAÇÕES DO LAUDO</div>
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
                    <div class="section-title">👨‍🌾 INFORMAÇÕES DO PRODUTOR</div>
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
                    <div class="section-title">🔬 ANÁLISES VINCULADAS</div>
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
                    <div class="section-title">📊 RESULTADOS DAS ANÁLISES</div>
                    <div class="section-content">
                        ${gerarTabelaResultadosPDF(laudo.analises)}
                    </div>
                </div>
                ` : ''}

                <!-- Conclusão -->
                <div class="section">
                    <div class="section-title">✅ CONCLUSÃO TÉCNICA</div>
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
                    <p>📄 <strong>Laudo gerado automaticamente pelo Sistema AQMel APP</strong></p>
                    <p>🏭 Laboratório certificado - Sistema de Gestão da Qualidade</p>
                    <p>📞 Documento válido sem assinatura digital - Nº ${laudo.id}</p>
                    <p style="margin-top: 8px; color: #B4690F;">
                        🍯 <em>Comprometidos com a qualidade e pureza do mel brasileiro</em> 🐝
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
    ocultarSecaoAdministracaoSeNecessario();
}

function ocultarSecaoAdministracaoSeNecessario() {
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

    if (todosOcultos) {
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

  // === INICIALIZAÇÃO ===
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

      showInfo('Sistema de revisão de laudos carregado', 'Bem-vindo');
      
      try {
        showLoading('Carregando dados do sistema...', true);
        
        configurarFiltros();
        
        // Carrega cards e laudos simultaneamente
        await Promise.all([
          carregarCardsLaudos(),
          carregarLaudos()
        ]);
        
      } catch (error) {
        console.error('Erro ao inicializar:', error);
        showError('Erro ao carregar o sistema de revisão de laudos', 'Erro de Inicialização');
      } finally {
        hideLoading();
      }

      // Event listeners para os botões de revisão
      if (submitReviewBtn) {
        submitReviewBtn.addEventListener('click', submeterRevisao);
      }

      if (cancelReviewBtn) {
        cancelReviewBtn.addEventListener('click', () => {
          reviewPanel.classList.add('d-none');
          laudoSelecionado = null;
          showInfo('Revisão cancelada', 'Ação Cancelada');
        });
      }

      // Adiciona event listener para o botão "Revisar Laudos" no cabeçalho
      const btnRevisarLaudos = document.querySelector('[data-bs-target="#approveReportModal"]');
      if (btnRevisarLaudos) {
        btnRevisarLaudos.addEventListener('click', abrirModalRevisao);
      }
    }
  }

  // === FUNÇÕES GLOBAIS ===
  window.mudarPagina = mudarPagina;
  window.limparFiltros = limparFiltros;
  window.visualizarLaudo = visualizarLaudo;
  window.iniciarRevisao = iniciarRevisao;
  window.imprimirLaudo = imprimirLaudo;
  window.revisarLaudo = function(laudoId) {
    // Abre o modal primeiro
    modalRevisao.show();
    
    // Depois exibe o painel de revisão para o laudo específico
    setTimeout(() => {
      exibirPainelRevisao(laudoId);
    }, 500);
  };
  window.abrirModalRevisao = abrirModalRevisao;

  inicializar();
});