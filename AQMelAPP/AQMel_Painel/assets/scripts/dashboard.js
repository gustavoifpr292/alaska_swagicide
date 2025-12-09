import API_BASE_URL from '../../../chave_api.js'

document.addEventListener('DOMContentLoaded', () => {
  //const API_BASE_URL = 'http://localhost:3000';
  let dadosDashboard = {};
  let usuarioLogado = null;
  let chartBees = null;
  let chartStatus = null;

  // === SISTEMA DE NOTIFICAÇÕES ===
  function showNotification({ title, message, type = 'info', duration = 5000 } = {}) {
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

  // === SISTEMA DE LOADING ===
  let loadingCount = 0;
  let currentLoadingMessage = '';
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.querySelector('.loading-text');
  const progressFill = document.querySelector('.progress-fill');

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

  function getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    };
  }

  function handleAuthError() {
    destruirGraficos();
    hideLoading();
    localStorage.removeItem('token');
    showError('Sua sessão expirou. Redirecionando para login...', 'Sessão Expirada');
    setTimeout(() => {
      window.location.href = '../pages/login.html';
    }, 2000);
  }

  // === FUNÇÕES PRINCIPAIS DO DASHBOARD ===
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

  async function fetchDashboardData() {
    if (!checkAuth()) return {};
    
    showLoading('Carregando dashboard...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard`, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) {
        handleAuthError();
        return {};
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar dados do dashboard');
      }
      
      updateLoadingText('Processando dados...');
      const dados = await response.json();
      return dados;
      
    } catch (error) {
      console.error('Erro:', error);
      showError('Não foi possível carregar o dashboard', 'Erro de Conexão');
      return {};
    } finally {
      hideLoading();
    }
  }

  function atualizarCards(dados) {
    const cards = dados.cards?.estatisticasGerais || {};
    
    // Card: Amostras Hoje
    const cardAmostras = document.querySelector('.col-xl-3.col-sm-6.mb-xl-0.mb-4');
    if (cardAmostras) {
      const amostrasHoje = cards.analisesHoje || 0;
      cardAmostras.querySelector('h4.mb-0').textContent = amostrasHoje;
      
      // Atualizar tendência
      const trendElement = cardAmostras.querySelector('.text-success, .text-danger');
      if (trendElement) {
        const isPositive = amostrasHoje > 12;
        trendElement.textContent = isPositive ? '+12% que ontem' : '-5% que ontem';
        trendElement.className = isPositive ? 'text-success font-weight-bolder' : 'text-danger font-weight-bolder';
      }
    }

    // Card: Análises Pendentes
    const cardAnalises = document.querySelectorAll('.col-xl-3.col-sm-6.mb-xl-0.mb-4')[1];
    if (cardAnalises) {
      const analisesPendentes = cards.analisesPendentes || 0;
      cardAnalises.querySelector('h4.mb-0').textContent = analisesPendentes;
      
      const trendElement = cardAnalises.querySelector('.text-success, .text-danger');
      if (trendElement) {
        const isPositive = analisesPendentes < 15;
        trendElement.textContent = isPositive ? '-5% que semana passada' : '+10% que semana passada';
        trendElement.className = isPositive ? 'text-success font-weight-bolder' : 'text-danger font-weight-bolder';
      }
    }

    // Card: Laudos Emitidos
    const cardLaudos = document.querySelectorAll('.col-xl-3.col-sm-6.mb-xl-0.mb-4')[2];
    if (cardLaudos) {
      const laudosEmitidos = cards.laudos || 0;
      cardLaudos.querySelector('h4.mb-0').textContent = laudosEmitidos;
      
      const trendElement = cardLaudos.querySelector('.text-success, .text-danger');
      if (trendElement) {
        trendElement.textContent = '+30% que mês passado';
        trendElement.className = 'text-success font-weight-bolder';
      }
    }

    // 🎯 CARDS ESPECÍFICOS POR PERFIL
    atualizarCardsEspecificos(dados);
  }

  function atualizarCardsEspecificos(dados) {
    const perfil = dados.perfil;
    const cardsEspecificos = dados.cards;

    switch (perfil) {
      case 'Pesquisador':
        adicionarCardPesquisador(cardsEspecificos);
        break;
      case 'Coordenador':
        adicionarCardCoordenador(cardsEspecificos);
        break;
      case 'Administrador':
        adicionarCardAdministrador(cardsEspecificos);
        break;
    }
  }

  function adicionarCardPesquisador(cards) {
    if (cards.analisesPendentes > 0) {
      const novoCardHTML = `
        <div class="col-xl-3 col-sm-6 mb-xl-0 mb-4">
          <div class="card">
            <div class="card-header p-2 ps-3">
              <div class="d-flex justify-content-between">
                <div>
                  <p class="text-sm mb-0 text-capitalize">Minhas Pendentes</p>
                  <h4 class="mb-0">${cards.analisesPendentes}</h4>
                </div>
                <div class="icon icon-md icon-shape bg-gradient-warning shadow-warning shadow text-center border-radius-lg">
                  <i class="material-symbols-rounded opacity-10">assignment</i>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      const containerCards = document.querySelector('.row:first-child');
      if (containerCards && !document.getElementById('card-pesquisador')) {
        const div = document.createElement('div');
        div.innerHTML = novoCardHTML;
        div.firstElementChild.id = 'card-pesquisador';
        containerCards.appendChild(div.firstElementChild);
      }
    }
  }

  function adicionarCardCoordenador(cards) {
    if (cards.pedidosPendentes > 0) {
      const novoCardHTML = `
        <div class="col-xl-3 col-sm-6 mb-xl-0 mb-4">
          <div class="card">
            <div class="card-header p-2 ps-3">
              <div class="d-flex justify-content-between">
                <div>
                  <p class="text-sm mb-0 text-capitalize">Pedidos Pendentes</p>
                  <h4 class="mb-0">${cards.pedidosPendentes}</h4>
                </div>
                <div class="icon icon-md icon-shape bg-gradient-info shadow-info shadow text-center border-radius-lg">
                  <i class="material-symbols-rounded opacity-10">person_add</i>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      const containerCards = document.querySelector('.row:first-child');
      if (containerCards && !document.getElementById('card-coordenador')) {
        const div = document.createElement('div');
        div.innerHTML = novoCardHTML;
        div.firstElementChild.id = 'card-coordenador';
        containerCards.appendChild(div.firstElementChild);
      }
    }
  }

  function adicionarCardAdministrador(cards) {
    if (cards.instituicoesAtivas > 0) {
      const novoCardHTML = `
        <div class="col-xl-3 col-sm-6 mb-xl-0 mb-4">
          <div class="card">
            <div class="card-header p-2 ps-3">
              <div class="d-flex justify-content-between">
                <div>
                  <p class="text-sm mb-0 text-capitalize">Instituições Ativas</p>
                  <h4 class="mb-0">${cards.instituicoesAtivas}</h4>
                </div>
                <div class="icon icon-md icon-shape bg-gradient-success shadow-success shadow text-center border-radius-lg">
                  <i class="material-symbols-rounded opacity-10">business</i>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      const containerCards = document.querySelector('.row:first-child');
      if (containerCards && !document.getElementById('card-admin')) {
        const div = document.createElement('div');
        div.innerHTML = novoCardHTML;
        div.firstElementChild.id = 'card-admin';
        containerCards.appendChild(div.firstElementChild);
      }
    }
  }

  function atualizarTabelaRecentes(dados) {
    const tabela = document.querySelector('.table tbody');
    if (!tabela || !dados.recentes) return;

    // Limpar tabela atual
    tabela.innerHTML = '';

    // 🎯 DADOS RECENTES POR PERFIL
    let dadosRecentes = [];

    switch (dados.perfil) {
      case 'Apicultor':
        dadosRecentes = dados.recentes.amostras || [];
        break;
      case 'Pesquisador':
        dadosRecentes = dados.recentes.analises || [];
        break;
      case 'Coordenador':
      case 'Administrador':
        dadosRecentes = dados.recentes.amostras || [];
        break;
    }

    // Preencher com dados reais
    dadosRecentes.slice(0, 3).forEach(item => {
      const linha = criarLinhaTabela(item, dados.perfil);
      tabela.appendChild(linha);
    });

    // Se não houver dados, mostrar mensagem
    if (dadosRecentes.length === 0) {
      tabela.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-4">
            <i class="material-symbols-rounded text-muted mb-2" style="font-size: 3rem;">inbox</i>
            <p class="text-muted mb-0">Nenhum dado recente encontrado</p>
          </td>
        </tr>
      `;
    }
  }

  function criarLinhaTabela(item, perfil) {
    const tr = document.createElement('tr');
    
    if (item.id && item.id.includes('AM-')) {
      // É uma amostra
      tr.innerHTML = `
        <td>
          <div class="d-flex px-2 py-1">
            <div class="d-flex flex-column justify-content-center">
              <h6 class="mb-0 text-sm">${item.id}</h6>
            </div>
          </div>
        </td>
        <td>
          <p class="text-sm font-weight-bold mb-0">${item.origem || 'Não informado'}</p>
        </td>
        <td class="align-middle text-center text-sm">
          <span class="text-xs font-weight-bold">${item.cultura || 'Não informado'}</span>
        </td>
        <td class="align-middle text-center">
          <span class="text-secondary text-xs font-weight-bold">${formatarData(item.dataColeta)}</span>
        </td>
        <td class="align-middle text-center">
          <span class="badge badge-sm ${getBadgeClass(item.status)}">${item.status || 'Pendente'}</span>
        </td>
      `;
    } else if (item.id && item.id.includes('AN-')) {
      // É uma análise
      tr.innerHTML = `
        <td>
          <div class="d-flex px-2 py-1">
            <div class="d-flex flex-column justify-content-center">
              <h6 class="mb-0 text-sm">${item.id}</h6>
            </div>
          </div>
        </td>
        <td>
          <p class="text-sm font-weight-bold mb-0">${item.responsavel || 'Não atribuído'}</p>
        </td>
        <td class="align-middle text-center text-sm">
          <span class="text-xs font-weight-bold">${item.tipo || 'Análise'}</span>
        </td>
        <td class="align-middle text-center">
          <span class="text-secondary text-xs font-weight-bold">${formatarData(item.dataAnalisada)}</span>
        </td>
        <td class="align-middle text-center">
          <span class="badge badge-sm ${getBadgeClass(item.status)}">${item.status || 'Pendente'}</span>
        </td>
      `;
    } else {
      // Item genérico
      tr.innerHTML = `
        <td colspan="5" class="text-center text-muted">
          Dado não disponível
        </td>
      `;
    }

    return tr;
  }

  function getBadgeClass(status) {
    const classes = {
      'Laudo Emitido': 'bg-gradient-success',
      'Em Análise': 'bg-gradient-warning',
      'Pendente': 'bg-gradient-danger',
      'Concluída': 'bg-gradient-success',
      'Emitido': 'bg-gradient-success',
      'Reprovado': 'bg-gradient-danger',
      'Analisado': 'bg-gradient-info'
    };
    return classes[status] || 'bg-gradient-secondary';
  }

  function formatarData(dataString) {
    if (!dataString) return '--/--/----';
    
    try {
      const data = new Date(dataString);
      return data.toLocaleDateString('pt-BR');
    } catch {
      return dataString;
    }
  }

  function atualizarGraficos(dados) {
    // Destruir gráficos existentes antes de atualizar
    destruirGraficos();
    
    atualizarGraficoAmostrasPorCultura(dados);
    atualizarGraficoStatusAnalises(dados);
  }

  function destruirGraficos() {
    if (chartBees) {
      chartBees.destroy();
      chartBees = null;
    }
    
    if (chartStatus) {
      chartStatus.destroy();
      chartStatus = null;
    }
  }

