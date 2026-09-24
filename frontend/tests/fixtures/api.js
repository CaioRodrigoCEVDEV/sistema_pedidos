// Dados exclusivamente de teste; este módulo não é importado pelo aplicativo.
export function createTestApi({
  permissions = {
    usuadm: "S",
    telas: [
      "dashboard",
      "pedidos",
      "clientes",
      "produtos",
      "promocoes",
      "grupos",
      "vitrines",
      "devolucoes",
      "estoque",
      "estoque-grupos",
      "relatorios",
      "backups",
      "usuarios",
      "configuracoes",
    ],
    empusapv: "S",
    empusaest: "S",
    usupv: "S",
    usuest: "S",
  },
  authenticated = true,
} = {}) {
  const calls = [];
  const clients = Array.from({ length: 23 }, (_, i) => ({
    parcod: i + 1,
    pardes: i === 0 ? "Ana Teste" : `Cliente ${String(i + 1).padStart(2, "0")}`,
    parcnpjcpf: "52998224725",
    parfone: "11999990000",
    paremail: "teste@example.com",
    parsit: "A",
    em_aberto: 125,
    credito: 50,
    mundes: "São Paulo",
    ufsigla: "SP",
    parmuncod: 1,
  }));
  let charges = [{ cobcod: 1, cobvalor: 125, cobsta: "A", cobvenc: "2026-01-01", cobpvcod: 10 }];
  let movements = [
    { movcod: 1, movtipo: "CREDITO", movvalor: -50, movsaldo: -50, movdtcad: "2026-09-20" },
  ];
  let orders = [
    {
      pvcod: 10,
      pvvl: 125,
      pvdtcad: "2026-09-20",
      pvcanal: "BALCAO",
      pvconfirmado: "S",
      pvsta: "A",
    },
  ];
  let pendingOrders = [{ pvcod: 21, pvvl: 80, pvcanal: "BALCAO", usunome: "Operador Teste", pvconfirmado: "N", pvsta: "A" }];
  let confirmedOrders = [{ pvcod: 20, pvvl: 125, pvcanal: "ENTREGA", usunome: "Operador Teste", pvconfirmado: "S", pvsta: "A" }];
  let soldItems = [{ pvcod: 20, pvdtcad: "2026-09-20", pvcanal: "ENTREGA", vendedor: "Operador Teste", procod: 1, prodes: "Tela teste", pviprocorid: 1, cornome: "Preto", valor_unitario: 125, quantidade_vendida: 2, quantidade_devolvida: 0, quantidade_disponivel: 2 }];
  let returns = [];
  let stockItems = [{ procod: 1, prodes: "Tela teste", marcasdes: "Marca A", moddes: "Modelo X", tipodes: "Tela", cordes: "Preto", qtde: 5, procorcorescod: 1 }];
  let groupStock = [{ id: 1, grupo: "Telas compatíveis", qtde_vendida: 12, estoque_atual: 5, qtde_ideal: 8 }];
  let groupHistory = [{ id: 1, change: 5, reason: "Estoque inicial", reference_id: null, created_at: "2026-09-20" }];
  let users = [{ usucod: 2, usunome: "Maria Teste", usuemail: "maria@teste.com", usuadm: "N", ususta: "A", usurca: "S", telas: ["pedidos"] }];
  let company = { emprazao: "Loja de demonstração", empwhatsapp1: "5511999990000", empwhatsapp2: "5511888880000", empusaest: "S", empestoqmin: 5 };
  let products = [{ procod: 1, prodes: "Tela teste", marcasdes: "Marca A", tipodes: "Tela", modelos: "Modelo X", moddes: "Modelo X", provl: 100, provlpromo: 90, procusto: 50, prosemest: "N", proacabando: "N" }];
  let promotions = [{ procod: 1, prodes: "Tela teste", marcasdes: "Marca A", tipodes: "Tela", provl: 100, promocaotipo: "P", promocaovalor: 10, promopreco: 90, promocaoativo: true, promocaodtinicio: "2026-09-01", promocaodtfim: "2026-09-30" }];
  let groups = [{ id: 1, name: "Telas compatíveis", stock_quantity: 5, grpcusto: 50, parts_count: 1 }];
  let showcases = [{ id: 1, type: "featured", title: "Destaques", active: true, position: 1, max_items: 8, items: [products[0]], previewItems: [] }];
  async function handle(path, options = {}) {
    const url = new URL(path, "http://localhost"),
      method = options.method || "GET";
    const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
    calls.push({ path: url.pathname, query: url.searchParams, method, body });
    const ok = (data, status = 200) => ({ data, status });
    if (url.pathname === "/auth/login") {
      authenticated = true;
      return ok({ mensagem: "Login bem-sucedido" });
    }
    if (!authenticated) return ok({ error: "Sessão expirada" }, 401);
    if (url.pathname === "/auth/sair") {
      authenticated = false;
      return ok({ message: "Logout" });
    }
    if (url.pathname === "/me/usuario") return ok({ usucod: 1, usunome: "Operador Teste", usuemail: "operador@teste.com" });
    if (url.pathname === "/me/permissoes") return ok(permissions);
    if (url.pathname === "/emp") { if (method === "PUT") Object.assign(company, body); return ok(company); }
    if (url.pathname === "/emp/estoque" && method === "PUT") { Object.assign(company, body); return ok(company); }
    if (url.pathname === "/auth/listarlogin") return ok({ usucod: 1, usunome: "Operador Teste", usuemail: "operador@teste.com" });
    if (url.pathname === "/auth/atualizarCadastro/1" && method === "PUT") return ok({ mensagem: "Senha atualizada" });
    if (url.pathname === "/telas") return ok([{ telachave: "pedidos", telanome: "Pedidos", telagrupo: "Principal" }, { telachave: "relatorios", telanome: "Relatórios", telagrupo: "Ferramentas" }]);
    if (url.pathname === "/usuario/listar/") return ok(users);
    if (url.pathname === "/usuario/novo/" && method === "POST") { users.push({ ...body, usucod: 3 }); return ok({ message: "Criado" }, 201); }
    if (url.pathname.startsWith("/usuario/atualizar/") && method === "POST") { Object.assign(users[0], body); return ok({ mensagem: "Atualizado" }); }
    if (url.pathname.startsWith("/usuario/excluir/") && method === "POST") { users = []; return ok({ mensagem: "Excluído" }); }
    if (url.pathname === "/v2/relatorios/top-pecas") return ok([{ peca: "Tela teste", grupo: "Telas", modelo: "Modelo X", qtde_vendida: 12, custo: 50 }]);
    if (url.pathname === "/backups") return ok({ backups: [{ nome: "2_segunda", tipo: "pasta", tamanhoKB: "-", url: "/backups/folder/2_segunda" }] });
    if (url.pathname === "/backups/folder/2_segunda") return ok({ backups: [{ nome: "backup.sql", tipo: "arquivo", tamanhoKB: "12.5", url: "/backups/download/2_segunda/backup.sql" }] });
    if (url.pathname === "/upload-logo" && method === "POST") return ok({ message: "Logo atualizada" });
    if (url.pathname === "/showcases") return ok({ showcases: [{ type: "featured", title: "Destaques", items: products }] });
    if (url.pathname === "/proCoresDisponiveis/1") return ok([{ procod: 1, corcod: 1, cornome: "Preto", procorsemest: "N" }]);
    if (url.pathname === "/carrinho/precos" && method === "POST") return ok({ itens: [{ procod: 1, preco: 90, provl: 100, provlpromo: 90 }] });
    if (url.pathname === "/pedidos/sequencia") return ok({ nextval: 101 });
    if (url.pathname === "/pedidos/enviar" && method === "POST") return ok({ message: "Pedido criado", pvcod: body.pvcod, itens: body.cart });
    if (url.pathname === "/api/manutencao") return ok({ ativo: false });
    if (url.pathname === "/api/releases") return ok([]);
    if (url.pathname === "/pedidos/pendentes") return ok(pendingOrders);
    if (url.pathname === "/pedidos/confirmados") return ok(confirmedOrders);
    if (url.pathname === "/pedidos/pendentescount") return ok([{ count: pendingOrders.length }]);
    if (url.pathname === "/pedidos/balcao") return ok([{ count: 1 }]);
    if (url.pathname === "/pedidos/entrega") return ok([{ count: 1 }]);
    if (url.pathname === "/pedidos/total/confirmados") return ok([{ count: confirmedOrders.length }]);
    if (/^\/pedido\/detalhe\/\d+$/.test(url.pathname)) return ok([{ pvcod: 21, pviprocod: 1, prodes: "Tela teste", pviqtde: 1, pvivl: 80, pviprocorid: 1, cornome: "Preto", pvobs: "Separar com cuidado" }]);
    if (/^\/pedidos\/confirmar\/\d+$/.test(url.pathname) && method === "PUT") { pendingOrders = []; return ok([{ pvcod: 21, pvconfirmado: "S" }]); }
    if (/^\/pedidos\/confirmados\/\d+\/itens$/.test(url.pathname) && method === "PUT") return ok({ total: 125 });
    if (/^\/pedidos\/cancelar\/\d+$/.test(url.pathname) && method === "PUT") { pendingOrders = pendingOrders.filter((p) => p.pvcod !== Number(url.pathname.split("/").at(-1))); return ok([]); }
    if (url.pathname === "/pedidos/cancelar" && method === "PUT") { pendingOrders = pendingOrders.filter((p) => !body.pvcods.includes(p.pvcod)); return ok([]); }
    if (url.pathname === "/devolucoes/itens") return ok(soldItems);
    if (url.pathname === "/devolucoes/historico") return ok(returns);
    if (url.pathname === "/devolucoes" && method === "POST") { const entry = { devcod: 1, pvcod: body.pvcod, procod: body.procod, prodes: "Tela teste", cornome: "Preto", quantidade: body.quantidade, devmotivo: body.motivo, repor_estoque: body.reporEstoque, usuario: "Operador Teste", devdtcad: "2026-09-23" }; returns.push(entry); soldItems[0].quantidade_devolvida += body.quantidade; soldItems[0].quantidade_disponivel -= body.quantidade; return ok({ devolucao: { codigo: 1 } }, 201); }
    if (url.pathname === "/api/estoque/itens") return ok(stockItems);
    if (/^\/api\/estoque\/itens\/\d+\/ajustar$/.test(url.pathname) && method === "POST") { stockItems[0].qtde += body.delta; return ok({ quantity: stockItems[0].qtde, groupId: null }); }
    if (url.pathname === "/api/estoque-grupos") return ok(groupStock);
    if (/^\/api\/estoque-grupos\/\d+\/ideal$/.test(url.pathname) && method === "PUT") { groupStock[0].qtde_ideal = body.qtde_ideal; return ok(groupStock[0]); }
    if (/^\/api\/estoque-grupos\/\d+\/ajustar$/.test(url.pathname) && method === "POST") { groupStock[0].estoque_atual += body.delta; groupHistory.unshift({ id: groupHistory.length + 1, change: body.delta, reason: body.reason, created_at: "2026-09-23" }); return ok({ stock_quantity: groupStock[0].estoque_atual }); }
    if (/^\/api\/estoque-grupos\/\d+\/historico$/.test(url.pathname)) return ok(groupHistory);
    if (url.pathname === "/marcas") return ok([{ marcascod: 1, marcasdes: "Marca A" }]);
    if (url.pathname === "/modelos") return ok([{ modcod: 1, moddes: "Modelo X", modmarcascod: 1 }]);
    if (url.pathname === "/tipos") return ok([{ tipocod: 1, tipodes: "Tela" }]);
    if (url.pathname === "/cores") return ok([{ corcod: 1, cornome: "Preto" }]);
    if (url.pathname === "/pros") return ok({ data: products, total: products.length, page: 1, pageSize: 20 });
    if (url.pathname === "/pro" && method === "POST") { products.push({ ...body, procod: 2, marcasdes: "Marca A", tipodes: "Tela" }); return ok(products.at(-1)); }
    if (url.pathname === "/pro/painel/1") return ok([products[0]]);
    if (url.pathname === "/promocoes/admin") return ok({ promocoes: promotions });
    if (url.pathname === "/promocoes" && method === "POST") { promotions.push({ ...body, prodes: "Tela teste", provl: 100 }); return ok(body, 201); }
    if (url.pathname === "/part-groups") { if (method === "POST") { groups.push({ id: 2, name: body.name, stock_quantity: 0, parts_count: 0 }); return ok(groups.at(-1), 201); } return ok(groups); }
    if (url.pathname === "/part-groups/1") return ok({ ...groups[0], parts: [{ procorid: 10, procod: 1, prodes: "Tela teste", marcasdes: "Marca A", tipodes: "Tela", cornome: "Preto" }] });
    if (url.pathname === "/showcases/admin") return ok({ showcases });
    if (/^\/showcases\/admin\/\d+$/.test(url.pathname) && method === "PUT") { Object.assign(showcases[0], body); return ok(showcases[0]); }
    if (url.pathname === "/municipios")
      return ok([{ muncod: 1, mundes: "São Paulo", munufsigla: "SP" }]);
    if (url.pathname === "/dashboard/resumo")
      return ok({
        pedidos: { pendentes: 3, confirmados: 12, balcao: 8, entrega: 4, venda: 3 },
        produtos: { emFalta: 2, acabando: 5 },
        estoque: {
          comEstoque: 100,
          semEstoque: 20,
          topMarcas: [
            { marcasdes: "Marca A", total: 40 },
            { marcasdes: "Marca B", total: 30 },
          ],
        },
        listas: { clientes: 23, vendedores: 3, marcas: 8 },
      });
    if (url.pathname === "/v2/top/produtos/mes")
      return ok([
        { produto: "Tela de demonstração", qtde: 20 },
        { produto: "Bateria de demonstração", qtde: 12 },
      ]);
    if (url.pathname === "/v2/top/marcas/mes")
      return ok([
        { marcasdes: "Marca A", valor: 1400 },
        { marcasdes: "Marca B", valor: 750 },
      ]);
    if (url.pathname === "/v2/pedidos/total/anual")
      return ok([
        { mes: 9, pvcanal: "BALCAO", vl_total_mes: 1400 },
        { mes: 9, pvcanal: "ENTREGA", vl_total_mes: 750 },
      ]);
    if (url.pathname === "/v2/pedidos/total/dia")
      return ok([
        { pvcanal: "BALCAO", vl_total_dia: 1400 },
        { pvcanal: "ENTREGA", vl_total_dia: 750 },
      ]);
    if (url.pathname === "/cli/pedidos/disponiveis")
      return ok([{ pvcod: 11, pvvl: 50, pvcanal: "VENDA", pvsta: "A", pvconfirmado: "N" }]);
    if (url.pathname === "/cli") {
      if (method === "POST") {
        const client = { ...body, parcod: clients.length + 1 };
        clients.push(client);
        return ok(client, 201);
      }
      const q = url.searchParams.get("q")?.toLowerCase() || "",
        page = Number(url.searchParams.get("page") || 1);
      const data = clients.filter((client) => client.pardes.toLowerCase().includes(q));
      return ok({ data: data.slice((page - 1) * 20, page * 20), total: data.length, page });
    }
    const match = url.pathname.match(/^\/cli\/(\d+)(.*)$/);
    if (match) {
      const client = clients.find((c) => c.parcod === Number(match[1])),
        suffix = match[2];
      if (!client) return ok({ error: "Cliente não encontrado" }, 404);
      if (!suffix) {
        if (method === "PUT") Object.assign(client, body);
        if (method === "DELETE") client.parsit = "I";
        return ok(client);
      }
      if (suffix === "/conta")
        return ok({
          em_aberto: charges
            .filter((c) => c.cobsta === "A")
            .reduce((sum, c) => sum + c.cobvalor, 0),
          credito: 50,
          pedidos_vinculados: orders.length,
        });
      if (suffix === "/movimentacoes") {
        if (method === "POST")
          movements.push({
            movcod: movements.length + 1,
            movtipo: body.tipo,
            movvalor: body.valor,
            movsaldo: 0,
            movdesc: body.descricao,
          });
        return ok(movements);
      }
      if (suffix === "/cobrancas") {
        if (method === "POST") charges.push({ ...body, cobcod: charges.length + 1, cobsta: "A" });
        return ok(charges);
      }
      if (suffix.startsWith("/cobrancas/")) {
        const id = Number(suffix.split("/")[2]);
        charges.find((c) => c.cobcod === id).cobsta = suffix.endsWith("baixar") ? "P" : "C";
        return ok({ ok: true });
      }
      if (suffix.endsWith("/itens"))
        return ok([{ prodes: "Tela de demonstração", cornome: "Preto", pviqtde: 1, pvivl: 125 }]);
      if (suffix === "/pedidos") return ok(orders);
      if (suffix.startsWith("/pedidos/")) {
        const id = Number(suffix.split("/")[2]);
        if (method === "DELETE") orders = orders.filter((p) => p.pvcod !== id);
        else orders.push({ pvcod: id, pvvl: 50, pvcanal: "VENDA", pvsta: "A" });
        return ok({ ok: true });
      }
    }
    return ok({ error: `Rota de teste não definida: ${url.pathname}` }, 404);
  }
  return {
    calls,
    clients,
    handle,
    expire: () => {
      authenticated = false;
    },
    fetch: async (path, options) => {
      const { data, status } = await handle(path, options);
      return Response.json(data, { status });
    },
  };
}
