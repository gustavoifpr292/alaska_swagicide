import API_BASE_URL from '../../../chave_api.js'

document.addEventListener('DOMContentLoaded', () => {
  //const API_BASE_URL = 'http://localhost:3000';
  let fazendas = [];
  let editIndex = null;
  let usuarioLogado = null;
  let paginacaoAtual = null;

  // Variáveis de estado para filtros e paginação
  let currentPage = 1;
  let currentLimit = 10;
  let currentFilters = {
    search: '',
    status: '',
    regiao: ''
  };

  // Elementos DOM
  const fazendasForm = document.getElementById('fazendaForm');
  const saveFazendaBtn = document.getElementById('saveFazendaBtn');
  const newFazendaModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('newFazendaModal'));
  const tbodyFazendas = document.getElementById('fazendasTableBody');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.querySelector('.loading-text');
  const modalTitle = document.getElementById('modalTitle');

  // === SISTEMA DE LOADING ===
  let loadingCount = 0;
  let currentLoadingMessage = '';

  function showLoading(message = 'Processando...', isLongOperation = false) {
    if (loadingCount === 0) {
      const loadingOverlay = document.getElementById('loadingOverlay');
      const loadingText = document.querySelector('.loading-text');
      const progressFill = document.querySelector('.progress-fill');
      
      if (loadingText) {
        loadingText.textContent = message;
        currentLoadingMessage = message;
      }
      if (loadingOverlay) {
        if (isLongOperation) {
          loadingOverlay.classList.add('long-operation');
        } else {
          loadingOverlay.classList.remove('long-operation');
        }
        loadingOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';
      }
    } else {
      updateLoadingText(message);
    }
    loadingCount++;
  }

  function hideLoading() {
    loadingCount = Math.max(0, loadingCount - 1);
    
    if (loadingCount === 0) {
      const loadingOverlay = document.getElementById('loadingOverlay');
      const progressFill = document.querySelector('.progress-fill');
      
      if (loadingOverlay) {
        loadingOverlay.classList.remove('show');
        document.body.style.overflow = '';
      }
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
    const loadingText = document.querySelector('.loading-text');
    if (loadingText && loadingCount > 0) {
      loadingText.textContent = message;
      currentLoadingMessage = message;
    }
  }

  // === SISTEMA DE NOTIFICAÇÕES ===
  function showNotification({ title, message, type = 'info', duration = 5000 } = {}) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    
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

  function showSuccess(message, title = 'Sucesso!') {
    return showNotification({ title, message, type: 'success', duration: 4000 });
  }

  function showError(message, title = 'Erro!') {
    return showNotification({ title, message, type: 'error', duration: 6000 });
  }

  function showWarning(message, title = 'Atenção!') {
    return showNotification({ title, message, type: 'warning', duration: 5000 });
  }

  function showInfo(message, title = 'Informação') {
    return showNotification({ title, message, type: 'info', duration: 4000 });
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

  function getAuthHeaders(colecao = null) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    };
    
    if (colecao) {
      headers['ObjectCollection'] = colecao;
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
    if (isAuthenticated()) {
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
    }
  }

  // === FUNÇÕES UTILITÁRIAS ===
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

  // === SISTEMA DE FILTROS ===
  function configurarFiltrosFazendas() {
    // Filtro de busca
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', debounce((e) => {
        currentFilters.search = e.target.value;
        currentPage = 1;
        carregarFazendas(currentPage, currentFilters);
      }, 500));
    }

    // Filtro de status
    const statusFilter = document.getElementById('filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        currentFilters.status = e.target.value;
        currentPage = 1;
        carregarFazendas(currentPage, currentFilters);
      });
    }

    // Filtro de região
    const regiaoFilter = document.getElementById('filter-regiao');
    if (regiaoFilter) {
      regiaoFilter.addEventListener('change', (e) => {
        currentFilters.regiao = e.target.value;
        currentPage = 1;
        carregarFazendas(currentPage, currentFilters);
      });
    }

    // Botão limpar filtros
    adicionarBotaoLimparFiltrosFazendas();
  }

  function adicionarBotaoLimparFiltrosFazendas() {
    const cardHeader = document.querySelector('.card-header .row');
    if (!cardHeader) return;

    // Verificar se já existe botão de limpar
    if (document.getElementById('limpar-filtros-fazendas')) return;

    const limparBtn = document.createElement('button');
    limparBtn.id = 'limpar-filtros-fazendas';
    limparBtn.className = 'btn btn-outline-secondary mb-0 ms-2';
    limparBtn.innerHTML = '<i class="material-symbols-rounded me-1">clear_all</i> Limpar';
    limparBtn.addEventListener('click', limparFiltrosFazendas);

    // Adicionar ao layout
    const filtroContainer = document.querySelector('.col-md-2.text-end');
    if (filtroContainer) {
      filtroContainer.appendChild(limparBtn);
    }
  }

  function limparFiltrosFazendas() {
    // Limpar valores dos inputs
    document.getElementById('searchInput').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-regiao').value = '';

    // Resetar filtros
    currentFilters = {
      search: '',
      status: '',
      regiao: ''
    };
    currentPage = 1;

    // Recarregar fazendas
    carregarFazendas();
    showInfo('Filtros limpos', 'Filtros');
  }

  // === SISTEMA DE PAGINAÇÃO ===
  function atualizarPaginacaoFazendas(paginacao) {
    const paginationContainer = document.querySelector('.pagination');
    if (!paginationContainer || !paginacao) return;

    const { page, pages, total } = paginacao;
    
    let paginationHTML = `
      <li class="page-item ${page === 1 ? 'disabled' : ''}">
        <a class="page-link" href="javascript:;" onclick="mudarPaginaFazendas(${page - 1})">
          <i class="material-symbols-rounded">chevron_left</i>
        </a>
      </li>
    `;

    // Gerar números de página
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) {
        paginationHTML += `
          <li class="page-item ${i === page ? 'active' : ''}">
            <a class="page-link" href="javascript:;" onclick="mudarPaginaFazendas(${i})">${i}</a>
          </li>
        `;
      } else if (i === page - 3 || i === page + 3) {
        paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
      }
    }

    paginationHTML += `
      <li class="page-item ${page === pages ? 'disabled' : ''}">
        <a class="page-link" href="javascript:;" onclick="mudarPaginaFazendas(${page + 1})">
          <i class="material-symbols-rounded">chevron_right</i>
        </a>
      </li>
    `;

    paginationContainer.innerHTML = paginationHTML;
    
    // Atualizar contador
    const quantFazendas = document.getElementById('totalFazendasCount');
    if (quantFazendas) {
      const start = ((page - 1) * currentLimit) + 1;
      const end = Math.min(page * currentLimit, total);
      quantFazendas.innerHTML = `${start}-${end} de ${total} fazendas`;
    }
  }

  function mudarPaginaFazendas(novaPagina) {
    if (!paginacaoAtual) return;
  
    if (novaPagina < 1 || novaPagina > paginacaoAtual.pages) return;
  
    currentPage = novaPagina;
    carregarFazendas(currentPage, currentFilters);
  }

  // === FUNÇÕES PRINCIPAIS ===
  async function fetchFazendas(filters = {}, page = 1, limit = 10) {
    if (!checkAuth()) return { fazendas: [], paginacao: {} };
    
    showLoading('Carregando locais de origem...');
    
    try {
      // Construir query string com filtros
      const queryParams = new URLSearchParams({
        page,
        limit,
        ...filters
      });

      const url = usuarioLogado.instituicaoEscolhida.tipoUsuario === "Apicultor" ? `${API_BASE_URL}/fazendas/usuario/${usuarioLogado.id}/?${queryParams}` : `${API_BASE_URL}/fazendas/?${queryParams}`;

      const response = await fetch(url, {
        headers: getAuthHeaders("fazendas")
      });
      
      if (response.status === 401) {
        handleAuthError();
        return { fazendas: [], paginacao: {} };
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar fazendas');
      }
      
      updateLoadingText('Processando locais de origem...');
      const dados = await response.json();
      return dados;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Não foi possível carregar os locais de origem', 'Erro de Conexão');
      return { fazendas: [], paginacao: {} };
    }
  }

  async function salvarFazenda(fazenda, id = null) {
    if (!checkAuth()) return;
    
    showLoading(id ? 'Atualizando local de origem...' : 'Salvando local de origem...');
    
    try {
      const url = id ? `${API_BASE_URL}/fazendas/${id}` : `${API_BASE_URL}/fazendas/`;
      const method = id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: getAuthHeaders("fazendas"),
        body: JSON.stringify(fazenda)
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao salvar local de origem');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao salvar local de origem', 'Erro de Salvamento');
      throw error;
    }
  }

  async function excluirFazendaAPI(id) {
    if (!checkAuth()) return;
    
    showLoading('Excluindo local de origem...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/fazendas/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders("fazendas")
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao excluir local de origem');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao excluir fazenda', 'Erro de Exclusão');
      throw error;
    }
  }

  async function buscarFazendaPorId(id) {
    if (!checkAuth()) return null;
    
    showLoading('Carregando local de origem...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/fazendas/${id}`, {
        headers: getAuthHeaders("fazendas")
      });
      
      if (response.status === 401) {
        handleAuthError();
        return null;
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar local de origem');
      }
      
      const fazenda = await response.json();
      hideLoading();
      return fazenda;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Erro ao carregar local de origem', 'Erro de Carregamento');
      return null;
    }
  }

  // Função para carregar os cards com totais
  async function carregarCardsFazendas() {
    if (!checkAuth()) return;
    
    showLoading('Carregando estatísticas...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/fazendas/count`, {
        headers: getAuthHeaders("fazendas"),
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar estatísticas');
      }
      
      const totais = await response.json();
      atualizarCardsFazendas(totais);
      
    } catch (error) {
      console.error('Erro ao carregar cards:', error);
      showError('Erro ao carregar estatísticas', 'Erro de Conexão');
    } finally {
      hideLoading();
    }
  }

  // Função para atualizar os cards na interface
  function atualizarCardsFazendas(totais) {
    // Card Total de Fazendas
    const cardTotal = document.getElementById('totalFazendas');
    if (cardTotal) {
      cardTotal.textContent = totais.total || '0';
    }

    // Card Apiários Ativos
    const cardApiarios = document.getElementById('apiariosAtivos');
    if (cardApiarios) {
      const totalApiarios = fazendas.reduce((sum, fazenda) => sum + (fazenda.numApiarios || 0), 0);
      cardApiarios.textContent = totalApiarios;
    }

    // Card Fazendas Ativas
    const cardAtivas = document.getElementById('fazendasComLaudos');
    if (cardAtivas) {
      cardAtivas.textContent = totais.ativas || '0';
    }

    // Card Fazendas Inativas
    const cardInativas = document.getElementById('fazendasInativas');
    if (cardInativas) {
      cardInativas.textContent = totais.inativas || '0';
    }
  }

  async function carregarFazendas(page = 1, filters = currentFilters) {
    if (!checkAuth()) return;
    
    try {
      const resultado = await fetchFazendas(filters, page, currentLimit);
      fazendas = resultado.fazendas || [];
      renderizarFazendas();
      paginacaoAtual = resultado.paginacao; 
      atualizarPaginacaoFazendas(resultado.paginacao);
      atualizarEstatisticas();
      
      if (fazendas.length > 0) {
        showSuccess(`${resultado.paginacao?.total || fazendas.length} fazendas encontradas`, 'Dados Carregados');
      } else {
        showWarning('Nenhum local de origem encontrado com os filtros aplicados', 'Sem Dados');
      }

      hideLoading();
    } catch (error) {
      console.error('Erro ao carregar locais de origem:', error);
    }
  }

  function renderizarFazendas() {
    if (!tbodyFazendas) return;
    
    tbodyFazendas.innerHTML = '';

    if (fazendas.length === 0) {
      tbodyFazendas.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4">
            <i class="material-symbols-rounded text-muted mb-2" style="font-size: 3rem;">agriculture_off</i>
            <p class="text-muted mb-0">Nenhum local de origem encontrado</p>
          </td>
        </tr>
      `;
      return;
    }

    const isApicultor = usuarioLogado.instituicaoEscolhida.tipoUsuario === "Apicultor";

    fazendas.forEach((fazenda) => {
      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td>
          <div class="d-flex px-2 py-1">
            <div>
              <img src="../assets/img/team-2.jpg" class="avatar avatar-sm me-3 border-radius-lg" alt="${fazenda.nome}">
            </div>
            <div class="d-flex flex-column justify-content-center">
              <h6 class="mb-0 text-sm">${fazenda.nome || 'N/A'}</h6>
              <p class="text-xs text-secondary mb-0">${fazenda.regiao || 'N/A'}</p>
            </div>
          </div>
        </td>
        <td>
          <p class="text-sm font-weight-bold mb-0">${fazenda.cidade || 'N/A'}, ${fazenda.estado || 'N/A'}</p>
          <p class="text-xs text-secondary mb-0">${fazenda.endereco || 'N/A'}</p>
        </td>
        <td class="align-middle text-center text-sm">
          <span class="text-xs font-weight-bold">${fazenda.proprietario || 'N/A'}</span>
        </td>
        <td class="align-middle text-center">
          <span class="badge badge-sm bg-gradient-info">${fazenda.numApiarios || 0}</span>
        </td>
        <td class="align-middle text-center">
          <span class="badge badge-sm ${getStatusBadgeClass(fazenda.status)}">${fazenda.status || 'Ativa'}</span>
        </td>
        <td class="align-middle text-center">
          ${!isApicultor ? `<a href="javascript:;" class="text-secondary font-weight-bold text-xs" onclick="editarFazenda('${fazenda.id}')" data-toggle="tooltip" title="Editar">
            <i class="material-symbols-rounded">edit</i>
          </a>` : ''}
          <a href="javascript:;" class="text-secondary font-weight-bold text-xs ms-2" onclick="visualizarFazenda('${fazenda.id}')" data-toggle="tooltip" title="Visualizar">
            <i class="material-symbols-rounded">visibility</i>
          </a>
          ${!isApicultor ? `<a href="javascript:;" class="text-danger font-weight-bold text-xs ms-2" onclick="removerFazenda('${fazenda.id}')" data-toggle="tooltip" title="Excluir">
            <i class="material-symbols-rounded">delete</i>
          </a>` : ''}
        </td>
      `;

      tbodyFazendas.appendChild(tr);
    });

    // Atualizar contador
    const quantElement = document.getElementById('totalFazendasCount');
    if (quantElement) {
      quantElement.textContent = `${fazendas.length} fazendas`;
    }
  }

  function atualizarEstatisticas() {
    const totalFazendas = fazendas.length;
    const apiariosAtivos = fazendas.reduce((total, fazenda) => total + (fazenda.numApiarios || 0), 0);
    const fazendasAtivas = fazendas.filter(f => f.status === 'Ativa').length;
    const fazendasInativas = fazendas.filter(f => f.status === 'Inativa').length;

    // Atualizar cards (fallback caso a API de count não funcione)
    document.getElementById('totalFazendas').textContent = totalFazendas;
    document.getElementById('apiariosAtivos').textContent = apiariosAtivos;
    document.getElementById('fazendasAtivas').textContent = fazendasAtivas;
    document.getElementById('fazendasInativas').textContent = fazendasInativas;
  }

  // ========== FUNÇÕES AUXILIARES ==========
  function getStatusBadgeClass(status) {
    switch(status?.toLowerCase()) {
      case 'ativa': return 'bg-gradient-success';
      case 'inativa': return 'bg-gradient-danger';
      default: return 'bg-gradient-secondary';
    }
  }

  function preencherFormularioFazenda(fazenda, disabled = false) {
    document.getElementById('fazendaNome').value = fazenda.nome || '';
    document.getElementById('fazendaProprietario').value = fazenda.proprietario || '';
    document.getElementById('fazendaEmail').value = fazenda.email || '';
    document.getElementById('fazendaTelefone').value = fazenda.telefone || '';
    document.getElementById('fazendaEndereco').value = fazenda.endereco || '';
    document.getElementById('fazendaCidade').value = fazenda.cidade || '';
    document.getElementById('fazendaEstado').value = fazenda.estado || '';
    document.getElementById('fazendaRegiao').value = fazenda.regiao || '';
    document.getElementById('fazendaNumApiarios').value = fazenda.numApiarios || '';
    document.getElementById('fazendaStatus').value = fazenda.status || 'Ativa';
    document.getElementById('fazendaObservacoes').value = fazenda.observacoes || '';

    const inputs = fazendasForm.querySelectorAll('input, select, textarea');
    inputs.forEach((el) => {
      el.disabled = disabled;
    });
    
    if (disabled) {
      saveFazendaBtn.style.display = 'none';
      modalTitle.textContent = 'Visualizar Fazenda';
    } else {
      saveFazendaBtn.style.display = 'inline-block';
      modalTitle.textContent = window.editIndex ? 'Editar Fazenda' : 'Nova Fazenda';
    }
  }

  function getDadosFormularioFazenda() {
    return {
      nome: document.getElementById('fazendaNome').value,
      proprietario: document.getElementById('fazendaProprietario').value,
      email: document.getElementById('fazendaEmail').value,
      telefone: document.getElementById('fazendaTelefone').value,
      endereco: document.getElementById('fazendaEndereco').value,
      cidade: document.getElementById('fazendaCidade').value,
      estado: document.getElementById('fazendaEstado').value,
      regiao: document.getElementById('fazendaRegiao').value,
      numApiarios: parseInt(document.getElementById('fazendaNumApiarios').value) || 0,
      status: document.getElementById('fazendaStatus').value,
      observacoes: document.getElementById('fazendaObservacoes').value,
      dataCriacao: new Date().toISOString()
    };
  }

  // ========== EVENT LISTENERS ==========
  saveFazendaBtn.addEventListener('click', async () => {
    if (!checkAuth()) return;
    
    if (!fazendasForm.checkValidity()) {
      fazendasForm.reportValidity();
      return;
    }

    const fazendaData = getDadosFormularioFazenda();
    const user = await getUser();
    fazendaData['idInstituicao'] = user.instituicaoEscolhida.id;

    try {
      if (window.editIndex) {
        await salvarFazenda(fazendaData, window.editIndex);
        showSuccess('Local de origem atualizado com sucesso!', 'Atualização Concluída');
        window.editIndex = null;
      } else {
        await salvarFazenda(fazendaData);
        showSuccess('Local de origem criado com sucesso!', 'Fazenda Salva');
      }

      await carregarFazendas();
      fazendasForm.reset();
      newFazendaModal.hide();
    } catch (error) {
      console.error('Erro ao salvar fazenda:', error);
    }
  });

  // ========== FUNÇÕES GLOBAIS ==========
  async function editarFazenda(id) {
    if (!checkAuth()) return;
    
    try {
      const fazenda = await buscarFazendaPorId(id);
      if (fazenda) {
        window.editIndex = id;
        preencherFormularioFazenda(fazenda, false);
        newFazendaModal.show();
        showInfo('Local de origem carregado para edição', 'Modo Edição');
      }
    } catch (error) {
      console.error('Erro ao editar local de origem:', error);
    }
  }

  async function visualizarFazenda(id) {
    if (!checkAuth()) return;
    
    try {
      const fazenda = await buscarFazendaPorId(id);
      if (fazenda) {
        preencherFormularioFazenda(fazenda, true);
        newFazendaModal.show();
        showInfo('Visualizando dados do local de origem', 'Modo Visualização');
      }
    } catch (error) {
      console.error('Erro ao visualizar local de origem:', error);
    }
  }

  async function removerFazenda(id) {
    if (!checkAuth()) return;
    
    if (confirm("Tem certeza que deseja remover este local de origem?")) {
      try {
        await excluirFazendaAPI(id);
        await carregarFazendas();
        showSuccess('Local de origem removido com sucesso!', 'Exclusão Concluída');
      } catch (error) {
        console.error('Erro ao remover local de origem:', error);
      }
    }
  }

  function abrirModalNovaFazenda() {
    if (!checkAuth()) return;
    
    window.editIndex = null;
    fazendasForm.reset();
    saveFazendaBtn.style.display = 'inline-block';
    modalTitle.textContent = 'Novo Local de Origem';
    newFazendaModal.show();
    showInfo('Preencha os dados do novo local de origem', 'Novo local de origem');
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

    if (todosOcultos || tipoUsuario === "Apicultor") {
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
  document.getElementById('nova-fazenda').style.display = 'none';
  document.getElementById('titulo').innerHTML = 'Locais de Origem Associados';
  document.getElementById('subtitulo').innerHTML = 'Os locais de origem os quais você é associado';
    
  const cardsHeader = document.querySelectorAll('.row .col-xl-3 .card .card-header');
  for (const card of cardsHeader) card.style.display = 'none';

  const cardsFooter = document.querySelectorAll('.card-footer');
  for (const card of cardsFooter) card.style.display = 'none';
}

  // ========== INICIALIZAÇÃO ==========
  async function inicializar() {
    if (checkAuth()) {
      usuarioLogado = await getUser();

      if (usuarioLogado && usuarioLogado.instituicaoEscolhida.tipoUsuario) {
        ocultarItensMenuPorPerfil(usuarioLogado.instituicaoEscolhida.tipoUsuario);
        adaptarLinksParaApicultor(usuarioLogado.instituicaoEscolhida.tipoUsuario, usuarioLogado.id);
      }

      if (!usuarioLogado.isADM && usuarioLogado.instituicaoEscolhida.tipoUsuario === "Apicultor") ocultarFuncoesLaboratorio();

      showInfo('Sistema de locais de origem carregado', 'Bem-vindo');
      configurarFiltrosFazendas();
      if (usuarioLogado.isADM || usuarioLogado.instituicaoEscolhida.tipoUsuario != "Apicultor") await carregarCardsFazendas();
      await carregarFazendas();
      
      // Event listener para o botão de nova fazenda
      const addFazendaBtn = document.querySelector('.btn[data-bs-target="#newFazendaModal"]');
      if (addFazendaBtn) {
        addFazendaBtn.addEventListener('click', abrirModalNovaFazenda);
      }
    }
  }

  // ========== VARIÁVEIS GLOBAIS ==========
  window.editIndex = null;
  window.editarFazenda = editarFazenda;
  window.visualizarFazenda = visualizarFazenda;
  window.removerFazenda = removerFazenda;
  window.mudarPaginaFazendas = mudarPaginaFazendas;
  window.limparFiltros = limparFiltrosFazendas;
  window.closeNotification = closeNotification;

  inicializar();
});