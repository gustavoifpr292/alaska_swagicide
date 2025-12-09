import API_BASE_URL from '../../../chave_api.js'

const sampleForm = document.getElementById('sampleForm');
const saveSampleBtn = document.getElementById('saveSampleBtn');
const tableBody = document.querySelector('tbody');
const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('newSampleModal'));
const addAmostraBtn = document.getElementById('addAmostra');
let amostras = [];
let usuarioLogado = null;
let paginacaoAtual = null;

// Configuração da API
//const API_BASE_URL = 'http://localhost:3000';

// Variáveis de estado para filtros e paginação
let currentPage = 1;
let currentLimit = 10;
let currentFilters = {
  search: '',
  status: '',
  cultura: '',
  dataInicio: '',
  dataFim: '',
  produtor: '',
  fazenda: ''
};

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

// Funções auxiliares para notificações
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

// Tornar função global
window.closeNotification = closeNotification;

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
  }, 2000);
}

function handleUnauthorizedAction() {
  hideLoading();
  showError('Essa ação não pode ser feita.', 'Ação Proibida');
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

function configurarFiltros() {
  // Filtro de busca por código
  const searchFilter = document.getElementById('search-filter');
  if (searchFilter) {
    searchFilter.addEventListener('input', debounce((e) => {
      currentFilters.search = e.target.value;
      currentPage = 1;
      carregarAmostras(currentPage, currentFilters);
    }, 500));
  }

  // Filtro de status
  const statusFilter = document.getElementById('filter-status');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      currentFilters.status = e.target.value;
      currentPage = 1;
      carregarAmostras(currentPage, currentFilters);
    });
  }

  // Filtro de cultura
  const culturaFilter = document.getElementById('filter-type');
  if (culturaFilter) {
    culturaFilter.addEventListener('change', (e) => {
      currentFilters.cultura = e.target.value;
      currentPage = 1;
      carregarAmostras(currentPage, currentFilters);
    });
  }

  // Filtro de data início
  const dataInicioFilter = document.getElementById('filter-data-inicio');
  if (dataInicioFilter) {
    dataInicioFilter.addEventListener('change', (e) => {
      currentFilters.dataInicio = e.target.value;
      currentPage = 1;
      carregarAmostras(currentPage, currentFilters);
    });
  }

  // Filtro de data fim
  const dataFimFilter = document.getElementById('filter-data-fim');
  if (dataFimFilter) {
    dataFimFilter.addEventListener('change', (e) => {
      currentFilters.dataFim = e.target.value;
      currentPage = 1;
      carregarAmostras(currentPage, currentFilters);
    });
  }

  const produtoresFilter = document.getElementById('filter-produtores');
  if (produtoresFilter) {
    produtoresFilter.addEventListener('change', (e) => {
      currentFilters.produtor = e.target.value;
      currentPage = 1;
      carregarAmostras(currentPage, currentFilters);
    });
  }

  const fazendasFilter = document.getElementById('filter-fazendas');
  if (fazendasFilter) {
    fazendasFilter.addEventListener('change', (e) => {
      currentFilters.fazenda = e.target.value;
      currentPage = 1;
      carregarAmostras(currentPage, currentFilters);
    });
  }

  // Botão limpar filtros
  adicionarBotaoLimparFiltros();
}

function adicionarBotaoLimparFiltros() {
  const cardHeader = document.querySelector('.card-header .row');
  if (!cardHeader) return;

  // Verificar se já existe botão de limpar
  if (document.getElementById('limpar-filtros')) return;

  const limparBtn = document.createElement('button');
  limparBtn.id = 'limpar-filtros';
  limparBtn.className = 'btn btn-outline-secondary mb-0';
  limparBtn.innerHTML = '<i class="material-symbols-rounded me-1">clear_all</i> Limpar';
  limparBtn.addEventListener('click', limparFiltros);

  // Adicionar ao layout (ajuste a classe da coluna conforme necessário)
  const col = document.createElement('div');
  col.className = 'col-md-1 text-end';
  col.appendChild(limparBtn);
  cardHeader.appendChild(col);
}

