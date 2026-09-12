/* ==========================================================================
   Dashboard — filtros, KPIs e gráficos
   - Tema dos gráficos lê os tokens de public/css/theme.css e re-renderiza
     ao trocar de tema (evento "ou:themechange").
   - Cada gráfico separa busca de dados (load*) de render (render*), de modo
     que a troca de tema não refaça requisições.
   ========================================================================== */
(function () {
  "use strict";

  var FONT = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  var API = function (path) { return window.API_URL ? window.API_URL + path : path; };
  var optAuth = { credentials: "include" };

  var toNum = function (v) { return Number(v ?? 0) || 0; };

  var brl = function (v) {
    return (isNaN(v) ? 0 : Number(v)).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  };
  window.brl = window.brl || brl;

  function compactBRL(v) {
    var n = Number(v) || 0;
    if (Math.abs(n) >= 1e6) return "R$ " + (n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi";
    if (Math.abs(n) >= 1e3) return "R$ " + (n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil";
    return brl(n);
  }

  function setText(id, v) {
    var el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  async function getJSON(path) {
    var resp = await fetch(BASE_URL + path, { credentials: "include" });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    return resp.json();
  }

  async function jget(path, fallback) {
    try {
      var r = await fetch(API(path), optAuth);
      if (!r.ok) throw new Error(path + " => " + r.status);
      return await r.json();
    } catch (e) {
      console.warn("Falha em", path, e.message);
      return fallback === undefined ? null : fallback;
    }
  }

  // ------------------------------------------------------------------------
  // Skeleton / loading por gráfico
  // ------------------------------------------------------------------------
  function setWrapperLoading(canvas, isLoading) {
    if (!canvas) return;
    var wrapper = canvas.closest(".chart-wrapper");
    if (!wrapper) return;
    wrapper.classList.toggle("loading", !!isLoading);
  }

  // ------------------------------------------------------------------------
  // Filtros de período
  // ------------------------------------------------------------------------
  window.dashFiltroParams = { dataInicio: null, dataFim: null };

  function toISODate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + dd;
  }

  function buildDashQS() {
    var p = window.dashFiltroParams;
    var qs = new URLSearchParams();
    if (p.dataInicio) qs.set("dataInicio", p.dataInicio);
    if (p.dataFim) qs.set("dataFim", p.dataFim);
    return qs.toString() ? "?" + qs.toString() : "";
  }

  function aplicarPresetDash(preset) {
    var today = new Date();
    var inputInicio = document.getElementById("dashDataInicio");
    var inputFim = document.getElementById("dashDataFim");
    var start = null, end = null;

    if (preset === "hoje") {
      start = new Date(today); end = new Date(today);
    } else if (preset === "ult7") {
      start = new Date(today); start.setDate(today.getDate() - 6); end = new Date(today);
    } else if (preset === "ult30") {
      start = new Date(today); start.setDate(today.getDate() - 29); end = new Date(today);
    } else if (preset === "mesAtual") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (preset === "anoAtual") {
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
    } else if (preset === "todos") {
      start = end = null;
    } else if (preset === "personalizado") {
      if (inputInicio) inputInicio.disabled = false;
      if (inputFim) inputFim.disabled = false;
      return;
    }

    if (inputInicio) { inputInicio.disabled = true; inputInicio.value = start ? toISODate(start) : ""; }
    if (inputFim) { inputFim.disabled = true; inputFim.value = end ? toISODate(end) : ""; }
    window.dashFiltroParams.dataInicio = start ? toISODate(start) : null;
    window.dashFiltroParams.dataFim = end ? toISODate(end) : null;
  }

  function updateChartTitles() {
    var sel = document.getElementById("dashPeriodoSelect");
    if (!sel || !sel.options[sel.selectedIndex]) return;
    var periodo = sel.options[sel.selectedIndex].text;
    var tp = document.getElementById("tituloTopProdutos");
    var tm = document.getElementById("tituloTopMarcas");
    if (tp) tp.textContent = "Top 10 Produtos — " + periodo;
    if (tm) tm.textContent = "Top 10 Marcas — " + periodo;
  }

  function initFilter() {
    var periodoSel = document.getElementById("dashPeriodoSelect");
    var inputInicio = document.getElementById("dashDataInicio");
    var inputFim = document.getElementById("dashDataFim");
    var btnAplicar = document.getElementById("btnAplicarFiltroDash");
    if (!periodoSel) return;

    aplicarPresetDash(periodoSel.value);
    updateChartTitles();

    periodoSel.addEventListener("change", function () {
      aplicarPresetDash(this.value);
    });

    if (btnAplicar) {
      btnAplicar.addEventListener("click", function () {
        var preset = periodoSel.value;
        if (preset === "personalizado") {
          window.dashFiltroParams.dataInicio = inputInicio ? inputInicio.value || null : null;
          window.dashFiltroParams.dataFim = inputFim ? inputFim.value || null : null;
        } else {
          aplicarPresetDash(preset);
        }
        updateChartTitles();
        loadPeriodCharts();
      });
    }
  }

  // ------------------------------------------------------------------------
  // Tema dos gráficos (tokens do CSS + Chart.defaults)
  // ------------------------------------------------------------------------
  var DashChart = (function () {
    function readToken(name, fallback) {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      return (v && v.trim()) || fallback;
    }

    function tokens() {
      var isDark = document.documentElement.getAttribute("data-theme") === "dark";
      var gold = isDark
        ? { blue: "#60a5fa", indigo: "#818cf8", violet: "#a78bfa", teal: "#2dd4bf", green: "#34d399", amber: "#fbbf24", orange: "#fb923c", rose: "#fb7185", cyan: "#22d3ee", slate: "#94a3b8" }
        : { blue: "#3b82f6", indigo: "#4f46e5", violet: "#7c3aed", teal: "#0d9488", green: "#10b981", amber: "#f59e0b", orange: "#f97316", rose: "#f43f5e", cyan: "#06b6d4", slate: "#64748b" };

      return {
        isDark: isDark,
        text: readToken("--ou-text", isDark ? "#f9fafb" : "#0f172a"),
        muted: readToken("--ou-text-muted", isDark ? "#9ca3af" : "#64748b"),
        border: readToken("--ou-border", isDark ? "#374151" : "#e2e8f0"),
        surface: readToken("--ou-surface", isDark ? "#1f2937" : "#ffffff"),
        grid: isDark ? "rgba(148,163,184,0.14)" : "rgba(100,116,139,0.14)",
        gold: gold,
        palette: [gold.blue, gold.indigo, gold.violet, gold.teal, gold.green, gold.amber, gold.orange, gold.rose, gold.cyan, gold.slate],
        channel: { balcao: gold.blue, entrega: gold.green, venda: gold.amber }
      };
    }

    function grid(t) {
      return { color: t.grid, drawTicks: false };
    }

    function applyDefaults() {
      var t = tokens();
      Chart.defaults.font.family = FONT;
      Chart.defaults.font.size = 12;
      Chart.defaults.color = t.muted;
      Chart.defaults.borderColor = t.grid;
      Chart.defaults.responsive = true;
      Chart.defaults.maintainAspectRatio = false;

      var legend = Chart.defaults.plugins.legend;
      legend.display = true;
      legend.position = "bottom";
      legend.labels.usePointStyle = true;
      legend.labels.pointStyle = "circle";
      legend.labels.boxWidth = 8;
      legend.labels.boxHeight = 8;
      legend.labels.padding = 16;
      legend.labels.color = t.muted;

      var tt = Chart.defaults.plugins.tooltip;
      tt.backgroundColor = t.isDark ? "#0b1220" : "#0f172a";
      tt.titleColor = "#f8fafc";
      tt.bodyColor = "#e2e8f0";
      tt.borderColor = t.isDark ? "rgba(148,163,184,0.25)" : "rgba(15,23,42,0.06)";
      tt.borderWidth = 1;
      tt.padding = 12;
      tt.cornerRadius = 12;
      tt.displayColors = false;
      tt.titleFont = { weight: "600" };
    }

    return { tokens: tokens, grid: grid, applyDefaults: applyDefaults };
  })();

  DashChart.applyDefaults();

  // Plugin: total no centro de doughnuts
  var centerTextPlugin = {
    id: "dashCenterText",
    afterDraw: function (chart, _args, opts) {
      if (!opts || !opts.display) return;
      var area = chart.chartArea;
      if (!area) return;
      var t = DashChart.tokens();
      var cx = (area.left + area.right) / 2;
      var cy = (area.top + area.bottom) / 2;
      var ctx = chart.ctx;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (opts.label) {
        ctx.font = "600 10px " + FONT;
        ctx.fillStyle = t.muted;
        ctx.fillText(String(opts.label).toUpperCase(), cx, cy - (opts.value ? 12 : 0));
      }
      if (opts.value) {
        ctx.font = "700 18px " + FONT;
        ctx.fillStyle = t.text;
        ctx.fillText(String(opts.value), cx, cy + (opts.label ? 8 : 0));
      }
      ctx.restore();
    }
  };
  Chart.register(centerTextPlugin);

  var DATA_LABELS = typeof ChartDataLabels !== "undefined" ? [ChartDataLabels] : [];

  // ------------------------------------------------------------------------
  // Registro de instâncias/estado/render por gráfico
  // ------------------------------------------------------------------------
  var chartInstances = Object.create(null);
  var chartStates = Object.create(null);
  var chartRenderers = Object.create(null);

  function destroyChart(id) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      chartInstances[id] = null;
    }
  }

  function mountChart(id, config) {
    var canvas = document.getElementById(id);
    if (!canvas) return null;
    destroyChart(id);
    chartInstances[id] = new Chart(canvas, config);
    return chartInstances[id];
  }

  function clearResumo(id, msg) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg || "";
    el.classList.remove("text-danger");
  }

  // ------------------------------------------------------------------------
  // Render — Top Produtos
  // ------------------------------------------------------------------------
  function renderTopProdutos(state) {
    var canvas = document.getElementById("chartTopProdutosMes");
    if (!canvas) return;
    var rows = state.rows || [];

    if (!rows.length) {
      destroyChart("chartTopProdutosMes");
      clearResumo("resumoTopProdutosMes", "Sem vendas no período.");
      setWrapperLoading(canvas, false);
      return;
    }

    var t = DashChart.tokens();
    var labels = rows.map(function (r) {
      return r.produto.length > 42 ? r.produto.slice(0, 42) + "…" : r.produto;
    });
    var valores = rows.map(function (r) { return r.qtde; });
    var total = valores.reduce(function (a, b) { return a + b; }, 0);

    mountChart("chartTopProdutosMes", {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Qtd. vendida",
          data: valores,
          backgroundColor: function (c) {
            var area = c.chart.chartArea;
            if (!area) return t.gold.blue;
            var g = c.chart.ctx.createLinearGradient(area.left, 0, area.right, 0);
            g.addColorStop(0, t.gold.blue);
            g.addColorStop(1, t.gold.indigo);
            return g;
          },
          hoverBackgroundColor: t.gold.indigo,
          borderRadius: 8,
          borderSkipped: false,
          maxBarThickness: 22
        }]
      },
      options: {
        indexAxis: "y",
        animation: { duration: 700, easing: "easeOutQuart" },
        layout: { padding: { right: 40, top: 4, bottom: 4 } },
        scales: {
          x: {
            beginAtZero: true,
            grid: DashChart.grid(t),
            border: { display: false },
            ticks: { color: t.muted, precision: 0, stepSize: 1, font: { size: 11 } }
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: t.text, autoSkip: false, font: { size: 11.5 } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function (items) { return rows[items[0].dataIndex].produto; },
              label: function (c) { return " " + Number(c.parsed.x).toLocaleString("pt-BR") + " un. vendidas"; }
            }
          },
          datalabels: {
            anchor: "end", align: "right", offset: 6, clamp: true,
            color: t.text, font: { weight: "700", size: 11 },
            formatter: function (v) { return Number(v).toLocaleString("pt-BR"); }
          }
        }
      },
      plugins: DATA_LABELS
    });

    clearResumo("resumoTopProdutosMes", "Top " + rows.length + " produtos · " + total.toLocaleString("pt-BR") + " itens vendidos no período");
    setWrapperLoading(canvas, false);
  }

  // ------------------------------------------------------------------------
  // Render — Top Marcas
  // ------------------------------------------------------------------------
  function renderTopMarcas(state) {
    var canvas = document.getElementById("chartTopMarcasMes");
    if (!canvas) return;
    var rows = state.rows || [];

    if (!rows.length) {
      destroyChart("chartTopMarcasMes");
      clearResumo("resumoTopMarcasMes", "Sem faturamento por marca no período.");
      setWrapperLoading(canvas, false);
      return;
    }

    var t = DashChart.tokens();
    var labels = rows.map(function (r) { return r.marca.toUpperCase(); });
    var valores = rows.map(function (r) { return r.valor; });
    var total = valores.reduce(function (a, b) { return a + b; }, 0);

    var corMarca = function (m, i) {
      var x = String(m).toUpperCase();
      if (x.indexOf("APPLE") !== -1 || x.indexOf("IPHONE") !== -1) return t.gold.indigo;
      if (x.indexOf("SAMSUNG") !== -1) return t.gold.blue;
      if (x.indexOf("MOTOROLA") !== -1) return t.gold.green;
      if (x.indexOf("XIAOMI") !== -1) return t.gold.orange;
      if (x.indexOf("REALME") !== -1) return t.gold.violet;
      if (x.indexOf("NOKIA") !== -1) return t.gold.cyan;
      if (x.indexOf("LG") !== -1) return t.gold.rose;
      return t.palette[i % t.palette.length];
    };

    mountChart("chartTopMarcasMes", {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Venda",
          data: valores,
          backgroundColor: labels.map(corMarca),
          hoverBackgroundColor: labels.map(corMarca),
          borderRadius: 8,
          borderSkipped: false,
          maxBarThickness: 22
        }]
      },
      options: {
        indexAxis: "y",
        animation: { duration: 700, easing: "easeOutQuart" },
        layout: { padding: { right: 56, top: 4, bottom: 4 } },
        scales: {
          x: {
            beginAtZero: true,
            grid: DashChart.grid(t),
            border: { display: false },
            ticks: { color: t.muted, callback: function (v) { return compactBRL(v); }, font: { size: 11 } }
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: t.text, autoSkip: false, font: { size: 11.5 } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (c) { return " " + brl(c.parsed.x); },
              afterLabel: function (c) {
                var v = c.parsed.x || 0;
                var pct = total ? (v / total) * 100 : 0;
                return "Participação: " + pct.toFixed(1) + "%";
              }
            }
          },
          datalabels: {
            anchor: "end", align: "right", offset: 6, clamp: true,
            color: t.text, font: { weight: "700", size: 11 },
            formatter: function (v) { return compactBRL(v); }
          }
        }
      },
      plugins: DATA_LABELS
    });

    var top = rows[0];
    var pctTop = total ? ((top.valor / total) * 100).toFixed(1) : "0.0";
    clearResumo("resumoTopMarcasMes", "Total: " + brl(total) + " · Top: " + top.marca + " (" + brl(top.valor) + " · " + pctTop + "%)");
    setWrapperLoading(canvas, false);
  }

  // ------------------------------------------------------------------------
  // Render — Vendas do dia (doughnut por canal)
  // ------------------------------------------------------------------------
  function renderFaturamentoDia(state) {
    var canvas = document.getElementById("chartFaturamentoDia");
    if (!canvas) return;
    var labels = state.labels || [];
    var valores = state.valores || [];
    var total = valores.reduce(function (a, b) { return a + b; }, 0);

    if (!labels.length || total <= 0) {
      destroyChart("chartFaturamentoDia");
      clearResumo("chartFaturamentoDiaResumo", "Sem vendas no período.");
      setWrapperLoading(canvas, false);
      return;
    }

    var t = DashChart.tokens();
    var cores = labels.map(function (_, i) { return t.palette[i % t.palette.length]; });

    mountChart("chartFaturamentoDia", {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{ data: valores, backgroundColor: cores, borderWidth: 0, hoverOffset: 10, borderRadius: 6 }]
      },
      options: {
        cutout: "64%",
        animation: { duration: 700, easing: "easeOutQuart" },
        plugins: {
          legend: { position: "bottom" },
          dashCenterText: { display: true, label: "Total", value: compactBRL(total) },
          tooltip: { callbacks: { label: function (c) { return " " + c.label + ": " + brl(c.parsed); } } }
        }
      }
    });

    clearResumo("chartFaturamentoDiaResumo", "Total: " + brl(total));
    setWrapperLoading(canvas, false);
  }

  // ------------------------------------------------------------------------
  // Render — Venda anual (barras empilhadas por canal)
  // ------------------------------------------------------------------------
  function renderFaturamentoAnual(state) {
    var canvas = document.getElementById("chartFaturamentoAnual");
    if (!canvas) return;

    var MESES = state.meses;
    var balcao = state.balcao;
    var entrega = state.entrega;
    var venda = state.venda;
    var total = balcao.concat(entrega, venda).reduce(function (a, b) { return a + b; }, 0);
    var t = DashChart.tokens();

    mountChart("chartFaturamentoAnual", {
      type: "bar",
      data: {
        labels: MESES,
        datasets: [
          { label: "Balcão", data: balcao, backgroundColor: t.channel.balcao, borderRadius: 6, borderSkipped: false, maxBarThickness: 26 },
          { label: "Entrega", data: entrega, backgroundColor: t.channel.entrega, borderRadius: 6, borderSkipped: false, maxBarThickness: 26 },
          { label: "Venda", data: venda, backgroundColor: t.channel.venda, borderRadius: 6, borderSkipped: false, maxBarThickness: 26 }
        ]
      },
      options: {
        interaction: { mode: "index", intersect: false },
        animation: { duration: 700, easing: "easeOutQuart" },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            border: { display: false },
            ticks: { color: t.muted, font: { size: 10 } }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: DashChart.grid(t),
            border: { display: false },
            ticks: { color: t.muted, callback: function (v) { return compactBRL(v); }, font: { size: 11 } }
          }
        },
        plugins: {
          legend: { position: "top", align: "end" },
          tooltip: {
            callbacks: {
              label: function (c) { return " " + c.dataset.label + ": " + brl(c.parsed.y); },
              footer: function (items) {
                if (!items.length) return "";
                var soma = items.reduce(function (s, i) { return s + (i.parsed.y || 0); }, 0);
                return "Total: " + brl(soma);
              }
            }
          }
        }
      }
    });

    clearResumo("resumoFaturamentoAnual", "Total do ano: " + brl(total));
    setWrapperLoading(canvas, false);
  }

  // ------------------------------------------------------------------------
  // Render — doughnuts de KPI (Pedidos / Canais)
  // ------------------------------------------------------------------------
  function renderDoughnut(id, state, centerLabel) {
    var total = (state.valores || []).reduce(function (a, b) { return a + b; }, 0);
    var t = DashChart.tokens();
    var cores = (state.labels || []).map(function (_, i) { return t.palette[i % t.palette.length]; });

    mountChart(id, {
      type: "doughnut",
      data: {
        labels: state.labels,
        datasets: [{ data: state.valores, backgroundColor: cores, borderWidth: 0, hoverOffset: 10, borderRadius: 6 }]
      },
      options: {
        cutout: "64%",
        animation: { duration: 700, easing: "easeOutQuart" },
        plugins: {
          legend: { position: "bottom" },
          dashCenterText: { display: true, label: centerLabel, value: total.toLocaleString("pt-BR") },
          tooltip: { callbacks: { label: function (c) { return " " + c.label + ": " + Number(c.parsed).toLocaleString("pt-BR"); } } }
        }
      }
    });
  }

  // ------------------------------------------------------------------------
  // Render — barras horizontais de KPI (Estoque / Top 5 marcas)
  // ------------------------------------------------------------------------
  function horizontalBar(id, state, colors, unit) {
    var t = DashChart.tokens();
    mountChart(id, {
      type: "bar",
      data: {
        labels: state.labels,
        datasets: [{
          data: state.valores,
          backgroundColor: colors,
          borderRadius: 8,
          borderSkipped: false,
          maxBarThickness: 22
        }]
      },
      options: {
        indexAxis: "y",
        animation: { duration: 700, easing: "easeOutQuart" },
        layout: { padding: { right: 40, top: 4, bottom: 4 } },
        scales: {
          x: {
            beginAtZero: true,
            grid: DashChart.grid(t),
            border: { display: false },
            ticks: { color: t.muted, precision: 0, font: { size: 11 } }
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: t.text, font: { size: 11.5 } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (c) { return " " + Number(c.parsed.x).toLocaleString("pt-BR") + (unit || ""); }
            }
          },
          datalabels: {
            anchor: "end", align: "right", offset: 6, clamp: true,
            color: t.text, font: { weight: "700", size: 11 },
            formatter: function (v) { return Number(v).toLocaleString("pt-BR"); }
          }
        }
      },
      plugins: DATA_LABELS
    });
  }

  function renderEstoqueKpi(state) {
    var t = DashChart.tokens();
    horizontalBar("chartEstoque", state, [t.gold.green, t.gold.slate], " produtos");
  }

  function renderTopMarcasEstoqueKpi(state) {
    var t = DashChart.tokens();
    var bg = state.labels.map(function (_, i) { return t.palette[i % t.palette.length]; });
    horizontalBar("chartTopMarcas", state, bg, " produtos");
  }

  chartRenderers.chartTopProdutosMes = renderTopProdutos;
  chartRenderers.chartTopMarcasMes = renderTopMarcas;
  chartRenderers.chartFaturamentoDia = renderFaturamentoDia;
  chartRenderers.chartFaturamentoAnual = renderFaturamentoAnual;
  chartRenderers.chartPedidos = function (s) { renderDoughnut("chartPedidos", s, "Pedidos"); };
  chartRenderers.chartCanais = function (s) { renderDoughnut("chartCanais", s, "Canais"); };
  chartRenderers.chartEstoque = renderEstoqueKpi;
  chartRenderers.chartTopMarcas = renderTopMarcasEstoqueKpi;

  // ------------------------------------------------------------------------
  // Busca de dados
  // ------------------------------------------------------------------------
  async function loadTopProdutos() {
    var canvas = document.getElementById("chartTopProdutosMes");
    try {
      var data = await getJSON("/v2/top/produtos/mes" + buildDashQS());
      var rows = (data || [])
        .map(function (r) {
          return { procod: r.procod, produto: String(r.produto || "").trim(), qtde: Number(r.qtde) || 0 };
        })
        .sort(function (a, b) { return b.qtde - a.qtde; })
        .slice(0, 10);
      var state = { rows: rows };
      chartStates.chartTopProdutosMes = state;
      renderTopProdutos(state);
    } catch (e) {
      console.error("Erro Top Produtos:", e);
      clearResumo("resumoTopProdutosMes", "Erro ao carregar Top Produtos.");
      var r = document.getElementById("resumoTopProdutosMes");
      if (r) r.classList.add("text-danger");
      setWrapperLoading(canvas, false);
    }
  }

  async function loadTopMarcas() {
    var canvas = document.getElementById("chartTopMarcasMes");
    try {
      var data = await getJSON("/v2/top/marcas/mes" + buildDashQS());
      var rows = (data || [])
        .map(function (r) {
          return { marca: String(r.marcasdes || "").trim(), valor: parseFloat(String(r.valor || "0").replace(",", ".")) || 0 };
        })
        .filter(function (r) { return r.valor > 0; })
        .sort(function (a, b) { return b.valor - a.valor; });
      var state = { rows: rows };
      chartStates.chartTopMarcasMes = state;
      renderTopMarcas(state);
    } catch (e) {
      console.error("Erro Top Marcas:", e);
      clearResumo("resumoTopMarcasMes", "Erro ao carregar Top Marcas.");
      var r = document.getElementById("resumoTopMarcasMes");
      if (r) r.classList.add("text-danger");
      setWrapperLoading(canvas, false);
    }
  }

  async function loadFaturamentoAnual() {
    var canvas = document.getElementById("chartFaturamentoAnual");
    try {
      var data = await getJSON("/v2/pedidos/total/anual" + buildDashQS());
      var MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
      var balcao = new Array(12).fill(0);
      var entrega = new Array(12).fill(0);
      var venda = new Array(12).fill(0);

      (data || []).forEach(function (r) {
        var m = Math.max(1, Math.min(12, parseInt(r.mes, 10))) - 1;
        var canal = String(r.pvcanal || "").trim().toUpperCase();
        var v = parseFloat(r.vl_total_mes) || 0;
        if (canal === "BALCAO" || canal === "BALCÃO") balcao[m] += v;
        else if (canal === "ENTREGA") entrega[m] += v;
        else if (canal === "VENDA") venda[m] += v;
      });

      var state = { meses: MESES, balcao: balcao, entrega: entrega, venda: venda };
      chartStates.chartFaturamentoAnual = state;
      renderFaturamentoAnual(state);
    } catch (e) {
      console.error("Erro Faturamento Anual:", e);
      clearResumo("resumoFaturamentoAnual", "Erro ao carregar faturamento anual.");
      var r = document.getElementById("resumoFaturamentoAnual");
      if (r) r.classList.add("text-danger");
      setWrapperLoading(canvas, false);
    }
  }

  async function loadFaturamentoDia() {
    var canvas = document.getElementById("chartFaturamentoDia");
    try {
      var data = await getJSON("/v2/pedidos/total/dia" + buildDashQS());
      var agrupado = {};
      (data || []).forEach(function (i) {
        var canal = (i.pvcanal || "").trim() || "—";
        var v = parseFloat(i.vl_total_dia) || 0;
        agrupado[canal] = (agrupado[canal] || 0) + v;
      });
      var state = { labels: Object.keys(agrupado), valores: Object.values(agrupado) };
      chartStates.chartFaturamentoDia = state;
      renderFaturamentoDia(state);
    } catch (e) {
      console.error("Erro Faturamento Dia:", e);
      clearResumo("chartFaturamentoDiaResumo", "Erro ao carregar vendas do dia.");
      var r = document.getElementById("chartFaturamentoDiaResumo");
      if (r) r.classList.add("text-danger");
      setWrapperLoading(canvas, false);
    }
  }

  function loadPeriodCharts() {
    loadTopProdutos();
    loadTopMarcas();
    loadFaturamentoAnual();
    loadFaturamentoDia();
  }

  // ------------------------------------------------------------------------
  // KPIs + gráficos fixos (não dependem do filtro de período)
  // ------------------------------------------------------------------------
  async function loadDashboard() {
    try {
      var pend = await jget("/pedidos/pendentescountNow", []);
      var conf = await jget("/pedidos/total/confirmadosNow", []);
      var balcao = await jget("/pedidos/balcaoNow", []);
      var entrega = await jget("/pedidos/entregaNow", []);
      var venda = await jget("/pedidos/vendaNow", []);
      var emfalta = await jget("/total/produto/emfalta", []);
      var acabando = await jget("/total/produto/acabando", []);

      var pendentesCount = toNum(pend && pend[0] && pend[0].count);
      var confirmadosCount = toNum(conf && conf[0] && conf[0].count);
      var balcaoCount = toNum(balcao && balcao[0] && balcao[0].count);
      var entregaCount = toNum(entrega && entrega[0] && entrega[0].count);
      var vendaCount = toNum(venda && venda[0] && venda[0].count);
      var emfaltaCount = toNum(emfalta && emfalta[0] && emfalta[0].count);
      var acabandoCount = toNum(acabando && acabando[0] && acabando[0].count);

      setText("kpiEmFalta", emfaltaCount);
      setText("kpiAcabando", acabandoCount);
      setText("kpiPendentes", pendentesCount);
      setText("kpiConfirmados", confirmadosCount);

      var clientes = await jget("/cli", { total: 0, data: [] });
      var vendedores = await jget("/vendedor/listar", []);
      setText("kpiClientes", toNum(clientes && (clientes.total ?? clientes.length)));
      setText("kpiVendedores", vendedores ? vendedores.length : 0);

      var marcas = await jget("/marcas", []);
      setText("kpiMarcas", marcas ? marcas.length : 0);

      var comEstoque = await jget("/proComEstoque", []);
      var semEstoque = await jget("/proSemEstoque", []);

      chartStates.chartPedidos = { labels: ["Pendentes", "Confirmados"], valores: [pendentesCount, confirmadosCount] };
      chartRenderers.chartPedidos(chartStates.chartPedidos);

      chartStates.chartCanais = { labels: ["Balcão", "Entrega", "Venda"], valores: [balcaoCount, entregaCount, vendaCount] };
      chartRenderers.chartCanais(chartStates.chartCanais);

      chartStates.chartEstoque = { labels: ["Com estoque", "Sem estoque"], valores: [(comEstoque || []).length, (semEstoque || []).length] };
      chartRenderers.chartEstoque(chartStates.chartEstoque);

      var porMarca = {};
      (comEstoque || []).forEach(function (p) {
        var m = p.marcasdes || "—";
        porMarca[m] = (porMarca[m] || 0) + 1;
      });
      var top = Object.entries(porMarca).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
      chartStates.chartTopMarcas = { labels: top.map(function (x) { return x[0]; }), valores: top.map(function (x) { return x[1]; }) };
      chartRenderers.chartTopMarcas(chartStates.chartTopMarcas);
    } catch (e) {
      console.error("Erro dashboard:", e);
    } finally {
      ["chartPedidos", "chartCanais", "chartEstoque", "chartTopMarcas"].forEach(function (id) {
        setWrapperLoading(document.getElementById(id), false);
      });
    }
  }

  // ------------------------------------------------------------------------
  // Troca de tema: reaplica defaults e re-renderiza sem refetch
  // ------------------------------------------------------------------------
  function refreshChartsTheme() {
    DashChart.applyDefaults();
    Object.keys(chartStates).forEach(function (id) {
      var render = chartRenderers[id];
      if (render && chartStates[id]) render(chartStates[id]);
    });
  }
  window.addEventListener("ou:themechange", refreshChartsTheme);

  // ------------------------------------------------------------------------
  // Nome do usuário no hero
  // ------------------------------------------------------------------------
  async function initUserName() {
    try {
      var response = await fetch("/me/usuario", { method: "GET", credentials: "include" });
      if (!response.ok) throw new Error("Falha ao obter usuário");
      var data = await response.json();
      var usuario = data.usunome || "Usuário";
      var h1 = document.querySelector("h1.h4.mb-0");
      if (h1) h1.textContent = "Bem-vindo, " + usuario;
    } catch (err) {
      console.error("Erro ao buscar nome do usuário:", err);
    }
  }

  // ------------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------------
  function boot() {
    initFilter();
    loadDashboard();
    loadPeriodCharts();
    initUserName();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
