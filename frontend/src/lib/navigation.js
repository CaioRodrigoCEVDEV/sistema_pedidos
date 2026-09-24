// A única fonte de autorização são as "telas liberadas" do usuário
// (tela de Usuários). Não há bypass de administrador nem gating por módulo.
export function canAccess(p, key) {
  if (!p) return false;
  return key === "always" || Boolean(p.telas?.includes(key));
}
export const navigation = [
  {
    title: "Principal",
    items: [
      { label: "Ir para a loja", href: "/loja", key: "always", icon: "⌂" },
      { label: "Dashboard", to: "/dashboard", key: "dashboard", icon: "◴" },
      { label: "Pedidos", to: "/pedidos", key: "pedidos", icon: "▤" },
      { label: "Clientes", to: "/clientes", key: "clientes", icon: "♙" },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { label: "Produtos", to: "/produtos", key: "produtos", icon: "▦" },
      { label: "Promoções", to: "/promocoes", key: "promocoes", icon: "%" },
      { label: "Grupos", to: "/grupos", key: "grupos", icon: "⋈" },
      { label: "Vitrines", to: "/vitrines", key: "vitrines", icon: "▣" },
    ],
  },
  {
    title: "Operações",
    items: [
      { label: "Devoluções", to: "/devolucoes", key: "devolucoes", icon: "↩" },
      { label: "Estoque", to: "/estoque", key: "estoque", icon: "▧" },
      { label: "Estoque Grupos", to: "/estoque-grupos", key: "estoque-grupos", icon: "▥" },
    ],
  },
  {
    title: "Ferramentas",
    items: [
      { label: "Relatórios", to: "/relatorios", key: "relatorios", icon: "▥" },
      { label: "Backup", to: "/backup", key: "backups", icon: "▱" },
      { label: "Usuários", to: "/users", key: "usuarios", icon: "♙" },
    ],
  },
  {
    title: "Preferências",
    items: [
      { label: "Configurações", to: "/configuracoes", key: "configuracoes", icon: "⚙" },
      { label: "Minha conta", to: "/perfil", key: "always", icon: "○" },
    ],
  },
];