function limparFiltros() {
  // Limpar valores dos inputs
  document.getElementById('search-filter').value = '';
  document.getElementById('filter-type').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-data-inicio').value = '';
  document.getElementById('filter-data-fim').value = '';
  document.getElementById('filter-produtores').value = '';
  document.getElementById('filter-fazendas').value = '';

  // Resetar filtros
  currentFilters = {
    search: '',
    status: '',
    cultura: '',
    dataInicio: '',
    dataFim: '',
    produtor: '',
    fazenda: ''
  };
  currentPage = 1;

  // Recarregar amostras
  carregarAmostras();
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
  const quantAmostras = document.getElementById('quantAmostras');
  if (quantAmostras) {
    const start = ((page - 1) * currentLimit) + 1;
    const end = Math.min(page * currentLimit, total);
    quantAmostras.innerHTML = `${start}-${end} de ${total} amostras`;
  }
}

function mudarPagina(novaPagina) {
  if (!paginacaoAtual) return;

  if (novaPagina < 1 || novaPagina > paginacaoAtual.pages) return;

  currentPage = novaPagina;
  carregarAmostras(currentPage, currentFilters);
}

// === FUNÇÕES PRINCIPAIS ===
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

// Buscar usuários do tipo "Apicultor"
async function fetchProdutores() {
  if (!checkAuth()) return [];
  
  showLoading('Carregando produtores...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/usuarios/apicultores`, {
      headers: getAuthHeaders("usuarios", true)
    });
    
    if (response.status === 401) {
      handleAuthError();
      return [];
    }
    
    if (!response.ok) {
      throw new Error('Erro ao buscar produtores');
    }
    
    const usuarios = await response.json();
    hideLoading();
    return usuarios;
  } catch (error) {
    console.error('Erro ao buscar produtores:', error);
    hideLoading();
    showError('Erro ao carregar lista de produtores', 'Erro de Conexão');
    return [];
  }
}

async function fetchFazendas() {
  if (!checkAuth()) return [];
  
  showLoading('Carregando locais de origem...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/fazendas`, {
      headers: getAuthHeaders("fazendas", true)
    });
    
    if (response.status === 401) {
      handleAuthError();
      return [];
    }
    
    if (!response.ok) {
      throw new Error('Erro ao buscar locais de origem');
    }
    
    const { fazendas } = await response.json();
    hideLoading();
    return fazendas;
  } catch (error) {
    console.error('Erro ao buscar locais de origem:', error);
    hideLoading();
    showError('Erro ao carregar lista de locais de origem', 'Erro de Conexão');
    return [];
  }
}

// Preencher dropdown de produtores
async function carregarProdutores(id='produtorSelect') {
  const produtorSelect = document.getElementById(id);
  if (!produtorSelect) return;
  
  showLoading('Carregando produtores...');
  
  try {
    const produtores = await fetchProdutores();
    
    // Limpar options existentes (exceto a primeira)
    while (produtorSelect.options.length > 1) {
      produtorSelect.remove(1);
    }
    
    // Adicionar produtores ao dropdown
    produtores.forEach(produtor => {
      const option = document.createElement('option');
      option.value = produtor.id;
      option.textContent = `${produtor.nome || 'Sem nome'} - ${produtor.email || 'Sem email'}`;
      produtorSelect.appendChild(option);
    });
    
    // Se não houver produtores, mostrar mensagem
    if (produtores.length === 0) {
      const option = document.createElement('option');
      option.value = "";
      option.textContent = "Nenhum produtor cadastrado";
      option.disabled = true;
      produtorSelect.appendChild(option);
    }
    
    hideLoading();
  } catch (error) {
    console.error('Erro ao carregar locais de origem:', error);
    hideLoading();
    showError('Erro ao carregar lista de locais de origem', 'Erro de Carregamento');
  }
}

async function carregarFazendasFiltro() {
  const fazendaSelect = document.getElementById('filter-fazendas');
  if (!fazendaSelect) return;
  
  showLoading('Carregando fazendas...');
  
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
      option.textContent = "Nenhum local de origem cadastrado";
      option.disabled = true;
      produtorSelect.appendChild(option);
    }
    
    hideLoading();
    
  } catch (error) {
    console.error('Erro ao carregar produtores:', error);
    hideLoading();
    showError('Erro ao carregar lista de produtores', 'Erro de Carregamento');
  }
}

