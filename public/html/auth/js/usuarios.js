const params = new URLSearchParams(window.location.search);

const id = params.get("id");
const marcascod = params.get("marcascod");



// --- Dados de exemplo (substitua por fetch da sua API) ---
const usersData = [
  //popular table com os dados do modelo
  { id: 1, nome: 'Alice Silva'}
  
];

// Estado
let users = [...usersData]; // clone para manipulação local
let filtered = [...users];
// Carrega dados reais da API e atualiza users/usersData
(async function loadUsers() {
  try {
    const res = await fetch(`${BASE_URL}/usuario/listar`);
    const dados = await res.json();
    const list = Array.isArray(dados) ? dados : [];
    // atualiza arrays usados pelo resto do script
    usersData.length = 0;
    usersData.push(...list);
    users = [...usersData];
    filtered = [...users];
    doSearch(searchInput ? searchInput.value : '');
  } catch (err) {
    console.error('Failed to load users:', err);
  }
})();

// Elementos
const tbody = document.getElementById('usersTbody');
const searchInput = document.getElementById('searchInput');
const resultsInfo = document.getElementById('resultsInfo');
const emptyState = document.getElementById('emptyState');

const userModalEl = document.getElementById('userModal');
const userModal = new bootstrap.Modal(userModalEl);
const userForm = document.getElementById('userForm');
const usuId = document.getElementById('usuId');
const usuNome = document.getElementById('usuNome');
const usuEmail = document.getElementById('usuEmail');
const usuSenha = document.getElementById('usuSenha');
const usuAdm = document.getElementById('usuAdm');
const togglePwd = document.getElementById('togglePwd');
const btnDelete = document.getElementById('btnDelete');
const btnNew = document.getElementById('btnNew');
const btnRefresh = document.getElementById('btnRefresh');

// Render da tabela
function renderTable(list) {
  tbody.innerHTML = '';
  if (!list.length) {
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
    for (const u of list) {
      const tr = document.createElement('tr');
      tr.dataset.usucod = u.usucod;
      tr.innerHTML = `
            <td>${u.usucod}</td>
            <td>${escapeHtml(u.usunome)}</td>
            <td>${escapeHtml(u.usuemail)}</td>
            <td>${u.usuadm ? '<span class="badge bg-success">Sim</span>' : '<span class="badge bg-secondary">Não</span>'}</td>
          `;
      tr.addEventListener('click', () => openUserModal(u.usucod));
      tbody.appendChild(tr);
    }
  }
  resultsInfo.textContent = `${list.length} usuário(s)`;
}

// Busca simples (nome, email, id)
function doSearch(term) {
  const q = term.trim().toLowerCase();
  if (!q) {
    filtered = [...users];
  } else {
    filtered = users.filter(u =>
      String(u.usucod).includes(q) ||
      u.usunome.toLowerCase().includes(q) ||
      u.usuemail.toLowerCase().includes(q)
    );
  }
  renderTable(filtered);
}

// Abrir modal preenchido
function openUserModal(usucod) {
  const u = users.find(x => x.usucod == usucod);
  if (!u) return;
  usuId.value = u.usucod;
  usuNome.value = u.usunome;
  usuEmail.value = u.usuemail;
  usuSenha.value = u.ususenha;
  usuSenha.type = 'password';
  usuAdm.checked = !!u.usuadm;
  userModal.show();
}

// Salvar (local) — substituir por chamada fetch PUT/POST para sua API
userForm.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const id = usuId.value ? Number(usuId.value) : (new Date()).getTime();
  const payload = {
    id,
    nome: usuNome.value.trim(),
    email: usuEmail.value.trim(),
    senha: usuSenha.value,
    adm: usuAdm.checked
  };

  const idx = users.findIndex(x => x.id == id);
  if (idx >= 0) {
    users[idx] = payload;
  } else {
    users.unshift(payload);
  }

  doSearch(searchInput.value);
  userModal.hide();
  // TODO: enviar payload para API (fetch)
});

// Excluir (local) — substituir por chamada DELETE para sua API
btnDelete.addEventListener('click', () => {
  const id = Number(usuId.value);
  if (!id) return;
  if (!confirm('Deseja realmente excluir este usuário?')) return;
  users = users.filter(u => u.id !== id);
  doSearch(searchInput.value);
  userModal.hide();
  // TODO: chamar DELETE na API
});

// Novo usuário
btnNew.addEventListener('click', () => {
  usuId.value = '';
  usuNome.value = '';
  usuEmail.value = '';
  usuSenha.value = '';
  usuSenha.type = 'password';
  usuAdm.checked = false;
  userModal.show();
});

// Toggle mostrar senha
togglePwd.addEventListener('click', () => {
  usuSenha.type = usuSenha.type === 'password' ? 'text' : 'password';
  togglePwd.textContent = usuSenha.type === 'password' ? '👁' : '🙈';
});

// Refresh exemplo (apenas recarrega o array local)
btnRefresh.addEventListener('click', () => {
  users = [...usersData]; // reset para dados originais (exemplo)
  doSearch(searchInput.value);
});

// Escape para evitar XSS em campos renderizados
function escapeHtml(txt = '') {
  return txt
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Eventos de busca com debounce simples
let searchTimer = null;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => doSearch(e.target.value), 180);
});

// inicializa
doSearch('');
