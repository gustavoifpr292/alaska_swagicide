import API_BASE_URL from '../../../chave_api.js'

document.addEventListener('DOMContentLoaded', () => {
  //const API_BASE_URL = 'http://localhost:3000';
  let usuarioLogado = null;

  let loadingCount = 0;
  let currentLoadingMessage = '';

  // Elementos DOM
  const editProfileForm = document.querySelector('form[role="form"]');
  const changePasswordForm = document.querySelectorAll('form[role="form"]')[1];
  const notificationSettingsForm = document.querySelector('.card-body.p-3');
  const saveProfileBtn = editProfileForm?.querySelector('button[type="button"]');
  const savePasswordBtn = changePasswordForm?.querySelector('button[type="button"]');
  const saveNotificationsBtn = notificationSettingsForm?.querySelector('button[type="button"]');
  const profilePhotoBtn = document.querySelector('.btn.btn-sm.bg-gradient-primary.me-2.mb-0');
  const removePhotoBtn = document.querySelector('.btn.btn-sm.bg-gradient-secondary.mb-0');
  
  // Elementos de Loading
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.querySelector('.loading-text');
  const progressFill = document.querySelector('.progress-fill');

  // === SISTEMA DE NOTIFICAÇÕES (Igual ao analisesNew.js) ===
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

  // === SISTEMA DE LOADING (Igual ao analisesNew.js) ===
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
    hideLoading();
    localStorage.removeItem('token');
    showError('Sua sessão expirou. Redirecionando para login...', 'Sessão Expirada');
    setTimeout(() => {
      window.location.href = '../pages/login.html';
    }, 2000);
  }

  async function getUser() {
    try {
      const response = await fetch(`${API_BASE_URL}/profile`, {
        headers: getAuthHeaders()
      });

      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar dados do usuário');
      }
      
      updateLoadingText('Processando informações...');
      const user = await response.json();
      return user;
    } catch (err) {
      console.error('Erro ao carregar dados do usuário:', err);
      hideLoading();
      showError('Não foi possível carregar os dados do perfil', 'Erro de Carregamento');
    }
  }

  function trocaUsuario(tipoUsuario) {
    if (tipoUsuario === 'Apicultor') return "Produtor";
    else if (tipoUsuario === 'Pesquisador') return "Analista";

    return tipoUsuario;
  }


  // === FUNÇÕES PARA PERFIL ===
  async function carregarDadosUsuario(usuario) {
    if (!checkAuth()) return;
    
    showLoading('Carregando dados do perfil...');
    
    try {
      preencherDadosPerfil(usuario);
      hideLoading();
      showSuccess('Perfil carregado com sucesso!', 'Dados Carregados');
      
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
      hideLoading();
      showError('Não foi possível carregar os dados do perfil', 'Erro de Carregamento');
    }
  }

  function preencherDadosPerfil(usuario) {
    // Preencher informações do perfil
    const nomeElement = document.querySelector('h5.mt-3.mb-1');
    const cargoElement = document.querySelector('.text-sm.text-secondary.mb-0');
    
    if (nomeElement) {
      nomeElement.textContent = `${usuario.nome || ''} ${usuario.sobrenome || ''}`.trim() || 'Usuário';
    }
    
    if (cargoElement) {
      cargoElement.textContent = trocaUsuario(usuario.instituicaoEscolhida.tipoUsuario) || 'Não informado';
    }
    
    // Preencher dados de registro
    const registroElement = document.querySelector('.d-flex.justify-content-between div:first-child p.text-sm.text-secondary.mb-0');
    const ultimoAcessoElement = document.querySelector('.d-flex.justify-content-between div:last-child p.text-sm.text-secondary.mb-0');
    
    if (registroElement) {
      registroElement.textContent = usuario.dataCriacao ? formatarData(usuario.dataCriacao) : 'Não informado';
    }
    
    if (ultimoAcessoElement) {
      ultimoAcessoElement.textContent = usuario.ultimoAcesso ? formatarDataHora(usuario.ultimoAcesso) : 'Não informado';
    }

    // Preencher formulário de edição
    if (editProfileForm) {
      const inputs = editProfileForm.querySelectorAll('input');
      if (inputs[0]) inputs[0].value = usuario.nome || '';
      if (inputs[1]) inputs[1].value = usuario.sobrenome || '';
      if (inputs[2]) inputs[2].value = usuario.email || '';
      if (inputs[3]) inputs[3].value = usuario.instituicao || '';
      if (inputs[4]) inputs[4].value = usuario.cargo || '';
      if (inputs[5]) inputs[5].value = usuario.telefone || '';
      if (inputs[6]) inputs[6].value = usuario.endereco || '';
      if (inputs[7]) inputs[7].value = usuario.cidade || '';
      if (inputs[8]) inputs[8].value = usuario.estado || '';
      if (inputs[9]) inputs[9].value = usuario.cep || '';
    }

    // Preencher configurações de notificação (se existirem)
    if (usuario.configNotificacoes) {
      const notifyEmail = document.getElementById('notifyEmail');
      const notifyAnalysis = document.getElementById('notifyAnalysis');
      const notifyReports = document.getElementById('notifyReports');
      const notifySystem = document.getElementById('notifySystem');

      if (notifyEmail && usuario.configNotificacoes.email !== undefined) {
        notifyEmail.checked = usuario.configNotificacoes.email;
      }
      if (notifyAnalysis && usuario.configNotificacoes.analises !== undefined) {
        notifyAnalysis.checked = usuario.configNotificacoes.analises;
      }
      if (notifyReports && usuario.configNotificacoes.laudos !== undefined) {
        notifyReports.checked = usuario.configNotificacoes.laudos;
      }
      if (notifySystem && usuario.configNotificacoes.sistema !== undefined) {
        notifySystem.checked = usuario.configNotificacoes.sistema;
      }
    }
  }

  async function salvarDadosPerfil() {
    if (!checkAuth() || !usuarioLogado) return;
    
    if (!editProfileForm.checkValidity()) {
      editProfileForm.reportValidity();
      return;
    }

    showLoading('Salvando alterações do perfil...');
    
    const inputs = editProfileForm.querySelectorAll('input');
    const dadosAtualizados = {
      nome: inputs[0].value,
      sobrenome: inputs[1].value,
      email: inputs[2].value,
      instituicao: inputs[3].value,
      cargo: inputs[4].value,
      telefone: inputs[5].value,
      endereco: inputs[6].value,
      cidade: inputs[7].value,
      estado: inputs[8].value,
      cep: inputs[9].value
    };

    try {
      const response = await fetch(`${API_BASE_URL}/changeInfo/${usuarioLogado.id}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(dadosAtualizados)
      });

      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao atualizar perfil');
      }

      hideLoading();
      showSuccess('Perfil atualizado com sucesso!', 'Perfil Salvo');
      
      // Atualizar dados locais
      Object.assign(usuarioLogado, dadosAtualizados);
      preencherDadosPerfil(usuarioLogado);
      
      localStorage.setItem('token', (await response.json()).token);
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      hideLoading();
      showError(error.message || 'Erro ao atualizar perfil', 'Erro de Salvamento');
    }
  }

  async function alterarSenha() {
    if (!checkAuth() || !usuarioLogado) return;
    
    if (!changePasswordForm.checkValidity()) {
      changePasswordForm.reportValidity();
      return;
    }

    showLoading('Alterando senha...');
    
    const inputs = changePasswordForm.querySelectorAll('input');
    const senhaAtual = inputs[0].value;
    const senhaNova = inputs[1].value;
    const confirmarSenha = inputs[2].value;

    // Validações
    if (!senhaAtual || !senhaNova || !confirmarSenha) {
      hideLoading();
      showError('Por favor, preencha todos os campos', 'Campos Obrigatórios');
      return;
    }

    if (senhaNova !== confirmarSenha) {
      hideLoading();
      showError('As senhas não coincidem', 'Validação de Senha');
      return;
    }

    if (senhaNova.length < 6) {
      hideLoading();
      showError('A nova senha deve ter pelo menos 6 caracteres', 'Senha Fraca');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/changePassword/${usuarioLogado.id}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          senhaAtual: senhaAtual,
          senhaNova: senhaNova
        })
      });

      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao alterar senha');
      }

      hideLoading();
      showSuccess('Senha alterada com sucesso!', 'Segurança Atualizada');
      changePasswordForm.reset();
      
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      hideLoading();
      showError(error.message || 'Erro ao alterar senha', 'Erro de Segurança');
    }
  }

  async function salvarConfiguracoesNotificacao() {
    if (!checkAuth() || !usuarioLogado) return;
    
    showLoading('Salvando configurações...');
    
    const notifyEmail = document.getElementById('notifyEmail').checked;
    const notifyAnalysis = document.getElementById('notifyAnalysis').checked;
    const notifyReports = document.getElementById('notifyReports').checked;
    const notifySystem = document.getElementById('notifySystem').checked;

    const configNotificacoes = {
      email: notifyEmail,
      analises: notifyAnalysis,
      laudos: notifyReports,
      sistema: notifySystem
    };

    try {
      const response = await fetch(`${API_BASE_URL}/changeInfo/${usuarioLogado.id}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          configNotificacoes: configNotificacoes
        })
      });

      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao salvar configurações');
      }

      hideLoading();
      showSuccess('Configurações de notificação salvas!', 'Preferências Atualizadas');
      
      // Atualizar dados locais
      if (!usuarioLogado.configNotificacoes) {
        usuarioLogado.configNotificacoes = {};
      }
      Object.assign(usuarioLogado.configNotificacoes, configNotificacoes);
      
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      hideLoading();
      showError(error.message || 'Erro ao salvar configurações', 'Erro de Configuração');
    }
  }

  function alterarFotoPerfil() {
    showLoading('Preparando upload de foto...');
    
    // Simular processo de upload
    setTimeout(() => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          showLoading('Processando imagem...', true);
          
          // Simular upload
          setTimeout(() => {
            hideLoading();
            showInfo('Funcionalidade de upload de foto será implementada em breve', 'Upload de Foto');
          }, 2000);
        } else {
          hideLoading();
        }
      };
      
      input.click();
      hideLoading();
    }, 500);
  }

  function removerFotoPerfil() {
    if (confirm('Tem certeza que deseja remover a foto do perfil?')) {
      showLoading('Removendo foto...');
      
      // Simular remoção
      setTimeout(() => {
        hideLoading();
        showSuccess('Foto removida com sucesso!', 'Foto do Perfil');
        // Aqui você atualizaria a imagem para uma padrão
      }, 1000);
    }
  }

  // === FUNÇÕES AUXILIARES ===
  function formatarData(dataString) {
    if (!dataString) return 'Não informado';
    
    try {
      const date = new Date(dataString);
      return date.toLocaleDateString('pt-BR');
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return dataString;
    }
  }

  function formatarDataHora(dataString) {
    if (!dataString) return 'Não informado';
    
    try {
      const date = new Date(dataString);
      return date.toLocaleString('pt-BR');
    } catch (error) {
      console.error('Erro ao formatar data/hora:', error);
      return dataString;
    }
  }

  // === EVENT LISTENERS ===
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', salvarDadosPerfil);
  }

  if (savePasswordBtn) {
    savePasswordBtn.addEventListener('click', alterarSenha);
  }

  if (saveNotificationsBtn) {
    saveNotificationsBtn.addEventListener('click', salvarConfiguracoesNotificacao);
  }

  if (profilePhotoBtn) {
    profilePhotoBtn.addEventListener('click', alterarFotoPerfil);
  }

  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', removerFotoPerfil);
  }

  // Permitir submit dos forms com Enter
  if (editProfileForm) {
    editProfileForm.addEventListener('submit', (e) => {
      e.preventDefault();
      salvarDadosPerfil();
    });
  }

  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      alterarSenha();
    });
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