// Função para carregar os cards com totais
async function carregarCardsAmostras() {
  if (!checkAuth()) return;
  
  showLoading('Carregando estatísticas...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/amostras/count`, {
      headers: getAuthHeaders("amostras"),
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

// Função para atualizar os cards na interface
function atualizarCards(totais) {
  // Card Total de Amostras
  const cardTotal = document.getElementById('totalAmostras');
  if (cardTotal) {
    cardTotal.textContent = totais.total || '0';
  }

  // Card Pendentes
  const cardPendentes = document.getElementById('totalPendentes');
  if (cardPendentes) {
    cardPendentes.textContent = totais.pendentes || '0';
  }

  // Card Analisadas
  const cardAnalisadas = document.getElementById('totalConcluidas');
  if (cardAnalisadas) {
    cardAnalisadas.textContent = totais.analisadas || '0';
  }
}

// Funções para comunicação com a API
async function fetchAmostras(filters = {}, page = 1, limit = 10) {
  if (!checkAuth()) return { amostras: [], paginacao: {} };
  
  showLoading('Carregando amostras...');
  
  try {
    // Construir query string com filtros
    const queryParams = new URLSearchParams({
      page,
      limit,
      ...filters
    });

    const response = await fetch(`${API_BASE_URL}/amostras/?${queryParams}`, {
      headers: getAuthHeaders("amostras")
    });
    
    if (response.status === 401) {
      handleAuthError();
      return { amostras: [], paginacao: {} };
    }
    
    if (!response.ok) {
      throw new Error('Erro ao buscar amostras');
    }
    
    updateLoadingText('Processando amostras...');
    const dados = await response.json();
    return dados;
    
  } catch (error) {
    console.error('Erro:', error);
    showError('Não foi possível carregar as amostras', 'Erro de Conexão');
    return { amostras: [], paginacao: {} };
  } finally {
    hideLoading();
  }
}

async function salvarAmostra(amostra, id = null) {
  if (!checkAuth()) return;
  
  showLoading(id ? 'Atualizando amostra...' : 'Salvando amostra...');
  
  try {
    const url = id ? `${API_BASE_URL}/amostras/${id}` : `${API_BASE_URL}/amostras/`;
    const method = id ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method: method,
      headers: getAuthHeaders("amostras"),
      body: JSON.stringify(amostra)
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
      throw new Error(errorData.message || 'Erro ao salvar amostra');
    }
    
    const resultado = await response.json();
    hideLoading();
    return resultado;
    
  } catch (error) {
    console.error('Erro:', error);
    hideLoading();
    showError(error.message || 'Erro ao salvar amostra', 'Erro de Salvamento');
    throw error;
  }
}

async function excluirAmostraAPI(id) {
  if (!checkAuth()) return;
  
  showLoading('Excluindo amostra...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/amostras/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders('amostras')
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
      throw new Error(errorData.message || 'Erro ao excluir amostra');
    }
    
    const resultado = await response.json();
    hideLoading();
    return resultado;
    
  } catch (error) {
    console.error('Erro:', error);
    hideLoading();
    showError(error.message || 'Erro ao excluir amostra', 'Erro de Exclusão');
    throw error;
  }
}

// Carregar amostras da API
async function carregarAmostras(page = 1, filters = currentFilters) {
  if (!checkAuth()) return;
  
  try {
    const resultado = await fetchAmostras(filters, page, currentLimit);
    amostras = resultado.amostras || [];
    paginacaoAtual = resultado.paginacao;
    renderizarAmostras();
    paginacaoAtual = resultado.paginacao; 
    atualizarPaginacao(resultado.paginacao);
    
    if (amostras.length > 0) {
      showSuccess(`${resultado.paginacao?.total || amostras.length} amostras encontradas`, 'Dados Carregados');
    } else {
      showWarning('Nenhuma amostra encontrada com os filtros aplicados', 'Sem Dados');
    }
  } catch (error) {
    console.error('Erro ao carregar amostras:', error);
  }
}

// Gerar código automático (placeholder)
function gerarCodigo() {
  return 'AM-2024-XXXX';
}

