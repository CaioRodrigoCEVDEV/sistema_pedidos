function createHeaderUser() {
  const header = document.getElementById("header");
  if (!header) return;
  header.className = "ou-store-header";
  const current = (window.location.pathname || "").toLowerCase();
  const isActive = (name) => (current.includes(name) ? " active" : "");
  header.innerHTML = `
  <nav class="navbar navbar-expand-lg">
    <div class="container-fluid" style="max-width: 1100px;">
      <a class="ou-store-brand" href="index" id="nomeEmpresa"><img src="/uploads/logo.jpg" width="32" height="32" alt="Logo" /></a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
          aria-controls="navbarNav" aria-expanded="false" aria-label="Alterna navegação">
          <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
              <li class="nav-item">
                  <a class="nav-link${isActive("index") || current === "/" ? " active" : ""}" href="index">Início</a>
              </li>
              <li class="nav-item">
                  <a class="nav-link${isActive("pedidos")}" href="pedidos"><i class="bi bi-receipt me-1"></i>Acesso</a>
              </li>
          </ul>
          <div class="d-flex align-items-center gap-2 mt-2 mt-lg-0">
              <div class="dropdown">
                <button class="btn btn-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" id="themeToggleBtn" title="Aparência">
                  <i class="bi bi-circle-half"></i><span class="d-none d-sm-inline"> Tema</span>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li><button class="dropdown-item" type="button" data-ou-theme="light"><i class="bi bi-sun me-2"></i>Claro</button></li>
                  <li><button class="dropdown-item" type="button" data-ou-theme="dark"><i class="bi bi-moon me-2"></i>Escuro</button></li>
                  <li><button class="dropdown-item" type="button" data-ou-theme="auto"><i class="bi bi-display me-2"></i>Automático</button></li>
                </ul>
              </div>
          </div>
      </div>
    </div>
  </nav>
  `;
  header.querySelectorAll("[data-ou-theme]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pref = btn.getAttribute("data-ou-theme");
      if (window.OrderUpTheme && typeof window.OrderUpTheme.set === "function") {
        window.OrderUpTheme.set(pref);
      } else {
        try { localStorage.setItem("sistema_pedidos_theme", pref); } catch (e) {}
        document.documentElement.setAttribute("data-theme", pref === "dark" ? "dark" : "light");
        document.documentElement.setAttribute("data-bs-theme", pref === "dark" ? "dark" : "light");
      }
    });
  });
}
document.addEventListener("DOMContentLoaded", createHeaderUser);


function createFooter() {
  const footer = document.getElementById("footer");
  if (!footer) return;
  footer.className = "ou-store-footer border-top py-3 mt-5";
  footer.innerHTML = `
      <div class="container d-flex justify-content-center align-items-center">
      <a
        href="https://www.orderup.com.br"
        class="text-decoration-none"
        style="font-size: 11px; opacity: .75; color: var(--ou-text-muted);"
        target="_blank"
        rel="noopener noreferrer"
      >
        Desenvolvido com OrderUp
      </a>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", createFooter);
