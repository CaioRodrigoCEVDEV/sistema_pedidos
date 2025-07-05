document.addEventListener('DOMContentLoaded', async () => {
  try {
    const resp = await fetch(`${BASE_URL}/auth/listarlogin`, { credentials: 'include' });
    if (resp.ok) {
      const user = await resp.json();
      document.getElementById('nome').value = user.usunome || '';
      document.getElementById('email').value = user.usuemail || '';
      document.getElementById('formPerfil').dataset.userId = user.usucod;
    }

    const [marcas, modelos, tipos, pecas] = await Promise.all([
      fetch(`${BASE_URL}/marcas`).then(r => r.json()),
      fetch(`${BASE_URL}/modelos`).then(r => r.json()),
      fetch(`${BASE_URL}/tipos`).then(r => r.json()),
      fetch(`${BASE_URL}/pros`).then(r => r.json()),
    ]);

    document.getElementById('perfilTotalMarcas').textContent = marcas.length;
    document.getElementById('perfilTotalModelos').textContent = modelos.length;
    document.getElementById('perfilTotalTipos').textContent = tipos.length;
    document.getElementById('perfilTotalPecas').textContent = pecas.length;
  } catch (err) {
    console.error('Erro ao carregar dados do usuário', err);
  }

});

document.getElementById('formPerfil').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = e.target.dataset.userId;
  const usunome = document.getElementById('nome').value;
  const usuemail = document.getElementById('email').value;
  const ususenha = document.getElementById('senha').value;
  try {
    const response = await fetch(`${BASE_URL}/auth/atualizarCadastro/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usunome, usuemail, ususenha }),
      credentials: 'include'
    });
    const data = await response.json();
    if (response.ok) {
      alert('Dados atualizados com sucesso!');
      document.getElementById('senha').value = '';
      window.location.href = `${BASE_URL}/painel`;
    } else {
      alert(data.error || data.mensagem || 'Erro ao atualizar dados');
    }
  } catch (err) {
    console.error('Erro ao atualizar dados', err);
    alert('Erro ao atualizar dados');
  }
});
