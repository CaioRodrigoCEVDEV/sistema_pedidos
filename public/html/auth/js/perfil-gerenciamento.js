const params = new URLSearchParams(window.location.search);
const id = params.get("id");
let marcascod = null;
let marcacodModelo = null;
let tipo = null;
let modelo = null;

function carregarMarcas() {
  fetch(`${BASE_URL}/marcas/`)
    .then(res => res.json())
    .then(marcas => {
      const marcaSelectModelo = document.getElementById('painelMarca');
      const marcaSelectPeca = document.getElementById('selectPainelMarca');
      if (marcaSelectModelo) {
        marcaSelectModelo.innerHTML = '<option value="">Selecione uma marca</option>';
      }
      if (marcaSelectPeca) {
        marcaSelectPeca.innerHTML = '<option value="">Selecione a Marca</option>';
      }
      marcas.forEach(marca => {
        const opt = `<option value="${marca.marcascod}"${id == marca.marcascod ? ' selected' : ''}>${marca.marcasdes}</option>`;
        if (marcaSelectModelo) marcaSelectModelo.innerHTML += opt;
        if (marcaSelectPeca) marcaSelectPeca.innerHTML += opt;
      });
      if (marcaSelectModelo) {
        marcaSelectModelo.addEventListener('change', e => {
          marcacodModelo = e.target.value;
        });
      }
      if (marcaSelectPeca) {
        marcaSelectPeca.addEventListener('change', e => {
          marcascod = e.target.value;
          carregarModelos(marcascod);
        });
      }
    })
    .catch(console.error);
}

function carregarModelos(codMarca) {
  fetch(`${BASE_URL}/modelo/${codMarca}`)
    .then(res => res.json())
    .then(modelos => {
      const holder = document.getElementById('selectPainelModelo');
      if (!holder) return;
      holder.innerHTML = '<option value="">Selecione o Modelo</option>';
      modelos.forEach(mod => {
        holder.innerHTML += `<option value="${mod.modcod}">${mod.moddes}</option>`;
      });
      holder.addEventListener('change', e => {
        modelo = e.target.value;
      });
    })
    .catch(console.error);
}

function carregarTipos() {
  fetch(`${BASE_URL}/tipos/`)
    .then(res => res.json())
    .then(tipos => {
      const holder = document.getElementById('selectPainelTipo');
      if (!holder) return;
      holder.innerHTML = '<option value="">Selecione o tipo</option>';
      tipos.forEach(t => {
        holder.innerHTML += `<option value="${t.tipocod}">${t.tipodes}</option>`;
      });
      holder.addEventListener('change', e => {
        tipo = e.target.value;
      });
    })
    .catch(console.error);
}

document.addEventListener('DOMContentLoaded', () => {
  carregarMarcas();
  carregarTipos();
});

function postJSON(url, data) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => res.json());
}

const formMarca = document.getElementById('cadastrarPainelMarca');
if (formMarca) {
  formMarca.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formMarca).entries());
    postJSON(`${BASE_URL}/marcas`, data)
      .then(() => { alert('Dados salvos com sucesso!'); location.reload(); })
      .catch(err => { alert('Erro ao salvar os dados.'); console.error(err); });
  });
}

const formModelo = document.getElementById('cadastrarPainelModelo');
if (formModelo) {
  formModelo.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formModelo).entries());
    data.modmarcascod = marcacodModelo;
    postJSON(`${BASE_URL}/modelo`, data)
      .then(() => { alert('Dados salvos com sucesso!'); location.reload(); })
      .catch(err => { alert('Erro ao salvar os dados.'); console.error(err); });
  });
}

const formTipo = document.getElementById('cadastrarPainelTipo');
if (formTipo) {
  formTipo.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formTipo).entries());
    postJSON(`${BASE_URL}/tipo`, data)
      .then(() => { alert('Dados salvos com sucesso!'); location.reload(); })
      .catch(err => { alert('Erro ao salvar os dados.'); console.error(err); });
  });
}

const formPeca = document.getElementById('cadastrarPainelPeca');
if (formPeca) {
  formPeca.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formPeca).entries());
    data.promarcascod = marcascod;
    data.promodcod = modelo;
    data.protipocod = tipo;
    postJSON(`${BASE_URL}/pro`, data)
      .then(() => { alert('Dados salvos com sucesso!'); location.reload(); })
      .catch(err => { alert('Erro ao salvar os dados.'); console.error(err); });
  });
}
