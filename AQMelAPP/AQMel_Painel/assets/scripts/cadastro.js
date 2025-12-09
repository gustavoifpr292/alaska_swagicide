// cadastro.js
import API_BASE_URL from '../../chave_api.js'
//const API_BASE_URL = 'http://localhost:3000';

// Sistema de Notificações
function showNotification(message, type = 'info') {
  const container = document.getElementById('notificationContainer');
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="bi bi-${getNotificationIcon(type)} me-2"></i>
      <span>${message}</span>
      <button type="button" class="btn-close btn-close-sm ms-auto" onclick="this.parentElement.parentElement.remove()"></button>
    </div>
  `;
  container.appendChild(notification);
  
  setTimeout(() => notification.classList.add('show'), 100);
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
}

function getNotificationIcon(type) {
  const icons = {
    success: 'check-circle-fill',
    error: 'exclamation-circle-fill',
    warning: 'exclamation-triangle-fill',
    info: 'info-circle-fill'
  };
  return icons[type] || 'info-circle-fill';
}

// Sistema de Loading
function showLoading(message = 'Processando...') {
  const overlay = document.getElementById('loadingOverlay');
  const text = document.getElementById('loadingText');
  text.textContent = message;
  overlay.style.display = 'flex';
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.style.display = 'none';
}

// Validação de Senha
function validarSenha(senha) {
  const forca = document.getElementById('passwordStrengthBar');
  let score = 0;
  
  if (senha.length >= 8) score += 25;
  if (/[A-Z]/.test(senha)) score += 25;
  if (/[a-z]/.test(senha)) score += 25;
  if (/[0-9]/.test(senha)) score += 15;
  if (/[^A-Za-z0-9]/.test(senha)) score += 10;
  
  // Atualizar barra de progresso
  forca.style.width = `${score}%`;
  
  if (score < 50) {
    forca.style.backgroundColor = '#dc3545';
    return { valida: false, mensagem: 'Senha muito fraca' };
  } else if (score < 75) {
    forca.style.backgroundColor = '#ffc107';
    return { valida: true, mensagem: 'Senha média' };
  } else {
    forca.style.backgroundColor = '#28a745';
    return { valida: true, mensagem: 'Senha forte' };
  }
}

// Buscar instituições disponíveis
async function buscarInstituicoes() {
  try {
    const response = await fetch(`${API_BASE_URL}/instituicoes`, {
      headers: {
        noLoginAuth: 1,
        authorized: 1,
        noPages: 1
      }
    });
    
    if (!response.ok) {
      console.log(await response.json());
      throw new Error('Erro ao buscar instituições');
    }
    
    const data = await response.json();
    return data.instituicoes;
  } catch (error) {
    console.error('Erro:', error);
    showNotification('Erro ao carregar lista de instituições', 'error');
    return [];
  }
}

// Preencher dropdown de instituições
async function preencherInstituicoes() {
  const select = document.getElementById('institution');
  
  showLoading('Carregando instituições...');
  
  try {
    const instituicoes = await buscarInstituicoes();
    
    // Limpar options existentes (exceto a primeira)
    while (select.options.length > 1) {
      select.remove(1);
    }
    
    // Adicionar instituições ao dropdown
    instituicoes.forEach(instituicao => {
      // Mostrar apenas instituições ativas
      if (instituicao.status === 'Ativa') {
        const option = document.createElement('option');
        option.value = instituicao.id;
        option.textContent = `${instituicao.nome} - ${instituicao.cidade}, ${instituicao.estado}`;
        select.appendChild(option);
      }
    });
    
    if (select.options.length === 1) {
      showNotification('Nenhuma instituição disponível para cadastro', 'warning');
    }
    
  } catch (error) {
    console.error('Erro ao carregar instituições:', error);
  } finally {
    hideLoading();
  }
}

// Enviar solicitação de cadastro
async function enviarSolicitacaoCadastro(dadosUsuario) {
  try {
    showLoading('Enviando solicitação...');
    
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dadosUsuario)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erro ao enviar solicitação');
    }

    const data = await response.json();
    showNotification('Solicitação enviada com sucesso! Aguarde a aprovação.', 'success');
    
    // Redirecionar para login após 3 segundos
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 3000);
    
    return data;
    
  } catch (error) {
    console.error('Erro no cadastro:', error);
    showNotification(error.message || 'Erro ao enviar solicitação', 'error');
    throw error;
  } finally {
    hideLoading();
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
  // Atualizar ano atual
  document.getElementById('current-year').textContent = new Date().getFullYear();
  
  // Carregar instituições
  preencherInstituicoes();
  
  // Validação de senha em tempo real
  const senhaInput = document.getElementById('password');
  if (senhaInput) {
    senhaInput.addEventListener('input', function() {
      validarSenha(this.value);
    });
  }
  
  // Validação de confirmação de senha
  const confirmarSenhaInput = document.getElementById('confirmPassword');
  if (confirmarSenhaInput) {
    confirmarSenhaInput.addEventListener('input', function() {
      const senha = document.getElementById('password').value;
      const confirmarSenha = this.value;
      
      if (confirmarSenha && senha !== confirmarSenha) {
        this.setCustomValidity('As senhas não coincidem');
      } else {
        this.setCustomValidity('');
      }
    });
  }
  
  // Submissão do formulário
  const formCadastro = document.getElementById('registerForm');
  if (formCadastro) {
    formCadastro.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Coletar dados do formulário
      const dadosUsuario = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        username: document.getElementById('username').value,
        cpf: document.getElementById('cpf').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        instituicaoRequisitada: document.getElementById('institution').value,
        tipoUsuario: document.getElementById('userType').value,
        nome: document.getElementById('firstName').value + ' ' + document.getElementById('lastName').value
      };
      
      // Validações
      if (!dadosUsuario.instituicaoRequisitada) {
        showNotification('Por favor, selecione uma instituição', 'warning');
        return;
      }
      
      const validacaoSenha = validarSenha(dadosUsuario.password);
      if (!validacaoSenha.valida) {
        showNotification(validacaoSenha.mensagem, 'warning');
        return;
      }
      
      if (dadosUsuario.password !== document.getElementById('confirmPassword').value) {
        showNotification('As senhas não coincidem', 'warning');
        return;
      }
      
      // Enviar solicitação
      try {
        await enviarSolicitacaoCadastro(dadosUsuario);
      } catch (error) {
        // Erro já tratado na função
      }
    });
  }
});