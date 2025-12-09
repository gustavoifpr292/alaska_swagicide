import API_BASE_URL from '../../../chave_api.js'

document.addEventListener('DOMContentLoaded', () => {
  //const API_BASE_URL = 'http://localhost:3000';
  let usuarios = [];
  let pedidosPendentes = [];
  let usuarioLogado = null;
  let editIndex = null;
  let paginacaoAtual = null;

  // Variáveis de estado para filtros e paginação
  let currentPage = 1;
  let currentLimit = 10;
  let currentFilters = {
    search: '',
    status: '',
    tipoUsuario: '',
    fazenda: ''
  };

  let loadingCount = 0;
  let currentLoadingMessage = '';

  // Elementos DOM
  const usuariosForm = document.getElementById('userForm');
  const saveUserBtn = document.getElementById('saveUserBtn');
  const newUserModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('newUserModal'));
  const approveUserModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('approveUserModal'));
  const tbodyUsuarios = document.querySelector('tbody');
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

  // === SISTEMA DE FILTROS ===
  function configurarFiltros() {
    // Filtro de busca
    const searchFilter = document.querySelector('.card-header input[type="text"]');
    if (searchFilter) {
      searchFilter.addEventListener('input', debounce((e) => {
        currentFilters.search = e.target.value;
        currentPage = 1;
        carregarUsuarios(currentPage, currentFilters);
      }, 500));
    }

    // Filtro de perfil
    const tipoUsuarioFilter = document.getElementById('filter-role');
    if (tipoUsuarioFilter) {
      tipoUsuarioFilter.addEventListener('change', (e) => {
        currentFilters.tipoUsuario = e.target.value;
        currentPage = 1;
        carregarUsuarios(currentPage, currentFilters);
      });
    }

    // Filtro de status
    const statusFilter = document.getElementById('filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        currentFilters.status = e.target.value;
        currentPage = 1;
        carregarUsuarios(currentPage, currentFilters);
      });
    }

    // Filtro de fazendas
    const fazendasFilter = document.getElementById('filter-fazendas');
    if (fazendasFilter) {
      fazendasFilter.addEventListener('change', (e) => {
        currentFilters.fazenda = e.target.value;
        currentPage = 1;
        carregarUsuarios(currentPage, currentFilters);
      });
    }

    // Botão limpar filtros
    adicionarBotaoLimparFiltros();
  }

  function adicionarBotaoLimparFiltros() {
    const cardHeader = document.querySelector('.card-header .row');
    if (!cardHeader) return;

    if (document.getElementById('limpar-filtros-usuarios')) return;

    // Encontrar a coluna do botão "Gerenciar Pedidos"
    const colGerenciar = cardHeader.querySelector('.col-md-2.text-end');
    if (!colGerenciar) return;

    const limparBtn = document.createElement('button');
    limparBtn.id = 'limpar-filtros-usuarios';
    limparBtn.className = 'btn btn-outline-secondary mb-0 me-2';
    limparBtn.innerHTML = '<i class="material-symbols-rounded me-1">clear_all</i> Limpar';
    limparBtn.addEventListener('click', limparFiltros);

    colGerenciar.insertBefore(limparBtn, colGerenciar.firstChild);
  }

  function limparFiltros() {
    // Limpar valores dos inputs
    const searchFilter = document.querySelector('.card-header input[type="text"]');
    if (searchFilter) searchFilter.value = '';
    
    document.getElementById('filter-role').value = '';
    document.getElementById('filter-status').value = '';

    // Resetar filtros
    currentFilters = {
      search: '',
      status: '',
      role: '',
      fazenda: ''
    };
    currentPage = 1;

    // Recarregar usuários
    carregarUsuarios();
    showInfo('Filtros limpos', 'Filtros');
  }

  // === SISTEMA DE PAGINAÇÃO ===
  function atualizarPaginacao(paginacao) {
    const paginationContainer = document.querySelector('.pagination');
    if (!paginationContainer || !paginacao) return;

    const { page, pages, total } = paginacao;
    
    let paginationHTML = `
      <li class="page-item ${page === 1 ? 'disabled' : ''}">
        <a class="page-link" href="javascript:;" onclick="mudarPaginaUsuarios(${page - 1})">
          <i class="material-symbols-rounded">chevron_left</i>
        </a>
      </li>
    `;

    // Gerar números de página
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) {
        paginationHTML += `
          <li class="page-item ${i === page ? 'active' : ''}">
            <a class="page-link" href="javascript:;" onclick="mudarPaginaUsuarios(${i})">${i}</a>
          </li>
        `;
      } else if (i === page - 3 || i === page + 3) {
        paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
      }
    }

    paginationHTML += `
      <li class="page-item ${page === pages ? 'disabled' : ''}">
        <a class="page-link" href="javascript:;" onclick="mudarPaginaUsuarios(${page + 1})">
          <i class="material-symbols-rounded">chevron_right</i>
        </a>
      </li>
    `;

    paginationContainer.innerHTML = paginationHTML;
    
    // Atualizar contador
    const quantElement = document.querySelector('.font-weight-bold.ms-1');
    if (quantElement) {
      const start = ((page - 1) * currentLimit) + 1;
      const end = Math.min(page * currentLimit, total);
      quantElement.textContent = `${start}-${end} de ${total} usuários`;
    }
  }

  function mudarPaginaUsuarios(novaPagina) {
    if (!paginacaoAtual) return;
  
    if (novaPagina < 1 || novaPagina > paginacaoAtual.pages) return;
  
    currentPage = novaPagina;
    carregarUsuarios(currentPage, currentFilters);
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

  // ========== FUNÇÕES PARA USUÁRIOS ==========

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

  async function fetchUsuarios(filters = {}, page = 1, limit = 10) {
    if (!checkAuth()) return { usuarios: [], paginacao: {} };
    
    showLoading('Carregando usuários...');
    
    try {
      // Construir query string com filtros
      const queryParams = new URLSearchParams({
        page,
        limit,
        ...filters
      });

      const response = await fetch(`${API_BASE_URL}/usuarios/?${queryParams}`, {
        headers: getAuthHeaders("usuarios")
      });

      if (response.status === 401) {
        handleAuthError();
        return { usuarios: [], paginacao: {} };
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar usuários');
      }
      
      updateLoadingText('Processando dados...');
      const dados = await response.json();
      hideLoading();
      return dados;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Não foi possível carregar os usuários', 'Erro de Conexão');
      return { usuarios: [], paginacao: {} };
    }
  }

  async function salvarUsuario(usuario, id = null) {
    if (!checkAuth()) return;
    
    showLoading(id ? 'Atualizando usuário...' : 'Salvando usuário...');
    
    try {
      const url = id ? `${API_BASE_URL}/usuarios/${id}` : `${API_BASE_URL}/usuarios/`;
      const method = id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: getAuthHeaders("usuarios"),
        body: JSON.stringify(usuario)
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao salvar usuário');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao salvar usuário', 'Erro de Salvamento');
      throw error;
    }
  }

  async function excluirUsuarioAPI(id) {
    if (!checkAuth()) return;
    
    showLoading('Excluindo usuário...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/usuarios/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders('usuarios')
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao excluir usuário');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao excluir usuário', 'Erro de Exclusão');
      throw error;
    }
  }

  async function buscarUsuarioPorId(id) {
    if (!checkAuth()) return null;
    
    showLoading('Carregando usuário...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/usuarios/${id}`, {
        headers: getAuthHeaders('usuarios')
      });
      
      if (response.status === 401) {
        handleAuthError();
        return null;
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar usuário');
      }
      
      const usuario = await response.json();
      hideLoading();
      return usuario;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Erro ao carregar usuário', 'Erro de Carregamento');
      return null;
    }
  }

  // ========== FUNÇÕES PARA INSTITUIÇÕES ==========

  async function fetchInstituicoes() {
    if (!checkAuth()) return [];
    
    showLoading('Carregando instituições...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/instituicoes/`, {
        headers: getAuthHeaders("instituicoes")
      });
      
      if (response.status === 401) {
        handleAuthError();
        return [];
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar instituições');
      }
      
      const dados = await response.json();
      hideLoading();
      return dados.instituicoes;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Não foi possível carregar as instituições', 'Erro de Conexão');
      return [];
    }
  }

  async function buscarInstituicaoPorId(id) {
    if (!checkAuth()) return null;
    
    showLoading('Carregando instituição...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/instituicoes/${id}`, {
        headers: getAuthHeaders("instituicoes")
      });
      
      if (response.status === 401) {
        handleAuthError();
        return null;
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar instituição');
      }
      
      const instituicao = await response.json();
      hideLoading();
      return instituicao;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Erro ao carregar instituição', 'Erro de Carregamento');
      return null;
    }
  }

  async function associarUsuarioInstituicaoAPI(idUsuario, idInstituicao, tipoUsuario) {
    if (!checkAuth()) return;
    
    showLoading('Associando instituição...');
    
    try {
      const queryParams = new URLSearchParams({
        tipoUsuario
      });

      const response = await fetch(`${API_BASE_URL}/usuarios/${idUsuario}/instituicoes/associar/${idInstituicao}/?${queryParams}`, {
        method: 'POST',
        headers: getAuthHeaders("usuarios")
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao associar instituição');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao associar instituição', 'Erro de Associação');
      throw error;
    }
  }

  async function desassociarUsuarioInstituicaoAPI(idUsuario, idInstituicao) {
    if (!checkAuth()) return;
    
    showLoading('Desassociando instituição...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/usuarios/${idUsuario}/instituicoes/desassociar/${idInstituicao}`, {
        method: 'POST',
        headers: getAuthHeaders("usuarios")
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao desassociar instituição');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao desassociar instituição', 'Erro de Desassociação');
      throw error;
    }
  }

  // ========== FUNÇÕES PARA FAZENDAS ==========

  async function fetchFazendas() {
    if (!checkAuth()) return [];
    
    showLoading('Carregando locais de origem...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/fazendas/`, {
        headers: {noPages: 1, ...getAuthHeaders("fazendas")}
      });
      
      if (response.status === 401) {
        handleAuthError();
        return [];
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar locais de origem');
      }
      
      const dados = await response.json();
      hideLoading();
      return dados.fazendas;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Não foi possível carregar as locais de origem', 'Erro de Conexão');
      return [];
    }
  }

  async function associarApicultorFazendaAPI(idApicultor, idFazenda) {
    if (!checkAuth()) return;
    
    showLoading('Associando local de origem...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/usuarios/${idApicultor}/fazendas/associar/${idFazenda}`, {
        method: 'POST',
        headers: getAuthHeaders("usuarios")
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao associar local de origem');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao associar local de origem', 'Erro de Associação');
      throw error;
    }
  }

  async function desassociarApicultorFazendaAPI(idApicultor, idFazenda) {
    if (!checkAuth()) return;
    
    showLoading('Desassociando local de origem...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/usuarios/${idApicultor}/fazendas/desassociar/${idFazenda}`, {
        method: 'POST',
        headers: getAuthHeaders("usuarios")
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao desassociar local de origem');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao desassociar local de origem', 'Erro de Desassociação');
      throw error;
    }
  }

  // ========== FUNÇÕES PARA PEDIDOS EXTERNOS ==========

  async function fetchPedidosPendentes() {
    if (!checkAuth()) return [];
    
    showLoading('Carregando pedidos pendentes...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/pedidos/`, {
        headers: getAuthHeaders("usuarios")
      });
      
      if (response.status === 401) {
        handleAuthError();
        return [];
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar pedidos pendentes');
      }
      
      updateLoadingText('Processando dados...');
      const dados = await response.json();
      hideLoading();
      return dados;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Não foi possível carregar os pedidos pendentes', 'Erro de Conexão');
      return [];
    }
  }

  async function aprovarPedidoAPI(id, justificativa = '') {
    if (!checkAuth()) return;
    
    showLoading('Aprovando pedido...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/pedidos/aprovar/${id}`, {
        method: 'POST',
        headers: getAuthHeaders('pedidosCadastro'),
        body: JSON.stringify({ justificativa })
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao aprovar pedido');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao aprovar pedido', 'Erro de Aprovação');
      throw error;
    }
  }

  async function reprovarPedidoAPI(id, justificativa = '') {
    if (!checkAuth()) return;
    
    showLoading('Reprovando pedido...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/pedidos/reprovar/${id}`, {
        method: 'POST',
        headers: getAuthHeaders('pedidosCadastro'),
        body: JSON.stringify({ justificativa })
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao reprovar pedido');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao reprovar pedido', 'Erro de Reprovação');
      throw error;
    }
  }

  // ========== FUNÇÕES DE CARREGAMENTO E RENDERIZAÇÃO ==========

  async function carregarFazendasFiltro() {
    const fazendaSelect = document.getElementById('filter-fazendas');
    if (!fazendaSelect) return;
    
    showLoading('Carregando locais de origem...');
    
    try {
      const fazendas = await fetchFazendas();
      
      // Limpar options existentes (exceto a primeira)
      while (fazendaSelect.options.length > 1) {
        fazendaSelect.remove(1);
      }
      
      // Adicionar produtores ao dropdown
      fazendas.forEach(fazenda => {
        const option = document.createElement('option');
        option.value = fazenda.id;
        option.textContent = `${fazenda.nome || `Fazenda ${fazenda.id}`} - ${fazenda.cidade}, ${fazenda.estado}`;
        fazendaSelect.appendChild(option);
      });
      
      // Se não houver produtores, mostrar mensagem
      if (fazendas.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "Nenhuma fazenda cadastrada";
        option.disabled = true;
        fazendaSelect.appendChild(option);
      }
      
      hideLoading();
      
    } catch (error) {
      console.error('Erro ao carregar produtores:', error);
      hideLoading();
      showError('Erro ao carregar lista de produtores', 'Erro de Carregamento');
    }
  }

  async function carregarUsuarios(page = 1, filters = currentFilters) {
    if (!checkAuth()) return;
    
    try {
      const resultado = await fetchUsuarios(filters, page, currentLimit);
      usuarios = resultado.usuarios || [];
      renderizarUsuarios();
      paginacaoAtual = resultado.paginacao; 
      atualizarPaginacao(resultado.paginacao);
      atualizarEstatisticas();
      
      if (usuarios.length > 0) {
        showSuccess(`${resultado.paginacao?.total || usuarios.length} usuários carregados com sucesso!`, 'Dados Carregados');
      } else {
        showWarning('Nenhum usuário encontrado com os filtros aplicados', 'Sem Dados');
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  }

  async function carregarCardsUsuarios() {
    if (!checkAuth()) return;
    
    showLoading('Carregando estatísticas...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/usuarios/count`, {
        headers: getAuthHeaders("usuarios"),
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
    // Atualizar cards com os totais
    const cards = document.querySelectorAll('.card-header h4');
    if (cards.length >= 4) {
      cards[0].textContent = totais.total || '0';
      cards[1].textContent = totais.administradores || '0';
      cards[2].textContent = totais.pesquisadores || '0';
      cards[3].textContent = totais.coordenadores || '0';
    }
  }

  function atualizarEstatisticas() {
    // Função mantida para compatibilidade
  }

  async function carregarPedidosPendentes() {
    if (!checkAuth()) return;
    
    try {
      pedidosPendentes = await fetchPedidosPendentes();
      renderizarPedidosPendentes();
      
      if (pedidosPendentes.length > 0) {
        showInfo(`${pedidosPendentes.length} pedidos pendentes carregados`, 'Pedidos Carregados');
      } else {
        showSuccess('Nenhum pedido pendente encontrado', 'Tudo em Dia!');
      }
    } catch (error) {
      console.error('Erro ao carregar pedidos pendentes:', error);
    }
  }

  // === FUNÇÕES AUXILIARES PARA ESTILOS ===

  function getStatusBadgeClass(status) {
    switch(status?.toLowerCase()) {
      case 'ativo': return 'bg-gradient-success';
      case 'pendente': return 'bg-gradient-warning';
      case 'inativo': return 'bg-gradient-danger';
      default: return 'bg-gradient-secondary';
    }
  }

  function getTipoUsuarioBadgeClass(tipoUsuario) {
    switch(tipoUsuario?.toLowerCase()) {
      case 'coordenador': return 'bg-gradient-warning';
      case 'pesquisador': return 'bg-gradient-info';
      case 'produtor': return 'bg-gradient-success';
      case 'administrador': return 'bg-gradient-primary';
      default: return 'bg-gradient-secondary';
    }
  }

  function formatarData(dataString) {
    if (!dataString) return '';
    
    try {
      const date = new Date(dataString);
      return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return dataString;
    }
  }

  function formatarDataTimestamp(data) {
    if (!data) return 'Não informado';
    
    try {
      const milliseconds = data.seconds * 1000;

      const nanosecondsInMilliseconds = data.nanoseconds / 1000000;

      const totalMilliseconds = milliseconds + nanosecondsInMilliseconds;

      const date = new Date(totalMilliseconds);
      return date.toLocaleString('pt-BR');
    } catch (error) {
      console.error('Erro ao formatar data/hora:', error);
      return data;
    }
  }

  // === FUNÇÕES DE RENDERIZAÇÃO PARA INSTITUIÇÕES ===

  function renderizarInstituicoesUsuario(instituicoes) {
    if (!instituicoes || instituicoes.length === 0) {
      return '<span class="text-muted">Nenhuma instituição associada</span>';
    }
    
    const { instituicaoEscolhida } = usuarioLogado;

    if (usuarioLogado.isADM) {
      return instituicoes.map(instituicao => `
        <div class="d-flex flex-column mb-1">
          <span class="badge badge-sm bg-gradient-info me-1 mb-1" title="${instituicao.cidade}, ${instituicao.estado}">
            ${instituicao.nome}
          </span>
          <small class="text-xs text-muted">${trocaUsuario(instituicao.tipoUsuario) || 'N/A'}</small>
        </div>
      `).join('');
    } else {
      return `
        <div class="d-flex flex-column mb-1">
          <span class="badge badge-sm bg-gradient-info me-1 mb-1" title="${instituicaoEscolhida.cidade}, ${instituicaoEscolhida.estado}">
            ${instituicaoEscolhida.nome}
          </span>
        </div>
      `;
    }
  }

  function renderizarFazendasUsuario(fazendas) {
    if (!fazendas || fazendas.length === 0) {
      return '<span class="text-muted">Nenhum local de origem associado</span>';
    }

    return fazendas.map(fazenda => `
      <span class="badge badge-sm bg-gradient-info me-1 mb-1" title="${fazenda.cidade}, ${fazenda.estado}">
        ${fazenda.nome}
        ${fazenda.status === 'Inativa' ? ' (Inativa)' : ''}
      </span>
    `).join('');
  }

  function renderizarUsuarios() {
    if (!tbodyUsuarios) return;
    
    tbodyUsuarios.innerHTML = '';

    if (usuarios.length === 0) {
      tbodyUsuarios.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4">
            <i class="material-symbols-rounded text-muted mb-2" style="font-size: 3rem;">group_off</i>
            <p class="text-muted mb-0">Nenhum usuário encontrado</p>
          </td>
        </tr>
      `;
      return;
    }

    usuarios.forEach((usuario) => {
      const tr = document.createElement('tr');
      
      // Verificar se é apicultor para mostrar fazendas
      const isApicultor = usuario.instituicoes.find(instituicao => instituicao.id === usuarioLogado.instituicaoEscolhida.id).tipoUsuario === 'Apicultor';
      const isClientADM = usuarioLogado.isADM;
      const isUserADM = usuario.isADM;
      const fazendasHTML = isApicultor ? renderizarFazendasUsuario(usuario.fazendas) : '-';
      let tipoUsuario = usuario.instituicoes.find(instituicao => instituicao.id === usuarioLogado.instituicaoEscolhida.id).tipoUsuario;

      // Mostrar instituição para todos os usuários
      const instituicaoHTML = renderizarInstituicoesUsuario(usuario.instituicoes);

      tr.innerHTML = `
        <td>
          <div class="d-flex px-2 py-1">
            <div>
              <img src="../assets/img/team-2.jpg" class="avatar avatar-sm me-3 border-radius-lg" alt="${usuario.nome}">
            </div>
            <div class="d-flex flex-column justify-content-center">
              <h6 class="mb-0 text-sm">${usuario.nome || 'N/A'}</h6>
              <p class="text-xs text-secondary mb-0">${usuario.username || 'N/A'}</p>
              ${isApicultor ? '<p class="text-xs text-info mb-0"><i class="material-symbols-rounded" style="font-size: 12px;">agriculture</i> Apicultor</p>' : ''}
            </div>
          </div>
        </td>
        <td>
          <p class="text-sm font-weight-bold mb-0">${usuario.email || 'N/A'}</p>
        </td>
        <td class="align-middle text-center text-sm">
          <span class="text-xs font-weight-bold">${trocaUsuario(tipoUsuario) || 'N/A'}</span>
        </td>
        <td class="align-middle text-center">
          <span class="badge badge-sm ${getStatusBadgeClass(usuario.status)}">${usuario.status || 'Ativo'}</span>
        </td>
        <td class="align-middle">
          <div class="text-center">
            ${instituicaoHTML}
          </div>
        </td>
        <td class="align-middle">
          <div class="text-center">
            ${fazendasHTML}
          </div>
        </td>
        <td class="align-middle text-center">
          <span class="text-secondary text-xs font-weight-bold">${formatarDataTimestamp(usuario.ultimoAcesso) || '-'}</span>
        </td>
        <td class="align-middle text-center">
          ${!isUserADM ? `<a href="javascript:;" class="text-secondary font-weight-bold text-xs" onclick="editarUsuario('${usuario.id}')" data-toggle="tooltip" title="Editar">
            <i class="material-symbols-rounded">edit</i>
          </a>` : ''}
          <a href="javascript:;" class="text-secondary font-weight-bold text-xs ms-2" onclick="visualizarUsuario('${usuario.id}')" data-toggle="tooltip" title="Visualizar">
            <i class="material-symbols-rounded">visibility</i>
          </a>
          ${isClientADM ? `<a href="javascript:;" class="text-primary font-weight-bold text-xs ms-2" onclick="gerenciarInstituicaoUsuario('${usuario.id}')" data-toggle="tooltip" title="Gerenciar Instituições">
            <i class="material-symbols-rounded">business</i>
          </a>` : ''}
          ${isApicultor ? `
            <a href="javascript:;" class="text-info font-weight-bold text-xs ms-2" onclick="gerenciarFazendasUsuario('${usuario.id}')" data-toggle="tooltip" title="Gerenciar Locais de Origem">
              <i class="material-symbols-rounded">agriculture</i>
            </a>
          ` : ''}
          ${!isUserADM && usuario.id != usuarioLogado.id ? `<a href="javascript:;" class="text-danger font-weight-bold text-xs ms-2" onclick="removerUsuario('${usuario.id}')" data-toggle="tooltip" title="Excluir">
            <i class="material-symbols-rounded">delete</i>
          </a>` : ''}
        </td>
      `;

      tbodyUsuarios.appendChild(tr);
    });
  }

  function renderizarPedidosPendentes() {
    const tbodyPedidos = document.querySelector('#approveUserModal tbody');
    if (!tbodyPedidos) return;
    
    tbodyPedidos.innerHTML = '';

    if (pedidosPendentes.length === 0) {
      tbodyPedidos.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4">
            <i class="material-symbols-rounded text-muted mb-2" style="font-size: 3rem;">checklist</i>
            <p class="text-muted mb-0">Nenhum pedido pendente</p>
          </td>
        </tr>
      `;
      return;
    }

    pedidosPendentes.forEach((pedido) => {
      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td>
          <div class="d-flex px-2 py-1">
            <div class="d-flex flex-column justify-content-center">
              <h6 class="mb-0 text-sm">${pedido.id}</h6>
            </div>
          </div>
        </td>
        <td>
          <p class="text-sm font-weight-bold mb-0">${pedido.username || 'N/A'}</p>
          <p class="text-xs text-secondary mb-0">${pedido.email || 'N/A'}</p>
        </td>
        <td class="align-middle text-sm">
          <span class="badge badge-sm bg-gradient-info">${pedido.tipoUsuario || pedido.perfil || 'N/A'}</span>
        </td>
        <td class="align-middle">
          <span class="text-secondary text-xs font-weight-bold">${formatarData(pedido.dataSolicitacao) || 'N/A'}</span>
        </td>
        <td class="align-middle">
          <button class="btn btn-sm bg-gradient-success mb-0 me-1 approve-btn" data-request="${pedido.id}" data-toggle="tooltip" title="Aprovar">
            <i class="material-symbols-rounded fs-6">check</i>
          </button>
          <button class="btn btn-sm bg-gradient-danger mb-0 reject-btn" data-request="${pedido.id}" data-toggle="tooltip" title="Rejeitar">
            <i class="material-symbols-rounded fs-6">close</i>
          </button>
        </td>
      `;

      tbodyPedidos.appendChild(tr);
    });

    // Adicionar event listeners aos novos botões
    adicionarEventListenersPedidos();
  }

  function adicionarEventListenersPedidos() {
    document.querySelectorAll('.approve-btn, .reject-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const requestId = this.getAttribute('data-request');
        const pedido = pedidosPendentes.find(p => p.id === requestId);
        
        if (pedido) {
          mostrarDetalhesPedido(pedido, this.classList.contains('approve-btn'));
        }
      });
    });
  }

  function mostrarDetalhesPedido(pedido, isAprovar) {
    document.getElementById('requestId').textContent = pedido.id;
    document.getElementById('detailName').textContent = pedido.nome || pedido.username || 'N/A';
    document.getElementById('detailCpf').textContent = pedido.cpf || 'N/A';
    document.getElementById('detailEmail').textContent = pedido.email || 'N/A';
    document.getElementById('detailProfile').textContent = trocaUsuario(pedido.tipoUsuario) || 'N/A';
    document.getElementById('detailLab').textContent = usuarioLogado.instituicaoEscolhida.nome || 'N/A';
    document.getElementById('detailDate').textContent = formatarData(pedido.dataSolicitacao) || 'N/A';
    
    // Mostrar card de detalhes
    document.getElementById('requestDetailCard').classList.remove('d-none');
    
    // Configurar botões de confirmação
    if (isAprovar) {
      document.getElementById('confirmApproveBtn').classList.remove('d-none');
      document.getElementById('confirmRejectBtn').classList.add('d-none');
      document.getElementById('confirmApproveBtn').setAttribute('data-request', pedido.id);
      showInfo('Revise os dados antes de aprovar', 'Confirmação de Aprovação');
    } else {
      document.getElementById('confirmApproveBtn').classList.add('d-none');
      document.getElementById('confirmRejectBtn').classList.remove('d-none');
      document.getElementById('confirmRejectBtn').setAttribute('data-request', pedido.id);
      showWarning('Informe a justificativa para rejeição', 'Confirmação de Rejeição');
    }
  }

  // ========== FUNÇÕES PARA USUÁRIOS (CRUD) ==========

  function preencherFormularioUsuario(usuario, disabled = false) {
    const inputs = usuariosForm.querySelectorAll('input, select, textarea');
    document.getElementById('userName').value = usuario.nome || '';
    document.getElementById('userEmail').value = usuario.email || '';
    document.getElementById('userType').value = usuario.instituicoes.find(instituicao => instituicao.id === usuarioLogado.instituicaoEscolhida.id).tipoUsuario || '';
    document.getElementById('userStatus').value = usuario.status || 'Ativo';
    
    document.getElementById('userName').disabled = disabled;
    
    inputs.forEach((el) => {
      el.disabled = disabled;
    });
    
    if (disabled) {
      saveUserBtn.style.display = 'none';
    } else {
      saveUserBtn.style.display = 'inline-block';
    }
  }

  function getDadosFormularioUsuario() {
    return {
      nome: document.getElementById('userName').value,
      email: document.getElementById('userEmail').value,
      tipoUsuario: document.getElementById('userType').value,
      status: document.getElementById('userStatus').value,
      dataCriacao: new Date().toISOString()
    };
  }

  function trocaUsuario(tipoUsuario) {
    if (tipoUsuario === 'Apicultor') return "Produtor";
    else if (tipoUsuario === 'Pesquisador') return "Analista";

    return tipoUsuario;
  }

  // ========== MODAL PARA GERENCIAR INSTITUIÇÕES ==========

  function mostrarModalGerenciarInstituicoes(usuario, todasInstituicoes) {
    // Remover modal anterior se existir
    const modalAntigo = document.getElementById('gerenciarInstituicoesModal');
    if (modalAntigo) {
      modalAntigo.remove();
    }

    // Criar HTML do modal atualizado
    const modalHtml = `
      <div class="modal fade" id="gerenciarInstituicoesModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-gradient-primary text-white">
              <h5 class="modal-title">
                <i class="material-symbols-rounded me-2">business</i>
                Gerenciar Instituições - ${usuario.nome}
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row">
                <div class="col-md-6">
                  <h6 class="text-sm font-weight-bolder mb-3">Instituições Associadas</h6>
                  <div id="instituicoesAssociadasList" class="instituicoes-list">
                    ${usuario.instituicoes && usuario.instituicoes.length > 0 ? 
                      usuario.instituicoes.map(inst => `
                        <div class="instituicao-item d-flex justify-content-between align-items-center mb-2 p-2 border rounded" id="instituicao-item-${inst.id}">
                          <div>
                            <strong>${inst.nome}</strong>
                            <br>
                            <small class="text-muted">${inst.cidade}, ${inst.estado}</small>
                            <br>
                            <small class="badge badge-sm ${getTipoUsuarioBadgeClass(inst.tipoUsuario)}">${trocaUsuario(inst.tipoUsuario) || 'N/A'}</small>
                            ${inst.status === 'Inativa' ? '<br><small class="text-warning">(Inativa)</small>' : ''}
                          </div>
                          <button class="btn btn-sm btn-outline-danger" onclick="desassociarInstituicao('${usuario.id}', '${inst.id}')">
                            <i class="material-symbols-rounded" style="font-size: 16px;">link_off</i>
                          </button>
                        </div>
                      `).join('') : 
                      '<p class="text-muted">Nenhuma instituição associada</p>'
                    }
                  </div>
                </div>
                <div class="col-md-6">
                  <h6 class="text-sm font-weight-bolder mb-3">Adicionar Instituição</h6>
                  <div class="mb-3">
                    <label class="form-label">Selecionar Instituição</label>
                    <select class="form-control" id="selectInstituicaoDisponivel">
                      <option value="">Selecione uma instituição...</option>
                      ${todasInstituicoes.map(instituicao => {
                        const jaAssociada = usuario.instituicoes && usuario.instituicoes.some(inst => inst.id === instituicao.id);
                        const isInativa = instituicao.status === 'Inativa';
                        return `
                          <option value="${instituicao.id}" ${jaAssociada || isInativa ? 'disabled' : ''}>
                            ${instituicao.nome} - ${instituicao.cidade}, ${instituicao.estado}
                            ${jaAssociada ? ' (Já associada)' : ''}
                          </option>
                        `;
                      }).join('')}
                    </select>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Tipo de Usuário na Instituição *</label>
                    <select class="form-control" id="selectTipoUsuarioInstituicao">
                      <option value="">Selecione o tipo...</option>
                      <option value="Pesquisador">Analista</option>
                      <option value="Coordenador">Coordenador</option>
                      <option value="Produtor">Produtor</option>
                      <option value="Administrador">Administrador</option>
                    </select>
                  </div>
                  <button class="btn btn-primary w-100" onclick="associarInstituicao('${usuario.id}')">
                    <i class="material-symbols-rounded me-1">add</i> Associar Instituição
                  </button>
                  <div class="text-center mt-2">
                    <small class="text-muted">Instituições desabilitadas já estão associadas ou estão inativas</small>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Adicionar modal ao DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('gerenciarInstituicoesModal'));
    modal.show();

    // Adicionar event listener para quando o modal fechar
    document.getElementById('gerenciarInstituicoesModal').addEventListener('hidden.bs.modal', function () {
      setTimeout(() => {
        const modal = document.getElementById('gerenciarInstituicoesModal');
        if (modal) {
          modal.remove();
        }
      }, 300);
    });
  }

  // ========== FUNÇÕES DE ASSOCIAÇÃO/DESASSOCIAÇÃO DE INSTITUIÇÕES ==========

  async function gerenciarInstituicaoUsuario(idUsuario) {
    if (!checkAuth()) return;
    
    try {
      // Limpar modal anterior se existir
      limparModalGerenciarInstituicao();

      // Buscar usuário
      const usuario = await buscarUsuarioPorId(idUsuario);
      if (!usuario) {
        showError('Usuário não encontrado', 'Erro');
        return;
      }

      // Buscar todas as instituições disponíveis
      showLoading('Carregando instituições...');
      const todasInstituicoes = await fetchInstituicoes();
      hideLoading();

      // Mostrar modal de gerenciamento
      mostrarModalGerenciarInstituicoes(usuario, todasInstituicoes);
      
    } catch (error) {
      console.error('Erro ao gerenciar instituições:', error);
      hideLoading();
      showError('Erro ao carregar dados das instituições', 'Erro de Carregamento');
    }
  }

  async function associarInstituicao(idUsuario) {
    const selectInstituicao = document.getElementById('selectInstituicaoDisponivel');
    const selectTipoUsuario = document.getElementById('selectTipoUsuarioInstituicao');
    const idInstituicao = selectInstituicao.value;
    const tipoUsuario = selectTipoUsuario.value;
    
    if (!idInstituicao) {
      showWarning('Selecione uma instituição', 'Seleção Necessária');
      return;
    }

    if (!tipoUsuario) {
      showWarning('Selecione o tipo de usuário para esta instituição', 'Tipo de Usuário Obrigatório');
      return;
    }

    try {
      showLoading('Associando instituição...');
      await associarUsuarioInstituicaoAPI(idUsuario, idInstituicao, tipoUsuario);

      // Buscar dados da instituição para atualizar a UI
      const instituicao = await buscarInstituicaoPorId(idInstituicao);

      // Atualizar a lista de instituições associadas
      const instituicoesList = document.getElementById('instituicoesAssociadasList');
      
      // Se estava vazio, limpar a mensagem
      if (instituicoesList.innerHTML.includes('Nenhuma instituição associada')) {
        instituicoesList.innerHTML = '';
      }

      // Adicionar nova instituição à lista
      const novaInstituicaoHtml = `
        <div class="instituicao-item d-flex justify-content-between align-items-center mb-2 p-2 border rounded" id="instituicao-item-${instituicao.id}">
          <div>
            <strong>${instituicao.nome}</strong>
            <br>
            <small class="text-muted">${instituicao.cidade || ''}, ${instituicao.estado || ''}</small>
            <br>
            <small class="badge badge-sm ${getTipoUsuarioBadgeClass(tipoUsuario)}">${trocaUsuario(tipoUsuario)}</small>
            ${instituicao.status === 'Inativa' ? '<br><small class="text-warning">(Inativa)</small>' : ''}
          </div>
          <button class="btn btn-sm btn-outline-danger" onclick="desassociarInstituicao('${idUsuario}', '${instituicao.id}')">
            <i class="material-symbols-rounded" style="font-size: 16px;">link_off</i>
          </button>
        </div>
      `;

      instituicoesList.innerHTML += novaInstituicaoHtml;

      // Atualizar o select (desabilitar a opção selecionada)
      const option = selectInstituicao.querySelector(`option[value="${idInstituicao}"]`);
      if (option) {
        option.disabled = true;
        option.textContent += ' (Já associada)';
      }

      // Limpar seleções
      selectInstituicao.value = '';
      selectTipoUsuario.value = '';
      
      await carregarUsuarios();
      hideLoading();
      showSuccess('Instituição associada com sucesso!', 'Associação Concluída');
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Erro ao associar instituição', 'Erro de Associação');
    }
  }

  async function desassociarInstituicao(idUsuario, idInstituicao) {
    if (!confirm('Tem certeza que deseja desassociar esta instituição?')) return;

    try {
      showLoading('Desassociando instituição...');
      await desassociarUsuarioInstituicaoAPI(idUsuario, idInstituicao);

      // Atualizar a UI imediatamente
      const instituicaoItem = document.getElementById(`instituicao-item-${idInstituicao}`);
      if (instituicaoItem) {
        instituicaoItem.remove();
      }

      // Atualizar o select para permitir reassociação
      const select = document.getElementById('selectInstituicaoDisponivel');
      const option = select.querySelector(`option[value="${idInstituicao}"]`);
      if (option) {
        option.disabled = false;
        option.textContent = option.textContent.replace(' (Já associada)', '');
      }

      // Verificar se não há mais instituições associadas
      const instituicoesList = document.getElementById('instituicoesAssociadasList');
      const instituicoesItems = instituicoesList.querySelectorAll('.instituicao-item');
      if (instituicoesItems.length === 0) {
        instituicoesList.innerHTML = '<p class="text-muted">Nenhuma instituição associada</p>';
      }
      
      await carregarUsuarios();
      hideLoading();
      showSuccess('Instituição desassociada com sucesso!', 'Desassociação Concluída');
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Erro ao desassociar instituição', 'Erro de Desassociação');
    }
  }

  function limparModalGerenciarInstituicao() {
    const modal = document.getElementById('gerenciarInstituicaoModal');
    if (modal) {
      const bsModal = bootstrap.Modal.getInstance(modal);
      if (bsModal) {
        bsModal.hide();
      }
      setTimeout(() => {
        modal.remove();
      }, 300);
    }
  }

  // ========== MODAL PARA GERENCIAR FAZENDAS ==========

  function mostrarModalGerenciarFazendas(usuario, todasFazendas) {
    // Remover modal anterior se existir
    const modalAntigo = document.getElementById('gerenciarFazendasModal');
    if (modalAntigo) {
      modalAntigo.remove();
    }

    // Criar HTML do modal
    const modalHtml = `
      <div class="modal fade" id="gerenciarFazendasModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-gradient-info text-white">
              <h5 class="modal-title">
                <i class="material-symbols-rounded me-2">agriculture</i>
                Gerenciar Locais de Origem - ${usuario.nome}
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row">
                <div class="col-md-6">
                  <h6 class="text-sm font-weight-bolder mb-3">Locais de Origem Associados</h6>
                  <div id="fazendasAssociadasList" class="fazendas-list">
                    ${usuario.fazendas && usuario.fazendas.length > 0 ? 
                      usuario.fazendas.map(f => `
                        <div class="fazenda-item d-flex justify-content-between align-items-center mb-2 p-2 border rounded" id="fazenda-item-${f.id}">
                          <div>
                            <strong>${f.nome}</strong>
                            <br>
                            <small class="text-muted">${f.cidade}, ${f.estado}</small>
                            ${f.status === 'Inativa' ? '<br><small class="text-warning">(Inativa)</small>' : ''}
                          </div>
                          <button class="btn btn-sm btn-outline-danger" onclick="desassociarFazenda('${usuario.id}', '${f.id}')">
                            <i class="material-symbols-rounded" style="font-size: 16px;">link_off</i>
                          </button>
                        </div>
                      `).join('') : 
                      '<p class="text-muted">Nenhum local de origem associado</p>'
                    }
                  </div>
                </div>
                <div class="col-md-6">
                  <h6 class="text-sm font-weight-bolder mb-3">Adicionar Local de Origem</h6>
                  <div class="input-group mb-3">
                    <select class="form-control" id="selectFazendaDisponivel">
                      <option value="">Selecione um local de origem...</option>
                      ${todasFazendas.map(fazenda => {
                        // Verificar se a fazenda já está associada
                        const jaAssociada = usuario.fazendas && usuario.fazendas.some(f => f.id === fazenda.id);
                        const isInativa = fazenda.status === 'Inativa';
                        return `
                          <option value="${fazenda.id}" ${jaAssociada || isInativa ? 'disabled' : ''}>
                            ${fazenda.nome} - ${fazenda.cidade}, ${fazenda.estado}
                            ${jaAssociada ? ' (Já associada)' : ''}
                          </option>
                        `;
                      }).join('')}
                    </select>
                    <button class="btn btn-primary" onclick="associarFazenda('${usuario.id}')">
                      <i class="material-symbols-rounded">add</i>
                    </button>
                  </div>
                  <div class="text-center">
                    <small class="text-muted">Locais de origem desabilitados já estão associadas ou estão inativos</small>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Adicionar modal ao DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('gerenciarFazendasModal'));
    modal.show();

    // Adicionar event listener para quando o modal fechar
    document.getElementById('gerenciarFazendasModal').addEventListener('hidden.bs.modal', function () {
      setTimeout(() => {
        const modal = document.getElementById('gerenciarFazendasModal');
        if (modal) {
          modal.remove();
        }
      }, 300);
    });
  }

  async function gerenciarFazendasUsuario(idUsuario) {
    if (!checkAuth()) return;
    
    try {
      // Limpar modal anterior se existir
      limparModalGerenciarFazendas();

      // Buscar usuário
      const usuario = await buscarUsuarioPorId(idUsuario);
      const tipoUsuario = usuario.instituicoes.find((instituicao) => instituicao.id == usuarioLogado.instituicaoEscolhida.id).tipoUsuario;
      if (!usuario || tipoUsuario !== 'Apicultor') {
        showWarning('Este usuário não é um produtor', 'Ação não disponível');
        return;
      }

      // Buscar todas as fazendas disponíveis
      showLoading('Carregando locais de origem...');
      const todasFazendas = await fetchFazendas();
      hideLoading();

      // Mostrar modal de gerenciamento
      mostrarModalGerenciarFazendas(usuario, todasFazendas);
      
    } catch (error) {
      console.error('Erro ao gerenciar locais de origem:', error);
      hideLoading();
      showError('Erro ao carregar dados dos locais de origem', 'Erro de Carregamento');
    }
  }

  async function associarFazenda(idUsuario) {
    const select = document.getElementById('selectFazendaDisponivel');
    const idFazenda = select.value;
    
    if (!idFazenda) {
      showWarning('Selecione um local de origem', 'Seleção Necessária');
      return;
    }

    try {
      showLoading('Associando local de origem...');
      await associarApicultorFazendaAPI(idUsuario, idFazenda);

      // Buscar dados da fazenda para atualizar a UI
      const fazendaResponse = await fetch(`${API_BASE_URL}/fazendas/${idFazenda}`, {
        headers: getAuthHeaders("fazendas")
      });

      if (!fazendaResponse.ok) throw new Error('Erro ao buscar dados do local de origem');

      const fazenda = await fazendaResponse.json();

      // Atualizar a lista de fazendas associadas
      const fazendasList = document.getElementById('fazendasAssociadasList');
      
      // Se estava vazio, limpar a mensagem
      if (fazendasList.innerHTML.includes('Nenhum local de origem associado')) {
        fazendasList.innerHTML = '';
      }

      // Adicionar nova fazenda à lista
      const novaFazendaHtml = `
        <div class="fazenda-item d-flex justify-content-between align-items-center mb-2 p-2 border rounded" id="fazenda-item-${fazenda.id}">
          <div>
            <strong>${fazenda.nome}</strong>
            <br>
            <small class="text-muted">${fazenda.cidade}, ${fazenda.estado}</small>
            ${fazenda.status === 'Inativa' ? '<br><small class="text-warning">(Inativa)</small>' : ''}
          </div>
          <button class="btn btn-sm btn-outline-danger" onclick="desassociarFazenda('${idUsuario}', '${fazenda.id}')">
            <i class="material-symbols-rounded" style="font-size: 16px;">link_off</i>
          </button>
        </div>
      `;

      fazendasList.insertAdjacentHTML('beforeend', novaFazendaHtml);

      // Atualizar o select (desabilitar a opção selecionada)
      const option = select.querySelector(`option[value="${idFazenda}"]`);
      if (option) {
        option.disabled = true;
        option.textContent += ' (Já associada)';
      }

      // Limpar seleção
      select.value = '';
      
      await carregarUsuarios();
      hideLoading();
      showSuccess('Local de origem associado com sucesso!', 'Associação Concluída');
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Erro ao associar local de origem', 'Erro de Associação');
    }
  }

  async function desassociarFazenda(idUsuario, idFazenda) {
    if (!confirm('Tem certeza que deseja desassociar este local de origem?')) return;

    try {
      showLoading('Desassociando local de origem...');
      await desassociarApicultorFazendaAPI(idUsuario, idFazenda);

      // Atualizar a UI imediatamente
      const fazendaItem = document.getElementById(`fazenda-item-${idFazenda}`);
      if (fazendaItem) {
        fazendaItem.remove();
      }

      // Atualizar o select para permitir reassociação
      const select = document.getElementById('selectFazendaDisponivel');
      const option = select.querySelector(`option[value="${idFazenda}"]`);
      if (option) {
        option.disabled = false;
        option.textContent = option.textContent.replace(' (Já associada)', '');
      }

      // Verificar se não há mais fazendas associadas
      const fazendasList = document.getElementById('fazendasAssociadasList');
      const fazendasItems = fazendasList.querySelectorAll('.fazenda-item');
      if (fazendasItems.length === 0) {
        fazendasList.innerHTML = '<p class="text-muted">Nenhum local de origem associado</p>';
      }
      
      await carregarUsuarios();
      hideLoading();
      showSuccess('Local de origem desassociado com sucesso!', 'Desassociação Concluída');
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Erro ao desassociar local de origem', 'Erro de Desassociação');
    }
  }

  function limparModalGerenciarFazendas() {
    const modal = document.getElementById('gerenciarFazendasModal');
    if (modal) {
      const bsModal = bootstrap.Modal.getInstance(modal);
      if (bsModal) {
        bsModal.hide();
      }
      setTimeout(() => {
        modal.remove();
      }, 300);
    }
  }

  // ========== FUNÇÕES PARA PEDIDOS ==========

  async function aprovarPedidoHandler(id) {
    if (!checkAuth()) return;
    
    const justificativa = document.getElementById('reasonText').value;
    
    try {
      await aprovarPedidoAPI(id, justificativa);
      await carregarPedidosPendentes();
      await carregarUsuarios(); // Recarregar usuários pois pode ter adicionado um novo
      resetRequestDetail();
      showSuccess('Pedido aprovado com sucesso!', 'Aprovação Concluída');
    } catch (error) {
      console.error('Erro ao aprovar pedido:', error);
    }
  }

  async function reprovarPedidoHandler(id) {
    if (!checkAuth()) return;
    
    const justificativa = document.getElementById('reasonText').value;
    
    if (!justificativa.trim()) {
      showWarning('Informe a justificativa para rejeição', 'Justificativa Obrigatória');
      return;
    }
    
    try {
      await reprovarPedidoAPI(id, justificativa);
      await carregarPedidosPendentes();
      resetRequestDetail();
      showSuccess('Pedido reprovado com sucesso!', 'Reprovação Concluída');
    } catch (error) {
      console.error('Erro ao reprovar pedido:', error);
    }
  }

  function resetRequestDetail() {
    document.getElementById('requestDetailCard').classList.add('d-none');
    document.getElementById('reasonText').value = '';
    document.getElementById('confirmApproveBtn').classList.add('d-none');
    document.getElementById('confirmRejectBtn').classList.add('d-none');
  }

  // ========== EVENT LISTENERS ==========

  // Salvar usuário (interno)
  saveUserBtn.addEventListener('click', async () => {
    if (!checkAuth()) return;
    
    if (!usuariosForm.checkValidity()) {
      usuariosForm.reportValidity();
      return;
    }

    const usuarioData = getDadosFormularioUsuario();

    try {
      if (window.editIndex) {
        await salvarUsuario(usuarioData, window.editIndex);
        showSuccess('Usuário atualizado com sucesso!', 'Atualização Concluída');
        window.editIndex = null;
      } else {
        await salvarUsuario(usuarioData);
        showSuccess('Usuário criado com sucesso!', 'Usuário Salvo');
      }

      await carregarUsuarios();
      usuariosForm.reset();
      newUserModal.hide();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
    }
  });

  // Aprovar pedido (externo)
  document.getElementById('confirmApproveBtn').addEventListener('click', function() {
    const requestId = this.getAttribute('data-request');
    aprovarPedidoHandler(requestId);
  });

  // Reprovar pedido (externo)
  document.getElementById('confirmRejectBtn').addEventListener('click', function() {
    const requestId = this.getAttribute('data-request');
    reprovarPedidoHandler(requestId);
  });

  // ========== FUNÇÕES GLOBAIS ==========

  async function editarUsuario(id) {
    if (!checkAuth()) return;
    
    try {
      const usuario = await buscarUsuarioPorId(id);
      if (usuario) {
        window.editIndex = id;
        preencherFormularioUsuario(usuario, false);
        newUserModal.show();
        showInfo('Usuário carregado para edição', 'Modo Edição');
      }
    } catch (error) {
      console.error('Erro ao editar usuário:', error);
    }
  }

  async function visualizarUsuario(id) {
    if (!checkAuth()) return;
    
    try {
      const usuario = await buscarUsuarioPorId(id);
      if (usuario) {
        preencherFormularioUsuario(usuario, true);
        newUserModal.show();
        showInfo('Visualizando dados do usuário', 'Modo Visualização');
      }
    } catch (error) {
      console.error('Erro ao visualizar usuário:', error);
    }
  }

  async function removerUsuario(id) {
    if (!checkAuth()) return;
    
    if (confirm("Tem certeza que deseja remover este usuário?")) {
      try {
        await excluirUsuarioAPI(id);
        await carregarUsuarios();
        showSuccess('Usuário removido com sucesso!', 'Exclusão Concluída');
      } catch (error) {
        console.error('Erro ao remover usuário:', error);
      }
    }
  }

  function abrirModalNovoUsuario() {
    if (!checkAuth()) return;
    
    window.editIndex = null;
    usuariosForm.reset();
    saveUserBtn.style.display = 'inline-block';
    newUserModal.show();
    showInfo('Preencha os dados do novo usuário', 'Novo Usuário');
  }

  function abrirModalPedidos() {
    if (!checkAuth()) return;
    
    carregarPedidosPendentes();
    approveUserModal.show();
    showInfo('Gerenciando pedidos de acesso', 'Pedidos Pendentes');
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

  // ========== INICIALIZAÇÃO ==========

  async function inicializar() {
    if (checkAuth()) {
      showInfo('Sistema de usuários carregado', 'Bem-vindo');
      usuarioLogado = await getUser();

      if (usuarioLogado && usuarioLogado.instituicaoEscolhida.tipoUsuario) {
        ocultarItensMenuPorPerfil(usuarioLogado.instituicaoEscolhida.tipoUsuario);
        adaptarLinksParaApicultor(usuarioLogado.instituicaoEscolhida.tipoUsuario, usuarioLogado.id);
      }
      
      // Configurar filtros antes de carregar dados
      configurarFiltros();
      await carregarFazendasFiltro();

      // Carregar estatísticas primeiro
      await carregarCardsUsuarios();
      
      // Carregar usuários
      await carregarUsuarios();
      
      // Event listeners para os botões
      const addUserBtn = document.querySelector('.btn[data-bs-target="#newUserModal"]');
      const manageRequestsBtn = document.querySelector('.btn[data-bs-target="#approveUserModal"]');
      
      if (addUserBtn) {
        addUserBtn.addEventListener('click', abrirModalNovoUsuario);
      }
      
      if (manageRequestsBtn) {
        manageRequestsBtn.addEventListener('click', abrirModalPedidos);
      }
    }
  }

  // ========== VARIÁVEIS GLOBAIS ==========

  window.editIndex = null;
  window.editarUsuario = editarUsuario;
  window.visualizarUsuario = visualizarUsuario;
  window.removerUsuario = removerUsuario;
  window.gerenciarFazendasUsuario = gerenciarFazendasUsuario;
  window.associarFazenda = associarFazenda;
  window.desassociarFazenda = desassociarFazenda;
  window.gerenciarInstituicaoUsuario = gerenciarInstituicaoUsuario;
  window.associarInstituicao = associarInstituicao;
  window.desassociarInstituicao = desassociarInstituicao;
  window.mudarPaginaUsuarios = mudarPaginaUsuarios;
  window.limparFiltros = limparFiltros;

  inicializar();
});