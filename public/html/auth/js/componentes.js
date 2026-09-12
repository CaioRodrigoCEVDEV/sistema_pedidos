/* ==========================================================================
   Componentes globais do shell autenticado (sidebar + topbar + drawer).
   Injetado em páginas que possuem <header id="header-admin">.
   ========================================================================== */

/**
 * Menu lateral configurável. Personalize livremente.
 * { href, route, label, icon, perm } — "route" é o caminho absoluto usado para
 * marcar o item ativo; "icon" é uma classe de Bootstrap Icons.
 * "perm" define a regra de visibilidade:
 *   always       -> sempre visível
 *   admin        -> somente administrador
 *   tela:<chave> -> tela liberada em usu_telas
 */
var OU_NAV_GROUPS = [
  {
    title: "Principal",
    items: [
      { href: "/index", route: "/index", label: "Ir para a loja", icon: "bi-shop", perm: "always" },
      {
        href: "/dash",
        route: "/dash",
        label: "Dashboard",
        icon: "bi-speedometer2",
        perm: "tela:dashboard",
      },
      { href: "/pedidos", route: "/pedidos", label: "Pedidos", icon: "bi-receipt", perm: "tela:pedidos" },
      { href: "/clientes", route: "/clientes", label: "Clientes", icon: "bi-people", perm: "tela:clientes" },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/painel", route: "/painel", label: "Produtos", icon: "bi-box-seam", perm: "tela:produtos" },
      { href: "/part", route: "/part", label: "Grupos", icon: "bi-diagram-3", perm: "tela:grupos" },
    ],
  },
  {
    title: "Operações",
    items: [
      {
        href: "/devolucoes",
        route: "/devolucoes",
        label: "Devoluções",
        icon: "bi-arrow-counterclockwise",
        perm: "tela:devolucoes",
      },
      { href: "/estoque", route: "/estoque", label: "Estoque", icon: "bi-boxes", perm: "tela:estoque" },
      {
        href: "/estoque-grupos",
        route: "/estoque-grupos",
        label: "Estoque Grupos",
        icon: "bi-collection",
        perm: "tela:estoque-grupos",
      },
    ],
  },
  {
    title: "Ferramentas",
    items: [
      {
        href: "/relatorios",
        route: "/relatorios",
        label: "Relatórios",
        icon: "bi-bar-chart",
        perm: "tela:relatorios",
      },
      { href: "/backup", route: "/backup", label: "Backup", icon: "bi-database", perm: "tela:backups" },
      {
        href: "/users",
        route: "/users",
        label: "Usuários",
        icon: "bi-person-badge",
        perm: "admin",
      },
    ],
  },
  {
    title: "Preferências",
    items: [
      {
        href: "/configuracoes",
        route: "/configuracoes",
        label: "Configurações",
        icon: "bi-gear",
        perm: "admin",
      },
      {
        href: "/perfil",
        route: "/perfil",
        label: "Minha conta",
        icon: "bi-person-circle",
        perm: "always",
      },
    ],
  },
];

function ouGetInitials(name) {
  if (!name) return "U";
  var parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  return parts
    .slice(0, 2)
    .map(function (part) {
      return part.charAt(0).toUpperCase();
    })
    .join("");
}

function ouNormalizePath(path) {
  if (!path) return "/";
  var clean = path.replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}

function ouIsActiveRoute(route) {
  var current = ouNormalizePath(window.location.pathname);
  var target = ouNormalizePath(route);
  if (target === "/") return current === "/";
  return current === target || current.indexOf(target + "/") === 0;
}

