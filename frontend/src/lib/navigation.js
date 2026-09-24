export function canAccess(p, key, module) {
  if (!p) return false;
  if (module && p[module === "pv" ? "empusapv" : "empusaest"] !== "S") return false;
  if (p.usuadm === "S") return true;
  if (module && p[module === "pv" ? "usupv" : "usuest"] !== "S") return false;
  return key === "always" || (key !== "admin" && Boolean(p.telas?.includes(key)));
}
export const navigation = [
  {
    title: "Principal",
    items: [
      { label: "Ir para a loja", href: "/loja", key: "always", icon: "⌂" },
      { label: "Dashboard", to: "/dashboard", key: "dashboard", icon: "◴" },
      { label: "Pedidos", to: "/pedidos", key: "pedidos", module: "pv", icon: "▤" },
      { label: "Clientes", to: "/clientes", key: "clientes", icon: "♙" },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { label: "Produtos", to: "/produtos", key: "produtos", icon: "▦" },
      { label: "Promoções", to: "/promocoes", key: "promocoes", icon: "%" },
      { label: "Grupos", to: "/grupos", key: "grupos", icon: "⋈" },
      { label: "Vitrines", to: "/vitrines", key: "admin", icon: "▣" },
    ],
  },
  {
    title: "Operações",
    items: [
      { label: "Devoluções", to: "/devolucoes", key: "devolucoes", module: "pv", icon: "↩" },
      { label: "Estoque", to: "/estoque", key: "estoque", module: "est", icon: "▧" },
      { label: "Estoque Grupos", to: "/estoque-grupos", key: "estoque-grupos", module: "est", icon: "▥" },
    ],
  },
  {
    title: "Ferramentas",
    items: [
      { label: "Relatórios", to: "/relatorios", key: "relatorios", icon: "▥" },
      { label: "Backup", to: "/backup", key: "backups", icon: "▱" },
      { label: "Usuários", to: "/users", key: "admin", icon: "♙" },
    ],
  },
  {
    title: "Preferências",
    items: [
      { label: "Configurações", to: "/configuracoes", key: "admin", icon: "⚙" },
      { label: "Minha conta", to: "/perfil", key: "always", icon: "○" },
    ],
  },
];
