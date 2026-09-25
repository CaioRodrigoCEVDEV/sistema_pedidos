(() => {
  async function init() {
    const form = document.getElementById('history-filters');
    if (!form || form.dataset.ready) return;
    form.dataset.ready = '1';
    const el = (id) => document.getElementById(`history-${id}`);
    const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const number = (n) => Number(n).toLocaleString('pt-BR');
    const date = (d) => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    let page = 1, filters = new URLSearchParams(), request = 0;
    async function get(url) {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(res.status === 403 ? 'Seu usuário não tem acesso ao histórico.' : 'Não foi possível carregar os dados. Tente novamente.');
      return res.json();
    }
    function description(row) {
      const items = row.itens || [];
      const details = items.map(i => [i.peca, i.cor, i.marca, ...(i.modelos || []).map(m => m.nome), i.tipo].filter(Boolean).join(' · '));
      return `<strong>${escape(row.descricao)}</strong><div class="history-meta">${row.origem === 'grupo' ? 'Estoque do grupo' : row.origem === 'cor' ? 'Estoque por cor' : 'Estoque da peça'}</div>${details.length ? `<details class="history-meta"><summary>Peças e identificação (${details.length})</summary>${details.map(d => `<div>${escape(d)}</div>`).join('')}</details>` : ''}`;
    }
    async function load() {
      const current = ++request;
      el('results').textContent = 'Carregando movimentações…';
      el('prev').disabled = el('next').disabled = true;
      el('summary').textContent = ''; el('page').textContent = '';
      try {
        const params = new URLSearchParams(filters); params.set('page', page);
        const result = await get(`/api/estoque-historico?${params}`);
        if (current !== request || !form.isConnected) return;
        el('summary').innerHTML = `<div>Movimentações<strong>${number(result.total)}</strong></div><div class="history-entry">Entradas<strong>${number(result.entradas)} un.</strong></div><div class="history-exit">Saídas<strong>${number(result.saidas)} un.</strong></div>`;
        el('note').textContent = `Registro completo a partir de ${date(result.iniciado_em)}. Anteriormente, somente o histórico disponível dos grupos. Cada movimento de grupo é contado uma vez.`;
        const rows = result.data;
        const badge = r => `<span class="${Number(r.variacao) > 0 ? 'history-entry' : 'history-exit'}">${escape(r.movimento)}</span>`;
        const balance = r => r.saldo_atual == null ? '—' : number(r.saldo_atual);
        el('results').innerHTML = rows.length ? `<div class="history-scroll"><table class="table align-middle"><thead><tr><th>Data e hora</th><th>Peça / grupo</th><th>Movimento</th><th>Quantidade</th><th>Saldo após</th></tr></thead><tbody>${rows.map(r => `<tr><td>${date(r.ocorrido_em)}</td><td>${description(r)}</td><td>${badge(r)}</td><td>${number(r.quantidade)}</td><td>${balance(r)}</td></tr>`).join('')}</tbody></table></div><div class="history-cards">${rows.map(r => `<article class="history-card"><header><small>${date(r.ocorrido_em)}</small>${badge(r)}</header>${description(r)}<div class="mt-3 d-flex justify-content-between"><strong>${number(r.quantidade)} un.</strong><span>Saldo após: ${balance(r)}</span></div></article>`).join('')}</div>` : '<p class="text-center py-4">Nenhuma movimentação encontrada para esses filtros.</p>';
        const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
        el('page').textContent = `Página ${page} de ${pages}`;
        el('prev').disabled = page <= 1; el('next').disabled = page >= pages;
      } catch (error) {
        if (current !== request) return;
        el('results').textContent = error.message;
        const retry = document.createElement('button'); retry.className = 'btn btn-outline-primary ms-2'; retry.textContent = 'Tentar novamente'; retry.onclick = load; el('results').append(retry);
      }
    }
    form.onsubmit = e => { e.preventDefault(); if (form.inicio.value && form.fim.value && form.inicio.value > form.fim.value) { el('filter-error').textContent = 'A data inicial deve ser anterior à final.'; return; } el('filter-error').textContent = ''; filters = new URLSearchParams(new FormData(form)); page = 1; load(); };
    form.onreset = () => { el('filter-error').textContent = ''; filters = new URLSearchParams(); page = 1; load(); };
    el('prev').onclick = () => { page--; load(); }; el('next').onclick = () => { page++; load(); };
    load();
    const lists = await Promise.allSettled([get('/marcas'), get('/modelos'), get('/tipos')]);
    [['marca','marcascod','marcasdes'],['modelo','modcod','moddes'],['tipo','tipocod','tipodes']].forEach(([name,id,label], index) => {
      const result = lists[index];
      if (result.status !== 'fulfilled') { el('filter-error').textContent = 'Algumas opções de filtro não carregaram. Atualize a página para tentar novamente.'; return; }
      result.value.forEach(item => form.elements[name].add(new Option(item[label], item[id])));
    });
  }
  if (window.ouOnLoad) window.ouOnLoad(init);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