function ouBuildSidebar(navGroups) {
  var groups = (navGroups || OU_NAV_GROUPS).map(function (group) {
    var links = group.items
      .map(function (item) {
        return (
          '<a class="ou-navlink" data-route="' +
          item.route +
          '" href="' +
          item.route +
          '">' +
          '<i class="bi ' +
          item.icon +
          '" aria-hidden="true"></i>' +
          "<span>" +
          item.label +
          "</span>" +
          "</a>"
        );
      })
      .join("");

    return (
      '<div class="ou-navgroup">' +
      '<div class="ou-navgroup__title">' +
      group.title +
      "</div>" +
      links +
      "</div>"
    );
  }).join("");

  return (
    '<aside class="ou-sidebar" id="ouSidebar" aria-label="Menu principal">' +
    '<div class="ou-sidebar__brand">' +
    '<a id="nomeEmpresa" href="/index">' +
    '<span class="ou-sidebar__logo"><img src="/uploads/logo.jpg" alt="" /></span>' +
    "<span>" +
    '<span class="ou-sidebar__title company-name">OrderUp</span>' +
    '<span class="ou-sidebar__tagline">Sistema de Pedidos</span>' +
    "</span>" +
    "</a>" +
    '<button type="button" class="ou-sidebar__close" id="ouDrawerClose" aria-label="Fechar menu">' +
    '<i class="bi bi-x-lg" aria-hidden="true"></i>' +
    "</button>" +
    "</div>" +
    '<nav class="ou-sidebar__nav" aria-label="Navegação principal">' +
    groups +
    "</nav>" +
    '<div class="ou-sidebar__footer">' +
    '<button type="button" class="ou-navlink js-logout">' +
    '<i class="bi bi-box-arrow-right" aria-hidden="true"></i>' +
    "<span>Sair</span>" +
    "</button>" +
    "</div>" +
    "</aside>"
  );
}

function ouBuildTopbar() {
  return (
    '<div class="ou-topbar__left">' +
    '<button type="button" class="ou-icon-btn ou-menu-btn" id="ouMenuBtn" aria-label="Abrir menu" aria-expanded="false">' +
    '<i class="bi bi-list" aria-hidden="true"></i>' +
    "</button>" +
    '<a class="ou-topbar__brand d-lg-none" href="/index" aria-label="Ir para a loja">' +
    '<span class="ou-topbar__brand-logo"><img src="/uploads/logo.jpg" alt="" /></span>' +
    "</a>" +
    "</div>" +
    '<div class="ou-topbar__actions">' +
    '<div class="dropdown">' +
    '<button type="button" class="ou-icon-btn" id="ouQuickTheme" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" aria-label="Alterar tema" title="Alterar tema">' +
    '<i class="bi bi-circle-half" aria-hidden="true"></i>' +
    "</button>" +
    '<ul class="dropdown-menu dropdown-menu-end ou-theme-menu" aria-label="Aparência">' +
    '<li class="dropdown-header">Aparência</li>' +
    '<li><button type="button" class="dropdown-item" data-theme-pref="light"><i class="bi bi-sun" aria-hidden="true"></i> Claro <i class="bi bi-check2 ou-theme-menu__check" aria-hidden="true"></i></button></li>' +
    '<li><button type="button" class="dropdown-item" data-theme-pref="dark"><i class="bi bi-moon" aria-hidden="true"></i> Escuro <i class="bi bi-check2 ou-theme-menu__check" aria-hidden="true"></i></button></li>' +
    '<li><button type="button" class="dropdown-item" data-theme-pref="auto"><i class="bi bi-circle-half" aria-hidden="true"></i> Automático <i class="bi bi-check2 ou-theme-menu__check" aria-hidden="true"></i></button></li>' +
    "</ul>" +
    "</div>" +
    '<div class="dropdown">' +
    '<button type="button" class="ou-user-btn" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Menu do usuário">' +
    '<span class="ou-user-avatar" id="ouUserAvatar">U</span>' +
    '<span class="ou-user-name" id="ouUserName">Usuário</span>' +
    '<i class="bi bi-chevron-down" aria-hidden="true"></i>' +
    "</button>" +
    '<ul class="dropdown-menu dropdown-menu-end ou-user-menu">' +
    '<li class="ou-user-menu__head">' +
    '<strong id="ouMenuName">Usuário autenticado</strong>' +
    '<span id="ouMenuEmail">Conta ativa</span>' +
    "</li>" +
    '<li><a class="dropdown-item" href="/perfil"><i class="bi bi-person-circle" aria-hidden="true"></i> Minha conta</a></li>' +
    '<li><a class="dropdown-item" href="/configuracoes"><i class="bi bi-gear" aria-hidden="true"></i> Configurações</a></li>' +
    '<li><hr class="dropdown-divider" /></li>' +
    '<li><button type="button" class="dropdown-item js-logout"><i class="bi bi-box-arrow-right" aria-hidden="true"></i> Sair</button></li>' +
    "</ul>" +
    "</div>" +
    "</div>"
  );
}