// === FUNÇÃO PARA LOGOUT ===
async function fazerLogout() {
  if (!confirm('Tem certeza que deseja sair do sistema?')) {
    return;
  }

  showLoading('Encerrando sessão...');

  try {
    const response = await fetch(`${API_BASE_URL}/logout`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    if (response.ok) {
      // Limpar token e redirecionar mesmo se a API não responder perfeitamente
      finalizarLogout();
    } else {
      // Se houver erro na API, ainda fazemos logout localmente
      finalizarLogout();
    }
  } catch (error) {
    console.error('Erro no logout:', error);
    // Mesmo com erro, fazemos logout localmente
    finalizarLogout();
  }
}

function finalizarLogout() {
  // Limpar token do localStorage
  localStorage.removeItem('token');
  
  // Limpar qualquer outro dado de sessão se existir
  sessionStorage.clear();
  
  hideLoading();
  showSuccess('Logout realizado com sucesso!', 'Até logo!');
  
  // Redirecionar para a página de login após um breve delay
  setTimeout(() => {
    window.location.href = '../pages/login.html';
  }, 1500);
}

  // === INICIALIZAÇÃO ===
  async function inicializar() {
    if (checkAuth()) {
      const usuarioLogado = await getUser();
      if (usuarioLogado && usuarioLogado.instituicaoEscolhida.tipoUsuario) {
        ocultarItensMenuPorPerfil(usuarioLogado.instituicaoEscolhida.tipoUsuario);
        adaptarLinksParaApicultor(usuarioLogado.instituicaoEscolhida.tipoUsuario, usuarioLogado.id);
      }
      carregarDadosUsuario(usuarioLogado);
    }
  }

  inicializar();
  window.fazerLogout = fazerLogout;
});