// Renderizar as amostras
async function renderizarAmostras() {
  tableBody.innerHTML = "";

  // Buscar produtores e fazendas para exibir nomes
  const produtores = await fetchProdutores();
  //console.log(produtores);
  const produtorMap = new Map();
  produtores.forEach(produtor => {
    produtorMap.set(produtor.id, {
      nome: produtor.nome,
      fazendas: produtor.fazendas || []
    });
  });

  if (amostras.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4">
          <i class="material-symbols-rounded text-muted mb-2" style="font-size: 3rem;">science</i>
          <p class="text-muted mb-0">Nenhuma amostra encontrada</p>
        </td>
      </tr>
    `;
    return;
  }

  amostras.forEach((amostra) => {
    const origem = amostra.origem.split(" - ");

    const nomeProdutor = `${origem[0]} - ${origem[1]}`;
    const nomeFazenda = `${origem[2]} - ${origem[3]}`;
    //const produtorInfo = produtorMap.get(amostra.idProdutor);
    //const nomeProdutor = produtorInfo?.nome || amostra.origem || 'N/A';
    
    // Buscar nome da fazenda se existir
    /*let nomeFazenda = 'N/A';
    if (amostra.idFazenda && produtorInfo?.fazendas) {
      const fazenda = produtorInfo.fazendas.find(f => f.id === amostra.idFazenda);
      nomeFazenda = fazenda ? `${fazenda.nome} - ${fazenda.cidade}, ${fazenda.estado}` : 'N/A';
    }*/

    const permissaoEditarOuExcluir = (usuarioLogado && (usuarioLogado.id === amostra.idUsuario && amostra.status === "Pendente")) || (usuarioLogado && usuarioLogado.tipoUsuario === 'Administrador');
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><h6 class="mb-0 text-sm">${amostra.id}</h6></td>
      <td>
        <p class="text-sm font-weight-bold mb-0">${nomeProdutor}</p>
        <p class="text-xs text-secondary mb-0">${nomeFazenda}</p>
      </td>
      <td class="align-middle text-center text-sm">
        <span class="text-xs font-weight-bold">${amostra.cultura || 'N/A'}</span>
      </td>
      <td class="align-middle text-center">
        <span class="text-secondary text-xs font-weight-bold">${amostra.dataColeta || amostra.data || 'N/A'}</span>
      </td>
      <td class="align-middle text-center">
        <span class="badge badge-sm ${getStatusBadgeClass(amostra.status)}">${amostra.status || 'Pendente'}</span>
      </td>
      <td class="align-middle text-center">
        ${permissaoEditarOuExcluir ? `<a href="#" class="text-secondary font-weight-bold text-xs" onclick="editarAmostra('${amostra.id}')" data-toggle="tooltip" title="Editar"> <i class="material-symbols-rounded">edit</i> </a>` : ""}
        <a href="#" class="text-secondary font-weight-bold text-xs ms-2" onclick="visualizarAmostra('${amostra.id}')" data-toggle="tooltip" title="Visualizar">
          <i class="material-symbols-rounded">visibility</i>
        </a>
        ${permissaoEditarOuExcluir ? `<a href="#" class="text-danger font-weight-bold text-xs ms-2" onclick="removerAmostra('${amostra.id}')" data-toggle="tooltip" title="Excluir">
          <i class="material-symbols-rounded">delete</i>
        </a>` : ""}
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

// Classe do badge baseado no status
function getStatusBadgeClass(status) {
  switch(status) {
    case 'Pendente': return 'bg-gradient-warning';
    case 'Analisado': return 'bg-gradient-success';
    case 'Cancelado': return 'bg-gradient-danger';
    default: return 'bg-gradient-secondary';
  }
}

// Remover amostra
async function removerAmostra(id) {
  if (!checkAuth()) return;
  
  if (confirm("Tem certeza que deseja remover esta amostra?")) {
    try {
      await excluirAmostraAPI(id);
      await carregarAmostras();
      showSuccess('Amostra removida com sucesso!', 'Exclusão Concluída');
    } catch (error) {
      console.error('Erro ao remover amostra:', error);
    }
  }
}

// Preencher o formulário com os dados da amostra
async function preencherFormulario(amostra, isDisabled = false) {
  const inputs = sampleForm.querySelectorAll('input, select');

  inputs[0].value = amostra.id; // código (disabled)
  inputs[1].value = formatDateForInput(amostra.dataColeta || amostra.data);
  
  // Preencher o select de produtor
  const produtorSelect = document.getElementById('produtorSelect');
  if (produtorSelect && amostra.idProdutor) {
    produtorSelect.value = amostra.idProdutor;
    
    // Carregar fazendas deste produtor
    if (amostra.idProdutor) {
      const fazendas = await fetchFazendasApicultor(amostra.idProdutor);
      preencherFazendas(fazendas);
      
      // Preencher a fazenda se existir na amostra
      const fazendaSelect = document.getElementById('fazendaSelect');
      if (fazendaSelect && amostra.idFazenda) {
        fazendaSelect.value = amostra.idFazenda;
      }
    }
  }
  
  inputs[4].value = amostra.cultura || '';
  inputs[5].value = amostra.especie || '';

  // Habilitar ou desabilitar inputs
  inputs.forEach((input, i) => {
    if (i === 0) return; // manter código sempre desabilitado
    input.disabled = isDisabled;
  });

  // Mostrar botão de salvar somente se não for visualização
  saveSampleBtn.style.display = isDisabled ? 'none' : 'inline-block';
}

// Format date for input field (YYYY-MM-DD)
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

// Buscar amostra por ID
async function buscarAmostraPorId(id) {
  if (!checkAuth()) return null;
  
  showLoading('Carregando amostra...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/amostras/${id}`, {
      headers: getAuthHeaders('amostras')
    });
    
    if (response.status === 401) {
      handleAuthError();
      return null;
    }
    
    if (!response.ok) {
      throw new Error('Erro ao buscar amostra');
    }
    
    const amostra = await response.json();
    hideLoading();
    return amostra;
    
  } catch (error) {
    console.error('Erro:', error);
    hideLoading();
    showError('Erro ao carregar amostra', 'Erro de Carregamento');
    return null;
  }
}

