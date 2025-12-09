import API_BASE_URL from '../../../chave_api.js'

document.addEventListener('DOMContentLoaded', () => {
  //const API_BASE_URL = 'http://localhost:3000';
  let parametros = [];
  let editIndex = null;
  let user = null;

  // Elementos DOM
  const parametrosForm = document.getElementById('parameterForm');
  const saveParameterBtn = document.getElementById('saveParameterBtn');
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('newParameterModal'));
  const tbodyFisicoQuimica = document.querySelector('#fisico-quimica tbody');
  const tbodyMicrobiologicos = document.querySelector('#microbiologicos tbody');
  const tbodySensoriais = document.querySelector('#sensoriais tbody');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.querySelector('.loading-text');
  const progressFill = document.querySelector('.progress-fill');

  // === SISTEMA DE NOTIFICAÇÕES (igual ao da revisão de laudos) ===

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
    loadingText.textContent = message;
    if (isLongOperation) {
      loadingOverlay.classList.add('long-operation');
    } else {
      loadingOverlay.classList.remove('long-operation');
    }
    loadingOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function hideLoading() {
    loadingOverlay.classList.remove('show');
    document.body.style.overflow = '';
    progressFill.style.animation = 'none';
    setTimeout(() => {
      progressFill.style.animation = '';
    }, 10);
  }

  function updateLoadingText(message) {
    loadingText.textContent = message;
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

  // === FUNÇÕES DA API ===

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

  async function fetchParametros() {
    if (!checkAuth()) return [];
    
    showLoading('Carregando parâmetros...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/parametros/`, {
        headers: getAuthHeaders("parametros")
      });
      
      if (response.status === 401) {
        handleAuthError();
        return [];
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar parâmetros');
      }
      
      updateLoadingText('Processando dados...');
      const dados = await response.json();
      hideLoading();
      return dados;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Não foi possível carregar os parâmetros', 'Erro de Conexão');
      return [];
    }
  }

  async function salvarParametro(parametro, id = null) {
    if (!checkAuth()) return;
    
    showLoading(id ? 'Atualizando parâmetro...' : 'Salvando parâmetro...');
    
    try {
      const url = id ? `${API_BASE_URL}/parametros/${id}` : `${API_BASE_URL}/parametros/`;
      const method = id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: getAuthHeaders("parametros"),
        body: JSON.stringify(parametro)
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao salvar parâmetro');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao salvar parâmetro', 'Erro de Salvamento');
      throw error;
    }
  }

  async function excluirParametroAPI(id) {
    if (!checkAuth()) return;
    
    showLoading('Excluindo parâmetro...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/parametros/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders('parametros')
      });
      
      if (response.status === 401) {
        handleAuthError();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao excluir parâmetro');
      }
      
      const resultado = await response.json();
      hideLoading();
      return resultado;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError(error.message || 'Erro ao excluir parâmetro', 'Erro de Exclusão');
      throw error;
    }
  }

  async function buscarParametroPorId(id) {
    if (!checkAuth()) return null;
    
    showLoading('Carregando parâmetro...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/parametros/${id}`, {
        headers: getAuthHeaders('parametros')
      });
      
      if (response.status === 401) {
        handleAuthError();
        return null;
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar parâmetro');
      }
      
      const parametro = await response.json();
      hideLoading();
      return parametro;
      
    } catch (error) {
      console.error('Erro:', error);
      hideLoading();
      showError('Erro ao carregar parâmetro', 'Erro de Carregamento');
      return null;
    }
  }

  // === FUNÇÕES DE RENDERIZAÇÃO ===

  async function carregarParametros() {
    if (!checkAuth()) return;
    
    try {
      parametros = await fetchParametros();
      renderizarParametros();
      
      if (parametros.length > 0) {
        showSuccess(`${parametros.length} parâmetros carregados com sucesso!`, 'Dados Carregados');
      } else {
        showWarning('Nenhum parâmetro foi encontrado', 'Sem Dados');
      }
    } catch (error) {
      console.error('Erro ao carregar parâmetros:', error);
    }
  }

  function renderizarParametros() {
    // Limpar tabelas
    tbodyFisicoQuimica.innerHTML = '';
    tbodyMicrobiologicos.innerHTML = '';
    tbodySensoriais.innerHTML = '';

    if (parametros.length === 0) {
      const emptyRow = `
        <tr>
          <td colspan="5" class="text-center py-4">
            <i class="material-symbols-rounded text-muted mb-2" style="font-size: 3rem;">tune</i>
            <p class="text-muted mb-0">Nenhum parâmetro encontrado</p>
          </td>
        </tr>
      `;
      tbodyFisicoQuimica.innerHTML = emptyRow;
      tbodyMicrobiologicos.innerHTML = emptyRow;
      tbodySensoriais.innerHTML = emptyRow;
      return;
    }

    parametros.forEach((parametro) => {
      const tr = document.createElement('tr');
      
      let tabelaAlvo;
      switch(parametro.tipo) {
        case 'Físico-Químico':
          tabelaAlvo = tbodyFisicoQuimica;
          break;
        case 'Microbiológico':
          tabelaAlvo = tbodyMicrobiologicos;
          break;
        case 'Sensorial':
          tabelaAlvo = tbodySensoriais;
          break;
        default:
          tabelaAlvo = tbodyFisicoQuimica;
      }

      // HTML diferente para sensoriais
      if (parametro.tipo === 'Sensorial') {
        tr.innerHTML = `
          <td>
            <div class="d-flex px-2 py-1">
              <div class="d-flex flex-column justify-content-center">
                <h6 class="mb-0 text-sm">${parametro.nome}</h6>
              </div>
            </div>
          </td>
          <td>
            <div class="d-flex flex-column justify-content-center">
              <p class="text-sm font-weight-bold mb-0">${parametro.descricao || '-'}</p>
            </div>
          </td>
          <td class="align-middle text-center">
            <a href="javascript:;" class="text-secondary font-weight-bold text-xs" onclick="editarParametro('${parametro.id}')" data-toggle="tooltip" title="Editar">
              <i class="material-symbols-rounded">edit</i>
            </a>
            <a href="javascript:;" class="text-danger font-weight-bold text-xs ms-2" onclick="removerParametro('${parametro.id}')" data-toggle="tooltip" title="Excluir">
              <i class="material-symbols-rounded">delete</i>
            </a>
          </td>
        `;
      } else {
        // HTML para físico-químicos e microbiológicos
        tr.innerHTML = `
          <td>
            <div class="d-flex px-2 py-1">
              <div class="d-flex flex-column justify-content-center">
                <h6 class="mb-0 text-sm">${parametro.nome}</h6>
                ${parametro.descricao ? `<p class="text-xs text-secondary mb-0">${parametro.descricao}</p>` : ''}
              </div>
            </div>
          </td>
          <td>
            <p class="text-sm font-weight-bold mb-0">${parametro.unidade || '-'}</p>
          </td>
          <td class="align-middle text-center">
            <span class="text-secondary text-xs font-weight-bold">${parametro.valorMinimo || '-'}</span>
          </td>
          <td class="align-middle text-center">
            <span class="text-secondary text-xs font-weight-bold">${parametro.valorMaximo || '-'}</span>
          </td>
          <td class="align-middle text-center">
            <a href="javascript:;" class="text-secondary font-weight-bold text-xs" onclick="editarParametro('${parametro.id}')" data-toggle="tooltip" title="Editar">
              <i class="material-symbols-rounded">edit</i>
            </a>
            <a href="javascript:;" class="text-danger font-weight-bold text-xs ms-2" onclick="removerParametro('${parametro.id}')" data-toggle="tooltip" title="Excluir">
              <i class="material-symbols-rounded">delete</i>
            </a>
          </td>
        `;
      }

      tabelaAlvo.appendChild(tr);
    });
  }

  // === FUNÇÕES DO FORMULÁRIO ===

  function preencherFormulario(parametro) {
    document.getElementById('paramClass').value = parametro.tipo || '';
    document.getElementById('paramName').value = parametro.nome || '';
    document.getElementById('paramDescription').value = parametro.descricao || '';
    document.getElementById('paramUnit').value = parametro.unidade || '';
    document.getElementById('paramMin').value = parametro.valorMinimo || '';
    document.getElementById('paramMax').value = parametro.valorMaximo || '';
    
    adaptarFormularioPorTipo(parametro.tipo);
    
    const container = document.getElementById('referenceValuesContainer');
    container.innerHTML = '';
    
    if (parametro.valoresReferencia && parametro.valoresReferencia.length > 0) {
      parametro.valoresReferencia.forEach((valor, index) => {
        const newValue = document.createElement('div');
        newValue.className = 'input-group mb-3 reference-value';
        newValue.innerHTML = `
          <input type="text" class="form-control" value="${valor}" placeholder="Valor ou faixa">
          <button type="button" class="btn bg-gradient-danger remove-value">
            <i class="material-symbols-rounded fs-6">delete</i>
          </button>
        `;
        container.appendChild(newValue);
      });
    } else {
      const newValue = document.createElement('div');
      newValue.className = 'input-group mb-3 reference-value';
      newValue.innerHTML = `
        <input type="text" class="form-control" placeholder="Valor ou faixa">
        <button type="button" class="btn bg-gradient-danger remove-value">
          <i class="material-symbols-rounded fs-6">delete</i>
        </button>
      `;
      container.appendChild(newValue);
    }
  }

  function getDadosFormulario() {
    const referenciaValues = [];
    document.querySelectorAll('.reference-value input').forEach(input => {
      if (input.value.trim() !== '') {
        referenciaValues.push(input.value.trim());
      }
    });

    return {
      tipo: document.getElementById('paramClass').value,
      nome: document.getElementById('paramName').value,
      descricao: document.getElementById('paramDescription').value,
      unidade: document.getElementById('paramUnit').value,
      valorMinimo: document.getElementById('paramMin').value || null,
      valorMaximo: document.getElementById('paramMax').value || null,
      valoresReferencia: referenciaValues
    };
  }

  function adaptarFormularioPorTipo(tipo) {
    const unitField = document.getElementById('paramUnit');
    const minField = document.getElementById('paramMin');
    const maxField = document.getElementById('paramMax');
    const minLabel = minField.previousElementSibling;
    const maxLabel = maxField.previousElementSibling;
    const referenceSection = document.querySelector('.reference-section');
    const referenceTitle = referenceSection.querySelector('h6');
    
    switch(tipo) {
      case 'Sensorial':
        minField.closest('.col-md-4').style.display = 'none';
        maxField.closest('.col-md-4').style.display = 'none';
        unitField.placeholder = 'Ex: Categoria, Tipo, Classificação';
        unitField.value = unitField.value || 'Categoria';
        referenceTitle.textContent = 'Opções/Categorias Possíveis';
        document.querySelector('#referenceValuesContainer .form-control').placeholder = 'Ex: Âmbar claro, Floral, Líquida';
        document.querySelector('#addValueBtn').innerHTML = '<i class="material-symbols-rounded me-1 fs-6">add</i> Adicionar Opção';
        break;
        
      case 'Microbiológico':
        minField.closest('.col-md-4').style.display = 'block';
        maxField.closest('.col-md-4').style.display = 'block';
        minLabel.textContent = 'Valor Mínimo';
        maxLabel.textContent = 'Valor Máximo';
        unitField.placeholder = 'Ex: UFC/g, NMP/g';
        referenceTitle.textContent = 'Valores de Referência';
        document.querySelector('#referenceValuesContainer .form-control').placeholder = 'Valor ou faixa';
        document.querySelector('#addValueBtn').innerHTML = '<i class="material-symbols-rounded me-1 fs-6">add</i> Adicionar Valor';
        break;
        
      case 'Físico-Químico':
      default:
        minField.closest('.col-md-4').style.display = 'block';
        maxField.closest('.col-md-4').style.display = 'block';
        minLabel.textContent = 'Valor Mínimo';
        maxLabel.textContent = 'Valor Máximo';
        unitField.placeholder = 'Ex: %, mg/kg, pH';
        referenceTitle.textContent = 'Valores de Referência';
        document.querySelector('#referenceValuesContainer .form-control').placeholder = 'Valor ou faixa';
        document.querySelector('#addValueBtn').innerHTML = '<i class="material-symbols-rounded me-1 fs-6">add</i> Adicionar Valor';
        break;
    }
  }

  // === EVENT LISTENERS ===

  saveParameterBtn.addEventListener('click', async () => {
    if (!checkAuth()) return;
    
    if (!parametrosForm.checkValidity()) {
      parametrosForm.reportValidity();
      return;
    }

    const parametroData = getDadosFormulario();

    if (parametroData.valoresReferencia.length === 0) {
      showWarning('Adicione pelo menos um valor de referência!', 'Valores Obrigatórios');
      return;
    }

    parametroData['idInstituicao'] = user.instituicaoEscolhida.id;

    try {
      if (window.editIndex) {
        await salvarParametro(parametroData, window.editIndex);
        showSuccess('Parâmetro atualizado com sucesso!', 'Atualização Concluída');
        window.editIndex = null;
      } else {
        await salvarParametro(parametroData);
        showSuccess('Parâmetro criado com sucesso!', 'Parâmetro Salvo');
      }

      await carregarParametros();
      parametrosForm.reset();
      modal.hide();
      
      document.getElementById('referenceValuesContainer').innerHTML = `
        <div class="input-group mb-3 reference-value">
          <input type="text" class="form-control" placeholder="Valor ou faixa">
          <button type="button" class="btn bg-gradient-danger remove-value">
            <i class="material-symbols-rounded fs-6">delete</i>
          </button>
        </div>
      `;
    } catch (error) {
      console.error('Erro ao salvar parâmetro:', error);
    }
  });

  // Gerenciamento dinâmico dos valores de referência
  document.getElementById('addValueBtn').addEventListener('click', function() {
    const container = document.getElementById('referenceValuesContainer');
    const newValue = document.createElement('div');
    newValue.className = 'input-group mb-3 reference-value';
    newValue.innerHTML = `
      <input type="text" class="form-control" placeholder="Valor ou faixa">
      <button type="button" class="btn bg-gradient-danger remove-value">
        <i class="material-symbols-rounded fs-6">delete</i>
      </button>
    `;
    container.appendChild(newValue);
  });

  document.addEventListener('click', function(e) {
    if(e.target.classList.contains('remove-value') || e.target.closest('.remove-value')) {
      const valueElement = e.target.closest('.reference-value');
      if (valueElement && document.querySelectorAll('.reference-value').length > 1) {
        valueElement.remove();
      } else if (valueElement) {
        showWarning('É necessário pelo menos um valor de referência', 'Atenção');
      }
    }
  });

  document.getElementById('paramClass').addEventListener('change', function() {
    adaptarFormularioPorTipo(this.value);
  });

  // === FUNÇÕES GLOBAIS ===

  async function editarParametro(id) {
    if (!checkAuth()) return;
    
    try {
      const parametro = await buscarParametroPorId(id);
      if (parametro) {
        window.editIndex = id;
        preencherFormulario(parametro);
        modal.show();
        showInfo('Parâmetro carregado para edição', 'Modo Edição');
      }
    } catch (error) {
      console.error('Erro ao editar parâmetro:', error);
    }
  }

  async function removerParametro(id) {
    if (!checkAuth()) return;
    
    if (confirm("Tem certeza que deseja remover este parâmetro?")) {
      try {
        await excluirParametroAPI(id);
        await carregarParametros();
        showSuccess('Parâmetro removido com sucesso!', 'Exclusão Concluída');
      } catch (error) {
        console.error('Erro ao remover parâmetro:', error);
      }
    }
  }

  function abrirModalNovoParametro() {
    if (!checkAuth()) return;
    
    window.editIndex = null;
    parametrosForm.reset();
    adaptarFormularioPorTipo('Físico-Químico');
    
    document.getElementById('referenceValuesContainer').innerHTML = `
      <div class="input-group mb-3 reference-value">
        <input type="text" class="form-control" placeholder="Valor ou faixa">
        <button type="button" class="btn bg-gradient-danger remove-value">
          <i class="material-symbols-rounded fs-6">delete</i>
        </button>
      </div>
    `;
    
    modal.show();
    showInfo('Preencha os dados do novo parâmetro', 'Novo Parâmetro');
  }

  // Event listeners para os botões de adicionar
  document.querySelectorAll('#fisico-quimica .btn, #microbiologicos .btn, #sensoriais .btn').forEach(btn => {
    btn.addEventListener('click', abrirModalNovoParametro);
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
      user = await getUser();

      if (user && user.instituicaoEscolhida.tipoUsuario) {
        ocultarItensMenuPorPerfil(user.instituicaoEscolhida.tipoUsuario);
        adaptarLinksParaApicultor(user.instituicaoEscolhida.tipoUsuario, user.id);
      }

      showInfo('Sistema de parâmetros carregado', 'Bem-vindo');
      await carregarParametros();
    }
  }

  // Variáveis globais para os event handlers do HTML
  window.editIndex = null;
  window.editarParametro = editarParametro;
  window.removerParametro = removerParametro;

  inicializar();
});