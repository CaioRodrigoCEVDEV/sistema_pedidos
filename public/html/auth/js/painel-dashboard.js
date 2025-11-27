 // Usa window.API_URL (se definido em /config.js). Caso contrário, usa caminho relativo.
    const API = (path) => (window.API_URL ? window.API_URL + path : path);
    const optAuth = { credentials: "include" }; // envia cookie httpOnly do login

    const $ = (s) => document.querySelector(s);
    const toNum = (v) => Number(v ?? 0) || 0;



document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("/me/usuario", {
      method: "GET",
      credentials: "include" // envia o cookie HttpOnly
    });

    if (!response.ok) throw new Error("Falha ao obter usuário");

    const data = await response.json();
    const usuario = data.usunome || "Usuário";

    const h1 = document.querySelector("h1.h4.mb-0");
    if (h1) {
      h1.textContent = `Bem-vindo, ${usuario}`;
    }
  } catch (err) {
    console.error("Erro ao buscar nome do usuário:", err);
  }
});

    async function jget(path, fallback = null) {
      try {
        const r = await fetch(API(path), optAuth);
        if (!r.ok) throw new Error(path + " => " + r.status);
        return await r.json();
      } catch (e) {
        console.warn("Falha em", path, e.message);
        return fallback;
      }
    }

    function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

    // Paleta consistente com Bootstrap
    const COLORS = {
      primary:  "#0d6efd",
      purple:   "#6f42c1",
      orange:   "#fd7e14",
      green:    "#198754",
      teal:     "#20c997",
      yellow:   "#ffc107",
      red:      "#dc3545",
      gray600:  "#6c757d",
      gray400:  "#adb5bd"
    };
    const PALETTE = [
      COLORS.primary, COLORS.purple, COLORS.orange, COLORS.green, COLORS.red,
      COLORS.teal, COLORS.yellow, "#0dcaf0", "#6610f2", "#198754"
    ];

    // Chart.js helpers com layout corrigido
    function baseOptions(overrides={}) {
      return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: "easeOutQuart" },
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, pointStyle: "circle" } },
          tooltip: {
            callbacks: {
              label(ctx) {
                const v = ctx.raw ?? 0;
                return ` ${ctx.label}: ${v}`;
              }
            }
          }
        },
        layout: { padding: { top: 8, right: 8, bottom: 8, left: 8 } },
        ...overrides
      };
    }

    function chartDoughnut(ctx, labels, data, colors) {
      return new Chart(ctx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 8
          }]
        },
        options: baseOptions({ cutout: "58%" })
      });
    }

    function chartBar(ctx, labels, data, colors) {
      return new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors,
            borderRadius: 8,
            borderWidth: 0
          }]
        },
        options: baseOptions({
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, grid: { color: "rgba(108,117,125,.15)" } },
                    x: { grid: { display: false } } }
        })
      });
    }

    async function loadDashboard() {
      // KPIs: pedidos
      const pend = await jget("/pedidos/pendentescountNow", []);
      const conf = await jget("/pedidos/total/confirmadosNow", []);
      const balcao = await jget("/pedidos/balcaoNow", []);
      const entrega = await jget("/pedidos/entregaNow", []);
      const emfalta = await jget("/total/produto/emfalta", []);
      const acabando = await jget("/total/produto/acabando", []);

      const pendentesCount = toNum(pend?.[0]?.count);
      const confirmadosCount = toNum(conf?.[0]?.count);
      const balcaoCount = toNum(balcao?.[0]?.count);
      const entregaCount = toNum(entrega?.[0]?.count);
      const emfaltaCount = toNum(emfalta?.[0]?.count);
      const acabandoCount = toNum(acabando?.[0]?.count);

      setText("kpiEmFalta", emfaltaCount);
      setText("kpiAcabando", acabandoCount);

      setText("kpiPendentes", pendentesCount);
      setText("kpiConfirmados", confirmadosCount);

      // KPIs: clientes e vendedores
      const clientes = await jget("/cli", { total: 0, data: [] });
      const vendedores = await jget("/vendedor/listar", []);
      setText("kpiClientes", toNum(clientes?.total ?? clientes?.length ?? 0));
      setText("kpiVendedores", vendedores?.length ?? 0);

      // KPIs secundários
      const marcas = await jget("/marcas", []);
      setText("kpiMarcas", marcas?.length ?? 0);

      const modelos = await jget("/modelos/todos", []);
      setText("kpiModelos", modelos?.length ?? 0);
      const tipos = await jget("/tipos/todos", []);
      setText("kpiTipos", tipos?.length ?? 0);

      // Estoque (listas)
      const comEstoque = await jget("/proComEstoque", []);
      const semEstoque = await jget("/proSemEstoque", []);

      // ===== Gráficos =====
      // 1) Pedidos (doughnut p/ evitar "pizza esmagada" com valores desbalanceados)
      chartDoughnut(
        document.getElementById("chartPedidos"),
        ["Pendentes", "Confirmados"],
        [pendentesCount, confirmadosCount],
        [COLORS.primary, COLORS.purple]
      );

      // 2) Canais
      chartDoughnut(
        document.getElementById("chartCanais"),
        ["Balcão", "Entrega"],
        [balcaoCount, entregaCount],
        [COLORS.blue || COLORS.primary, COLORS.red]
      );

      // 3) Estoque (barras)
      chartBar(
        document.getElementById("chartEstoque"),
        ["Com estoque", "Sem estoque"],
        [comEstoque.length, semEstoque.length],
        [COLORS.green, COLORS.gray400]
      );

      // 4) Top 5 Marcas com estoque
      const porMarca = {};
      (comEstoque || []).forEach((p) => {
        const m = p.marcasdes || "—";
        porMarca[m] = (porMarca[m] || 0) + 1;
      });
      const top = Object.entries(porMarca).sort((a,b) => b[1]-a[1]).slice(0,5);
      chartBar(
        document.getElementById("chartTopMarcas"),
        top.map(([k]) => k),
        top.map(([,v]) => v),
        top.map((_,i) => PALETTE[i % PALETTE.length])
      );
    }

    document.addEventListener("DOMContentLoaded", loadDashboard);