// Editar amostra
async function editarAmostra(id) {
  if (!checkAuth()) return;
  
  try {
    const amostra = await buscarAmostraPorId(id);
    if (amostra) {
      window.editIndex = id;
      // Carregar produtores antes de preencher o formulário
      await carregarProdutores();
      await preencherFormulario(amostra);
      await carregarParametrosSolicitaveis();
      //console.log(amostra.parametrosSolicitados);
      marcarParametrosSolicitados(amostra.parametrosSolicitados || []);
      modal.show();
      showInfo('Amostra carregada para edição', 'Modo Edição');
    }
  } catch (error) {
    console.error('Erro ao editar amostra:', error);
  }
}

// Visualizar amostra
async function visualizarAmostra(id) {
  if (!checkAuth()) return;
  
  try {
    const amostra = await buscarAmostraPorId(id);
    if (amostra) {
      // Carregar produtores antes de preencher o formulário
      //console.log(amostra);
      await carregarProdutores();

      // Carregar todos os parâmetros e marcar os solicitados
      await carregarParametrosSolicitaveis();
      //console.log(amostra.parametrosSolicitados);
      marcarParametrosSolicitados(amostra.parametrosSolicitados || []);
      bloquearCheckboxesParametros(true);

      await preencherFormulario(amostra, true);
      const origens = (amostra.origem || '').split(" - ");
      
      const produtorSelect = document.getElementById('produtorSelect');
      if (produtorSelect) {
        // garantir que exista uma option visível para o produtor/origem
        const existing = Array.from(produtorSelect.options).find(o => o.value == amostra.idProdutor);
        if (!existing) {
          const option = document.createElement('option');
          option.value = amostra.idProdutor;
          option.textContent = origens.length >= 2 ? `${origens[0]} - ${origens[1]}` : (amostra.origem || 'Origem');
          option.disabled = true;
          produtorSelect.appendChild(option);
        }
        produtorSelect.value = amostra.idProdutor;
      }

      modal.show();
      showInfo('Visualizando dados da amostra', 'Modo Visualização');
    }
  } catch (error) {
    console.error('Erro ao visualizar amostra:', error);
  }
}

async function abrirModalNovaAmostra() {
  if (!checkAuth()) return;
  
  window.editIndex = null;
  sampleForm.reset();

  // Recarregar parâmetros e garantir que checkboxes estejam habilitados
  await carregarParametrosSolicitaveis();
  bloquearCheckboxesParametros(false);

  const elementosModal = Array.from(sampleForm.elements);
  elementosModal.forEach(element => element.disabled = false);
  elementosModal[0].disabled = true; // código da amostra
  elementosModal[0].value = gerarCodigo(); // Gerar código placeholder
  
  // Inicializar campo de fazendas
  limparFazendas();
  const fazendaSelect = document.getElementById('fazendaSelect');
  if (fazendaSelect) {
    fazendaSelect.disabled = true;
  }
  
  // Carregar produtores quando abrir o modal
  carregarProdutores();
  
  saveSampleBtn.style.display = 'inline-block';
  modal.show();
  showInfo('Preencha os dados da nova amostra', 'Nova Amostra');
}

// Event listeners
if (addAmostraBtn) {
  addAmostraBtn.addEventListener('click', abrirModalNovaAmostra);
}