function ouSetActiveLinks() {
  var links = document.querySelectorAll(".ou-navlink[data-route]");
  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    var active = ouIsActiveRoute(link.getAttribute("data-route"));
    link.classList.toggle("active", active);
    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

function ouWireDrawer() {
  var body = document.body;
  var menuBtn = document.getElementById("ouMenuBtn");
  var closeBtn = document.getElementById("ouDrawerClose");
  var overlay = document.getElementById("ouDrawerOverlay");
  var sidebar = document.getElementById("ouSidebar");

  function openDrawer() {
    body.classList.add("ou-drawer-open");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
    var firstLink = sidebar && sidebar.querySelector(".ou-navlink");
    if (firstLink) window.requestAnimationFrame(function () { firstLink.focus(); });
  }

  function closeDrawer() {
    body.classList.remove("ou-drawer-open");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      if (body.classList.contains("ou-drawer-open")) closeDrawer();
      else openDrawer();
    });
  }
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  if (overlay) overlay.addEventListener("click", closeDrawer);
  if (sidebar) {
    sidebar.addEventListener("click", function (event) {
      if (event.target.closest("a.ou-navlink")) closeDrawer();
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && body.classList.contains("ou-drawer-open")) {
      closeDrawer();
    }
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth >= 992) closeDrawer();
  });
}

function ouThemeIcon(pref) {
  if (pref === "dark") return "bi-moon";
  if (pref === "light") return "bi-sun";
  return "bi-circle-half";
}

var ouThemeLabels = {
  light: "Claro",
  dark: "Escuro",
  auto: "Automático",
};

function ouWireThemeToggle() {
  var btn = document.getElementById("ouQuickTheme");
  if (!btn || !window.OrderUpTheme) return;

  var dropdown = btn.parentElement;
  var items = dropdown ? dropdown.querySelectorAll("[data-theme-pref]") : [];

  function refresh() {
    var pref = window.OrderUpTheme.get();
    var label = ouThemeLabels[pref] || ouThemeLabels.auto;
    var icon = btn.querySelector("i");
    if (icon) icon.className = "bi " + ouThemeIcon(pref);
    btn.setAttribute("title", "Tema: " + label);
    btn.setAttribute("aria-label", "Tema: " + label + " — alterar");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle(
        "active",
        items[i].getAttribute("data-theme-pref") === pref
      );
    }
  }

  for (var i = 0; i < items.length; i++) {
    items[i].addEventListener("click", function () {
      window.OrderUpTheme.set(this.getAttribute("data-theme-pref"));
      if (window.bootstrap && bootstrap.Dropdown) {
        var dd = bootstrap.Dropdown.getInstance(btn);
        if (dd) dd.hide();
      }
    });
  }

  window.addEventListener("ou:themechange", refresh);
  refresh();
}

function ouWireLogout(root) {
  var scope = root || document;
  var buttons = scope.querySelectorAll(".js-logout");
  for (var i = 0; i < buttons.length; i++) {
    if (buttons[i].dataset.ouLogoutBound) continue;
    buttons[i].dataset.ouLogoutBound = "1";
    buttons[i].addEventListener("click", function (event) {
      event.preventDefault();
      try { localStorage.removeItem("usuarioLogado"); } catch (err) { /* noop */ }

      fetch("/auth/sair", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }).finally(function () {
        window.location.href = "/login";
      });
    });
  }
}

function ouLoadUser() {
  fetch("/me/usuario", { credentials: "include" })
    .then(function (response) {
      if (!response.ok) throw new Error("not authenticated");
      return response.json();
    })
    .then(function (data) {
      var name = (data && data.usunome) || "";
      if (!name) return;
      var initials = ouGetInitials(name);
      var avatar = document.getElementById("ouUserAvatar");
      var userName = document.getElementById("ouUserName");
      var menuName = document.getElementById("ouMenuName");
      var menuEmail = document.getElementById("ouMenuEmail");
      if (avatar) avatar.textContent = initials;
      if (userName) userName.textContent = name;
      if (menuName) menuName.textContent = name;
      if (menuEmail) menuEmail.textContent = "Conta ativa";
    })
    .catch(function () { /* mantém os fallbacks */ });
}

