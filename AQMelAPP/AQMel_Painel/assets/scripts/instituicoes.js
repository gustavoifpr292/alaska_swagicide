import API_BASE_URL from '../../../chave_api.js'

document.addEventListener('DOMContentLoaded', () => {
  //const API_BASE_URL = 'http://localhost:3000';
  let instituicoes = [];
  let editIndex = null;
  let paginacaoAtual = null;

  // Variáveis de estado para filtros e paginação
  let currentPage = 1;
  let currentLimit = 10;
  let currentFilters = {
    search: '',
    status: '',
    tipo: ''
  };

  // Elementos DOM
  const instituicoesForm = document.getElementById('instituicaoForm');
  const saveInstituicaoBtn = document.getElementById('saveInstituicaoBtn');
  const newInstituicaoModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('newInstituicaoModal'));
  const tbodyInstituicoes = document.getElementById('instituicoesTableBody');
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
  function configurarFiltrosInstituicoes() {
    // Filtro de busca
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', debounce((e) => {
        currentFilters.search = e.target.value;
        currentPage = 1;
        carregarInstituicoes(currentPage, currentFilters);
      }, 500));
    }

    // Filtro de status
    const statusFilter = document.getElementById('filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        currentFilters.status = e.target.value;
        currentPage = 1;
        carregarInstituicoes(currentPage, currentFilters);
      });
    }

    // Filtro de tipo
    const tipoFilter = document.getElementById('filter-tipo');
    if (tipoFilter) {
      tipoFilter.addEventListener('change', (e) => {
        currentFilters.tipo = e.target.value;
        currentPage = 1;
        carregarInstituicoes(currentPage, currentFilters);
      });
    }

    // Botão limpar filtros
    adicionarBotaoLimparFiltrosInstituicoes();
  }

  function adicionarBotaoLimparFiltrosInstituicoes() {
    const cardHeader = document.querySelector('.card-header .row');
    if (!cardHeader) return;

    // Verificar se já existe botão de limpar
    if (document.getElementById('limpar-filtros-instituicoes')) return;

    const limparBtn = document.createElement('button');
    limparBtn.id = 'limpar-filtros-instituicoes';
    limparBtn.className = 'btn btn-outline-secondary mb-0 ms-2';
    limparBtn.innerHTML = '<i class="material-symbols-rounded me-1">clear_all</i> Limpar';
    limparBtn.addEventListener('click', limparFiltrosInstituicoes);

    // Adicionar ao layout
    const filtroContainer = document.querySelector('.col-md-2.text-end');
    if (filtroContainer) {
      filtroContainer.appendChild(limparBtn);
    }
  }

  function limparFiltrosInstituicoes() {
    // Limpar valores dos inputs
    document.getElementById('searchInput').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-tipo').value = '';

    // Resetar filtros
    currentFilters = {
      search: '',
      status: '',
      tipo: ''
    };
    currentPage = 1;

    // Recarregar instituições
    carregarInstituicoes();
    showInfo('Filtros limpos', 'Filtros');
  }

  // === SISTEMA DE PAGINAÇÃO ===
  function atualizarPaginacaoInstituicoes(paginacao) {
    const paginationContainer = document.querySelector('.pagination');
    if (!paginationContainer || !paginacao) return;

    const { page, pages, total } = paginacao;
    
    let paginationHTML = `
      <li class="page-item ${page === 1 ? 'disabled' : ''}">
        <a class="page-link" href="javascript:;" onclick="mudarPaginaInstituicoes(${page - 1})">
          <i class="material-symbols-rounded">chevron_left</i>
        </a>
      </li>
    `;

    // Gerar números de página
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) {
        paginationHTML += `
          <li class="page-item ${i === page ? 'active' : ''}">
            <a class="page-link" href="javascript:;" onclick="mudarPaginaInstituicoes(${i})">${i}</a>
          </li>
        `;
      } else if (i === page - 3 || i === page + 3) {
        paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
      }
    }

    paginationHTML += `
      <li class="page-item ${page === pages ? 'disabled' : ''}">
        <a class="page-link" href="javascript:;" onclick="mudarPaginaInstituicoes(${page + 1})">
          <i class="material-symbols-rounded">chevron_right</i>
        </a>
      </li>
    `;

    paginationContainer.innerHTML = paginationHTML;
    
    // Atualizar contador
    const quantInstituicoes = document.getElementById('totalInstituicoesCount');
    if (quantInstituicoes) {
      const start = ((page - 1) * currentLimit) + 1;
      const end = Math.min(page * currentLimit, total);
      quantInstituicoes.innerHTML = `${start}-${end} de ${total} instituições`;
    }
  }

  function mudarPaginaInstituicoes(novaPagina) {
    if (!paginacaoAtual) return;
  
    if (novaPagina < 1 || novaPagina > paginacaoAtual.pages) return;
  
    currentPage = novaPagina;
    carregarInstituicoes(currentPage, currentFilters);
  }

  // === FUNÇÕES PRINCIPAIS ===
  async function fetchInstituicoes(filters = {}, page = 1, limit = 10) {
    if (!checkAuth()) return { instituicoes: [], paginacao: {} };
    
    showLoading('Carregando instituições...');
    
    try {
      // Construir query string com filtros
      const queryParams = new URLSearchParams({
        page,
        limit,
        ...filters
      });

      const response = await fetch(`${API_BASE_URL}/instituicoes/?${queryParams}`, {
        headers: getAuthHeaders("instituicoes")
      });
      
      if (response.status === 401) {
        handleAuthError();
        return { instituicoes: [], paginacao: {} };
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar instituições');
      }
      
      updateLoadingText('Processando instituições...');
      const dados = await response.json();
      return dados;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Não foi possível carregar as instituições', 'Erro de Conexão');
      return { instituicoes: [], paginacao: {} };
    }
  }

  async function salvarInstituicao(instituicao, id = null) {
    if (!checkAuth()) return;
    
    showLoading(id ? 'Atualizando instituição...' : 'Salvando instituição...');
    
    try {
      const url = id ? `${API_BASE_URL}/instituicoes/${id}` : `${API_BASE_URL}/instituicoes/`;
      const method = id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: getAuthHeaders("instituicoes"),
        body: JSON.stringify(instituicao)
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao salvar instituição');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao salvar instituição', 'Erro de Salvamento');
      throw error;
    }
  }

  async function excluirInstituicaoAPI(id) {
    if (!checkAuth()) return;
    
    showLoading('Excluindo instituição...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/instituicoes/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders("instituicoes")
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao excluir instituição');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao excluir instituição', 'Erro de Exclusão');
      throw error;
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

  // Função para carregar os cards com totais
  async function carregarCardsInstituicoes() {
    if (!checkAuth()) return;
    
    showLoading('Carregando estatísticas...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/instituicoes/count`, {
        headers: getAuthHeaders("instituicoes"),
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar estatísticas');
      }
      
      const totais = await response.json();
      atualizarCardsInstituicoes(totais);
      
    } catch (error) {
      console.error('Erro ao carregar cards:', error);
      showError('Erro ao carregar estatísticas', 'Erro de Conexão');
    } finally {
      hideLoading();
    }
  }

  // Função para atualizar os cards na interface
  function atualizarCardsInstituicoes(totais) {
    // Card Total de Instituições
    const cardTotal = document.getElementById('totalInstituicoes');
    if (cardTotal) {
      cardTotal.textContent = totais.total || '0';
    }

    // Card Instituições Ativas
    const cardAtivas = document.getElementById('instituicoesAtivas');
    if (cardAtivas) {
      cardAtivas.textContent = totais.ativas || '0';
    }

    // Card Instituições Inativas
    const cardInativas = document.getElementById('instituicoesInativas');
    if (cardInativas) {
      cardInativas.textContent = totais.inativas || '0';
    }

    // Card Total de Usuários (mantém o cálculo local como fallback)
    const cardUsuarios = document.getElementById('totalUsuariosInstituicoes');
    if (cardUsuarios) {
      const totalUsuarios = instituicoes.reduce((sum, instituicao) => sum + (instituicao.numUsuarios || 0), 0);
      cardUsuarios.textContent = totalUsuarios;
    }
  }

  async function carregarInstituicoes(page = 1, filters = currentFilters) {
    if (!checkAuth()) return;
    
    try {
      const resultado = await fetchInstituicoes(filters, page, currentLimit);
      instituicoes = resultado.instituicoes || [];
      renderizarInstituicoes();
      paginacaoAtual = resultado.paginacao; 
      atualizarPaginacaoInstituicoes(resultado.paginacao);
      atualizarEstatisticas();
      
      if (instituicoes.length > 0) {
        showSuccess(`${resultado.paginacao?.total || instituicoes.length} instituições encontradas`, 'Dados Carregados');
      } else {
        showWarning('Nenhuma instituição encontrada com os filtros aplicados', 'Sem Dados');
      }

      hideLoading();
    } catch (error) {
      console.error('Erro ao carregar instituições:', error);
    }
  }

  function renderizarInstituicoes() {
    if (!tbodyInstituicoes) return;
    
    tbodyInstituicoes.innerHTML = '';

    if (instituicoes.length === 0) {
      tbodyInstituicoes.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4">
            <i class="material-symbols-rounded text-muted mb-2" style="font-size: 3rem;">business_off</i>
            <p class="text-muted mb-0">Nenhuma instituição encontrada</p>
          </td>
        </tr>
      `;
      return;
    }

    instituicoes.forEach((instituicao) => {
      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td>
          <div class="d-flex px-2 py-1">
            <div>
              <img src="../assets/img/team-2.jpg" class="avatar avatar-sm me-3 border-radius-lg" alt="${instituicao.nome}">
            </div>
            <div class="d-flex flex-column justify-content-center">
              <h6 class="mb-0 text-sm">${instituicao.nome || 'N/A'}</h6>
              <p class="text-xs text-secondary mb-0">${instituicao.sigla || 'N/A'}</p>
            </div>
          </div>
        </td>
        <td>
          <p class="text-sm font-weight-bold mb-0">${instituicao.cidade || 'N/A'}, ${instituicao.estado || 'N/A'}</p>
          <p class="text-xs text-secondary mb-0">${instituicao.endereco || 'N/A'}</p>
        </td>
        <td class="align-middle text-center text-sm">
          <span class="text-xs font-weight-bold">${instituicao.tipo || 'N/A'}</span>
        </td>
        <td class="align-middle text-center">
          <span class="badge badge-sm bg-gradient-info">${instituicao.numUsuarios || 0}</span>
        </td>
        <td class="align-middle text-center">
          <span class="badge badge-sm ${getStatusBadgeClass(instituicao.status)}">${instituicao.status || 'Ativa'}</span>
        </td>
        <td class="align-middle text-center">
          <span class="text-secondary text-xs font-weight-bold">${formatarData(instituicao.dataCriacao) || '-'}</span>
        </td>
        <td class="align-middle text-center">
          <a href="javascript:;" class="text-secondary font-weight-bold text-xs" onclick="editarInstituicao('${instituicao.id}')" data-toggle="tooltip" title="Editar">
            <i class="material-symbols-rounded">edit</i>
          </a>
          <a href="javascript:;" class="text-secondary font-weight-bold text-xs ms-2" onclick="visualizarInstituicao('${instituicao.id}')" data-toggle="tooltip" title="Visualizar">
            <i class="material-symbols-rounded">visibility</i>
          </a>
          <a href="javascript:;" class="text-danger font-weight-bold text-xs ms-2" onclick="removerInstituicao('${instituicao.id}')" data-toggle="tooltip" title="Excluir">
            <i class="material-symbols-rounded">delete</i>
          </a>
        </td>
      `;

      tbodyInstituicoes.appendChild(tr);
    });

    // Atualizar contador
    const quantElement = document.getElementById('totalInstituicoesCount');
    if (quantElement) {
      quantElement.textContent = `${instituicoes.length} instituições`;
    }
  }

  function atualizarEstatisticas() {
    const totalInstituicoes = instituicoes.length;
    const instituicoesAtivas = instituicoes.filter(i => i.status === 'Ativa').length;
    const instituicoesInativas = instituicoes.filter(i => i.status === 'Inativa').length;
    const totalUsuarios = instituicoes.reduce((total, instituicao) => total + (instituicao.numUsuarios || 0), 0);

    // Atualizar cards (fallback caso a API de count não funcione)
    document.getElementById('totalInstituicoes').textContent = totalInstituicoes;
    document.getElementById('instituicoesAtivas').textContent = instituicoesAtivas;
    document.getElementById('instituicoesInativas').textContent = instituicoesInativas;
    document.getElementById('totalUsuariosInstituicoes').textContent = totalUsuarios;
  }

  // ========== FUNÇÕES AUXILIARES ==========
  function getStatusBadgeClass(status) {
    switch(status?.toLowerCase()) {
      case 'ativa': return 'bg-gradient-success';
      case 'inativa': return 'bg-gradient-danger';
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

  function preencherFormularioInstituicao(instituicao, disabled = false) {
    document.getElementById('instituicaoNome').value = instituicao.nome || '';
    document.getElementById('instituicaoSigla').value = instituicao.sigla || '';
    document.getElementById('instituicaoTipo').value = instituicao.tipo || '';
    document.getElementById('instituicaoEmail').value = instituicao.email || '';
    document.getElementById('instituicaoTelefone').value = instituicao.telefone || '';
    document.getElementById('instituicaoEndereco').value = instituicao.endereco || '';
    document.getElementById('instituicaoCidade').value = instituicao.cidade || '';
    document.getElementById('instituicaoEstado').value = instituicao.estado || '';
    document.getElementById('instituicaoRegiao').value = instituicao.regiao || '';
    document.getElementById('instituicaoNumUsuarios').value = instituicao.numUsuarios || '';
    document.getElementById('instituicaoStatus').value = instituicao.status || 'Ativa';
    document.getElementById('instituicaoObservacoes').value = instituicao.observacoes || '';

    const inputs = instituicoesForm.querySelectorAll('input, select, textarea');
    inputs.forEach((el) => {
      el.disabled = disabled;
    });
    
    if (disabled) {
      saveInstituicaoBtn.style.display = 'none';
      modalTitle.textContent = 'Visualizar Instituição';
    } else {
      saveInstituicaoBtn.style.display = 'inline-block';
      modalTitle.textContent = window.editIndex ? 'Editar Instituição' : 'Nova Instituição';
    }
  }

  function getDadosFormularioInstituicao() {
    return {
      nome: document.getElementById('instituicaoNome').value,
      sigla: document.getElementById('instituicaoSigla').value,
      tipo: document.getElementById('instituicaoTipo').value,
      email: document.getElementById('instituicaoEmail').value,
      telefone: document.getElementById('instituicaoTelefone').value,
      endereco: document.getElementById('instituicaoEndereco').value,
      cidade: document.getElementById('instituicaoCidade').value,
      estado: document.getElementById('instituicaoEstado').value,
      regiao: document.getElementById('instituicaoRegiao').value,
      numUsuarios: parseInt(document.getElementById('instituicaoNumUsuarios').value) || 0,
      status: document.getElementById('instituicaoStatus').value,
      observacoes: document.getElementById('instituicaoObservacoes').value,
      dataCriacao: new Date().toISOString()
    };
  }

  // ========== EVENT LISTENERS ==========
  saveInstituicaoBtn.addEventListener('click', async () => {
    if (!checkAuth()) return;
    
    if (!instituicoesForm.checkValidity()) {
      instituicoesForm.reportValidity();
      return;
    }

    const instituicaoData = getDadosFormularioInstituicao();

    try {
      if (window.editIndex) {
        await salvarInstituicao(instituicaoData, window.editIndex);
        showSuccess('Instituição atualizada com sucesso!', 'Atualização Concluída');
        window.editIndex = null;
      } else {
        await salvarInstituicao(instituicaoData);
        showSuccess('Instituição criada com sucesso!', 'Instituição Salva');
      }

      await carregarInstituicoes();
      instituicoesForm.reset();
      newInstituicaoModal.hide();
    } catch (error) {
      console.error('Erro ao salvar instituição:', error);
    }
  });

  // ========== FUNÇÕES GLOBAIS ==========
  async function editarInstituicao(id) {
    if (!checkAuth()) return;
    
    try {
      const instituicao = await buscarInstituicaoPorId(id);
      if (instituicao) {
        window.editIndex = id;
        preencherFormularioInstituicao(instituicao, false);
        newInstituicaoModal.show();
        showInfo('Instituição carregada para edição', 'Modo Edição');
      }
    } catch (error) {
      console.error('Erro ao editar instituição:', error);
    }
  }

  async function visualizarInstituicao(id) {
    if (!checkAuth()) return;
    
    try {
      const instituicao = await buscarInstituicaoPorId(id);
      if (instituicao) {
        preencherFormularioInstituicao(instituicao, true);
        newInstituicaoModal.show();
        showInfo('Visualizando dados da instituição', 'Modo Visualização');
      }
    } catch (error) {
      console.error('Erro ao visualizar instituição:', error);
    }
  }

  async function removerInstituicao(id) {
    if (!checkAuth()) return;
    
    if (confirm("Tem certeza que deseja remover esta instituição?")) {
      try {
        await excluirInstituicaoAPI(id);
        await carregarInstituicoes();
        showSuccess('Instituição removida com sucesso!', 'Exclusão Concluída');
      } catch (error) {
        console.error('Erro ao remover instituição:', error);
      }
    }
  }

  function abrirModalNovaInstituicao() {
    if (!checkAuth()) return;
    
    window.editIndex = null;
    instituicoesForm.reset();
    saveInstituicaoBtn.style.display = 'inline-block';
    modalTitle.textContent = 'Nova Instituição';
    newInstituicaoModal.show();
    showInfo('Preencha os dados da nova instituição', 'Nova Instituição');
  }

  // ========== INICIALIZAÇÃO ==========
  async function inicializar() {
    if (checkAuth()) {
      showInfo('Sistema de instituições carregado', 'Bem-vindo');
      configurarFiltrosInstituicoes();
      await carregarCardsInstituicoes();
      await carregarInstituicoes();
      
      // Event listener para o botão de nova instituição
      const addInstituicaoBtn = document.querySelector('.btn[data-bs-target="#newInstituicaoModal"]');
      if (addInstituicaoBtn) {
        addInstituicaoBtn.addEventListener('click', abrirModalNovaInstituicao);
      }
    }
  }

  // ========== VARIÁVEIS GLOBAIS ==========
  window.editIndex = null;
  window.editarInstituicao = editarInstituicao;
  window.visualizarInstituicao = visualizarInstituicao;
  window.removerInstituicao = removerInstituicao;
  window.mudarPaginaInstituicoes = mudarPaginaInstituicoes;
  window.limparFiltros = limparFiltrosInstituicoes;
  window.closeNotification = closeNotification;

  inicializar();
});