// Buscar fazendas do apicultor selecionado
async function fetchFazendasApicultor(idApicultor) {
  if (!checkAuth()) return [];
  
  showLoading('Carregando locais de origem...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/usuarios/${idApicultor}`, {
      headers: getAuthHeaders("usuarios", true)
    });
    
    if (response.status === 401) {
      handleAuthError();
      return [];
    }
    
    if (!response.ok) {
      throw new Error('Erro ao buscar locais de origem do apicultor');
    }
    
    const usuario = await response.json();
    hideLoading();
    return usuario.fazendas || [];
    
  } catch (error) {
    console.error('Erro ao buscar locais de origem do apicultor:', error);
    hideLoading();
    showError('Erro ao carregar locais de origem', 'Erro de Carregamento');
    return [];
  }
}

async function carregarParametrosSolicitaveis() {
  const container = document.getElementById("parametrosSolicitadosContainer");
  if (!container) return;
  container.innerHTML = ""; // limpa antes de renderizar

  try {
    const response = await fetch(`${API_BASE_URL}/parametros/`, {
      headers: getAuthHeaders("parametros", true)
    });

    if (response.status === 401) {
      handleAuthError();
      return;
    }

    if (!response.ok) {
      throw new Error('Erro ao buscar parâmetros');
    }

    const parametros = await response.json();

    parametros.forEach(param => {
      const item = document.createElement("div");
      item.className = "col-md-6";

      item.innerHTML = `
        <div class="form-check">
          <input class="form-check-input parametro-checkbox" type="checkbox" 
                 value="${param.id}" data-nome="${param.nome}" 
                 data-unidade="${param.unidade}" data-tipo="${param.tipo}">
          <label class="form-check-label">
            ${param.nome} (${param.unidade})
          </label>
        </div>
      `;

      container.appendChild(item);
    });

  } catch (error) {
    console.error("Erro ao carregar parâmetros:", error);
    showError("Não foi possível carregar os parâmetros");
  }
}

// Marcar parâmetros solicitados (usa id ou nome)
function marcarParametrosSolicitados(parametros) {
  if (!Array.isArray(parametros)) return;
  const checkboxes = document.querySelectorAll('.parametro-checkbox');
  checkboxes.forEach(cb => {
    const encontrado = parametros.some(p => String(p.idParametro) == String(cb.value) || String(p.id) == String(cb.dataset.id));
    cb.checked = encontrado;
  });
}

// Bloquear ou desbloquear checkboxes de parâmetros
function bloquearCheckboxesParametros(bloquear = true) {
  const checkboxes = document.querySelectorAll('.parametro-checkbox');
  checkboxes.forEach(cb => cb.disabled = bloquear);
}

// Preencher dropdown de fazendas
function preencherFazendas(fazendas) {
  const fazendaSelect = document.getElementById('fazendaSelect');
  if (!fazendaSelect) return;
  
  // Limpar options existentes (exceto a primeira)
  while (fazendaSelect.options.length > 1) {
    fazendaSelect.remove(1);
  }
  
  // Adicionar fazendas ao dropdown
  fazendas.forEach(fazenda => {
    const option = document.createElement('option');
    option.value = fazenda.id;
    option.textContent = `${fazenda.nome} - ${fazenda.cidade}, ${fazenda.estado}`;
    fazendaSelect.appendChild(option);
  });
  
  // Se não houver fazendas, mostrar mensagem
  if (fazendas.length === 0) {
    const option = document.createElement('option');
    option.value = "";
    option.textContent = "Nenhuma fazenda associada";
    option.disabled = true;
    fazendaSelect.appendChild(option);
  }
}

// Limpar dropdown de fazendas
function limparFazendas() {
  const fazendaSelect = document.getElementById('fazendaSelect');
  if (!fazendaSelect) return;
  
  while (fazendaSelect.options.length > 1) {
    fazendaSelect.remove(1);
  }
  
  const option = document.createElement('option');
  option.value = "";
  option.textContent = "Selecione um apicultor primeiro";
  option.disabled = true;
  fazendaSelect.appendChild(option);
}