/**
 * Feedback não intrusivo (substitui o alert() nativo).
 * Mantém o padrão visual do Design System nos temas claro e escuro.
 */
function ouToast(message, type) {
  type = type || "info";
  var icons = {
    success: "bi-check-circle-fill",
    error: "bi-x-circle-fill",
    warning: "bi-exclamation-triangle-fill",
    info: "bi-info-circle-fill",
  };

  var container = document.getElementById("ouToastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "ouToastContainer";
    container.className = "ou-toast-container";
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }

  var toast = document.createElement("div");
  toast.className = "ou-toast ou-toast--" + type;
  toast.innerHTML =
    '<i class="bi ' +
    (icons[type] || icons.info) +
    '" aria-hidden="true"></i><span></span>';
  toast.querySelector("span").textContent = message;
  container.appendChild(toast);

  window.requestAnimationFrame(function () {
    toast.classList.add("ou-toast--in");
  });

  window.setTimeout(function () {
    toast.classList.remove("ou-toast--in");
    window.setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 220);
  }, 3200);

  return toast;
}
window.ouToast = ouToast;

// Filtra os grupos do menu conforme as permissões do usuário.
function ouFilterNavGroups(perms) {
  if (!perms) return OU_NAV_GROUPS;

  var isAdmin = perms.usuadm === "S";
  var telas = perms.telas || [];

  function isAllowed(item) {
    var perm = item.perm || "always";
    if (isAdmin) return true;
    if (perm === "always") return true;
    if (perm === "admin") return false;
    if (perm.indexOf("tela:") === 0) {
      return telas.indexOf(perm.slice(5)) !== -1;
    }
    return true;
  }

  return OU_NAV_GROUPS.map(function (group) {
    return {
      title: group.title,
      items: group.items.filter(isAllowed),
    };
  }).filter(function (group) {
    return group.items.length > 0;
  });
}

function ouMountSidebar(navGroups) {
  var sidebar = document.getElementById("ouSidebar");
  if (!sidebar) {
    document.body.insertAdjacentHTML("afterbegin", ouBuildSidebar(navGroups));
  }
  ouSetActiveLinks();
  ouWireDrawer();
  ouWireLogout();
}

function createHeader() {
  var header = document.getElementById("header-admin");
  if (!header) return;
  header.classList.add("ou-topbar");
  header.innerHTML = ouBuildTopbar();

  if (!document.getElementById("ouDrawerOverlay")) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<div class="ou-drawer-overlay" id="ouDrawerOverlay" aria-hidden="true"></div>'
    );
  }

  document.body.classList.add("ou-has-shell");

  ouWireThemeToggle();
  ouWireLogout(header);
  ouLoadUser();

  fetch("/me/permissoes", { credentials: "include" })
    .then(function (response) {
      return response.ok ? response.json() : null;
    })
    .then(function (perms) {
      ouMountSidebar(ouFilterNavGroups(perms));
    })
    .catch(function () {
      ouMountSidebar(OU_NAV_GROUPS);
    });
}

document.addEventListener("DOMContentLoaded", createHeader);

/* O rodapé institucional é exclusivo da loja (rotas públicas).
   No shell autenticado o footer é removido. */
function removeFooter() {
  var footer = document.getElementById("footer");
  if (footer && footer.parentNode) footer.parentNode.removeChild(footer);
}
document.addEventListener("DOMContentLoaded", removeFooter);

// Hide "Estoque do Grupo" card in the part groups details view
document.addEventListener("DOMContentLoaded", function () {
  // Only run on pages with the group details section
  var detalhesGrupo = document.getElementById("detalhesGrupo");
  if (!detalhesGrupo) return;

  // Find the card subtitle containing "Estoque do Grupo" and hide its parent column
  var subtitles = detalhesGrupo.querySelectorAll(".card-subtitle");
  subtitles.forEach(function (subtitle) {
    if (subtitle.textContent.trim() === "Estoque do Grupo") {
      var parentCol = subtitle.closest(".col-md-4");
      if (parentCol) {
        parentCol.style.display = "none";
      }
    }
  });
});