function atualizarGraficoAmostrasPorCultura(dados) {
  const ctx = document.getElementById('chart-bees');
  if (!ctx || !dados.graficos) return;

  const dadosGrafico = dados.graficos.tipoCultura || dados.graficos.tipoAnalises || { 
    'Apicultura': 65, 
    'Meliponicultura': 35 
  };

  // Verificar se já existe um gráfico e destruir
  if (chartBees) {
    chartBees.destroy();
  }

  // Criar novo gráfico
  chartBees = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(dadosGrafico),
      datasets: [{
        data: Object.values(dadosGrafico),
        backgroundColor: ["#632D03", "#B4690F", "#FAAD27", "#FDBC48"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

function atualizarGraficoStatusAnalises(dados) {
  const ctx = document.getElementById('chart-status');
  if (!ctx || !dados.graficos) return;

  const dadosGrafico = dados.graficos.statusAnalises || {
    'Pendentes': 18,
    'Em Análise': 12,
    'Concluídas': 25,
    'Laudos Emitidos': 42
  };

  // Verificar se já existe um gráfico e destruir
  if (chartStatus) {
    chartStatus.destroy();
  }

  // Criar novo gráfico
  chartStatus = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(dadosGrafico),
      datasets: [{
        label: "Quantidade",
        data: Object.values(dadosGrafico),
        backgroundColor: ["#B4690F", "#FDDA78", "#FAE1AF", "#632D03"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

  function limparRecursos() {
    destruirGraficos();
  }
  
  window.addEventListener('beforeunload', limparRecursos);
  window.addEventListener('unload', limparRecursos);

  function atualizarAlertas(dados) {
    const alertasContainer = document.querySelector('.dropdown-menu.dropdown-menu-end');
    if (!alertasContainer || !dados.alertas) return;

    // Limpar alertas existentes (mantendo apenas os exemplos fixos)
    const alertasExistentes = alertasContainer.querySelectorAll('li');
    alertasExistentes.forEach((alerta, index) => {
      if (index >= 2) { // Manter os 2 primeiros (exemplos)
        alerta.remove();
      }
    });

    // Adicionar alertas dinâmicos
    dados.alertas.forEach((alerta, index) => {
      if (index < 2) { // Limitar a 2 alertas no dropdown
        const alertaHTML = criarAlertaHTML(alerta);
        alertasContainer.insertAdjacentHTML('afterbegin', alertaHTML);
      }
    });
  }

  function criarAlertaHTML(alerta) {
    const icones = {
      'warning': 'warning',
      'info': 'info',
      'success': 'check_circle',
      'danger': 'error'
    };

    return `
      <li class="mb-2">
        <a class="dropdown-item border-radius-md" href="javascript:;">
          <div class="d-flex py-1">
            <div class="my-auto">
              <i class="material-symbols-rounded text-${alerta.tipo} me-3">${icones[alerta.tipo] || 'notifications'}</i>
            </div>
            <div class="d-flex flex-column justify-content-center">
              <h6 class="text-sm font-weight-normal mb-1">
                <span class="font-weight-bold">${alerta.mensagem}</span>
              </h6>
              <p class="text-xs text-secondary mb-0">
                <i class="fa fa-clock me-1"></i>
                Agora
              </p>
            </div>
          </div>
        </a>
      </li>
    `;
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

    // Resetar todos os itens primeiro
    Object.values(itensMenu).forEach(item => {
        if (item) item.style.display = 'list-item';
    });

    // Aplicar regras por tipo de usuário
    switch(tipoUsuario) {
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
            // Administrador vê tudo - não oculta nada
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

    if (todosOcultos || usuarioLogado.instituicaoEscolhida.tipoUsuario === 'Apicultor') {
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
  async function carregarDashboard() {
    if (!checkAuth()) return;
    
    try {
      showLoading('Carregando dashboard...', true);

      // Carregar usuário primeiro
      usuarioLogado = await getUser();
      if (!usuarioLogado) {
        throw new Error('Não foi possível carregar dados do usuário');
      }

      // Configurar menu baseado no perfil
      if (usuarioLogado.instituicaoEscolhida?.tipoUsuario) {
        ocultarItensMenuPorPerfil(usuarioLogado.instituicaoEscolhida.tipoUsuario);
        adaptarLinksParaApicultor(usuarioLogado.instituicaoEscolhida.tipoUsuario, usuarioLogado.id);
      }

      // Carregar dados do dashboard
      updateLoadingText('Buscando dados atualizados...');
      dadosDashboard = await fetchDashboardData();

      if (Object.keys(dadosDashboard).length > 0) {
        // Atualizar interface com dados reais
        atualizarCards(dadosDashboard);
        atualizarTabelaRecentes(dadosDashboard);
        atualizarGraficos(dadosDashboard);
        atualizarAlertas(dadosDashboard);
        
        showSuccess('Dashboard atualizado com sucesso!', 'Bem-vindo');
      } else {
        showWarning('Alguns dados podem estar indisponíveis', 'Atenção');
      }
      
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      showError('Erro ao carregar o dashboard', 'Erro de Inicialização');
    } finally {
      hideLoading();
    }
  }

  // Configurar atualização automática
  function configurarAtualizacaoAutomatica() {
    // Atualiza a cada 2 minutos
    setInterval(() => {
      if (isAuthenticated()) {
        carregarDashboard();
      }
    }, 120000);
  }

  // Inicializar quando a página carregar
  if (checkAuth()) {
    carregarDashboard();
    configurarAtualizacaoAutomatica();
  }
});