// Event listener para mudança no select de produtor
async function adicionarListenerProdutor() {
  const produtorSelect = document.getElementById('produtorSelect');
  if (produtorSelect) {
    produtorSelect.addEventListener('change', async function() {
      const idApicultor = this.value;
      const fazendaSelect = document.getElementById('fazendaSelect');
      
      if (idApicultor) {
        // Mostrar loading
        fazendaSelect.disabled = true;
        fazendaSelect.innerHTML = '<option value="">Carregando locais de origem...</option>';
        
        try {
          const fazendas = await fetchFazendasApicultor(idApicultor);
          fazendaSelect.innerHTML = '<option value="">Selecione um local de origem</option>';
          preencherFazendas(fazendas);
          fazendaSelect.disabled = false;
        } catch (error) {
          console.error('Erro ao carregar locais de origem:', error);
          fazendaSelect.innerHTML = '<option value="">Erro ao carregar locais de origem</option>';
        }
      } else {
        limparFazendas();
        fazendaSelect.disabled = true;
      }
    });
  }
}

// Atualizar o evento de salvar para incluir a fazenda
saveSampleBtn.addEventListener('click', async () => {
  if (!checkAuth()) return;
  
  if (!sampleForm.checkValidity()) {
    sampleForm.reportValidity();
    return;
  }

  const inputs = sampleForm.querySelectorAll('input, select');
  const produtorSelect = document.getElementById('produtorSelect');
  const fazendaSelect = document.getElementById('fazendaSelect');

  const checkboxes = document.querySelectorAll(".parametro-checkbox:checked");

  const parametrosSolicitados = Array.from(checkboxes).map(cb => ({
    id: cb.value,
    nome: cb.dataset.nome,
    unidade: cb.dataset.unidade,
    tipo: cb.dataset.tipo
  }));
  
  if (!produtorSelect || !produtorSelect.value) {
    showError('Por favor, selecione um produtor', 'Campo Obrigatório');
    return;
  }

  if (parametrosSolicitados.length == 0) {
    showError('É necessário que a amostra tenha ao menos 1 parâmetro a ser analisado', 'Campo Obrigatório');
    return;
  }

  if (!usuarioLogado) {
    showError('Não foi possível obter dados do usuário', 'Erro de Autenticação');
    return;
  }

  const origem = `${produtorSelect.options[produtorSelect.selectedIndex].text} - ${fazendaSelect.options[fazendaSelect.selectedIndex].text}`;

  const novaAmostra = {
    dataColeta: inputs[1].value,
    idProdutor: produtorSelect.value,
    idFazenda: fazendaSelect?.value || '',
    origem,
    cultura: inputs[4].value,
    especie: inputs[5].value,
    status: 'Pendente',
    idInstituicao: usuarioLogado.instituicaoEscolhida.id,
    idUsuario: usuarioLogado.id,
    parametrosSolicitados
  };

  try {
    if (window.editIndex) {
      await salvarAmostra(novaAmostra, window.editIndex);
      window.editIndex = null;
      showSuccess('Amostra atualizada com sucesso!', 'Atualização Concluída');
    } else {
      await salvarAmostra(novaAmostra);
      showSuccess('Amostra criada com sucesso!', 'Amostra Salva');
    }

    await carregarAmostras();
    sampleForm.reset();
    modal.hide();
  } catch (error) {
    console.error('Erro ao salvar amostra:', error);
  }
});

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
        linkFazendas.href = `./pages/fazendas.html?apicultor=${usuarioId}`;
    }

    // Adaptar link de Laudos para mostrar apenas os relacionados às suas amostras
    const linkLaudos = document.querySelector('a[href*="laudos.html"]');
    if (linkLaudos) {
        linkLaudos.href = `./pages/laudos.html?apicultor=${usuarioId}`;
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', async function() {
  if (checkAuth()) {
    usuarioLogado = await getUser();

    if (usuarioLogado && usuarioLogado.instituicaoEscolhida.tipoUsuario) {
      ocultarItensMenuPorPerfil(usuarioLogado.instituicaoEscolhida.tipoUsuario);
      adaptarLinksParaApicultor(usuarioLogado.instituicaoEscolhida.tipoUsuario, usuarioLogado.id);
    }

    await carregarProdutores('filter-produtores');
    await carregarFazendasFiltro();
    configurarFiltros(); // Configurar os listeners dos filtros
    carregarCardsAmostras();
    carregarAmostras();
    await adicionarListenerProdutor();
  }
});

window.editIndex = null;
window.editarAmostra = editarAmostra;
window.visualizarAmostra = visualizarAmostra;
window.removerAmostra = removerAmostra;
window.mudarPagina = mudarPagina;
