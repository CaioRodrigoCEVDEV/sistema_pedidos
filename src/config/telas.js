// Registro das telas que podem ser liberadas individualmente por usuário.
// Para adicionar uma nova tela controlável, inclua um item aqui, proteja a
// rota com o middleware requireTela('<chave>') e associe o item do menu.
// A sincronização com a tabela "telas" acontece no atualizardb().
const TELAS = [
  {
    chave: "dashboard",
    nome: "Dashboard",
    rota: "/dash",
    icone: "bi-speedometer2",
    grupo: "Principal",
    ordem: 1,
  },
  {
    chave: "pedidos",
    nome: "Pedidos",
    rota: "/pedidos",
    icone: "bi-receipt",
    grupo: "Principal",
    ordem: 2,
  },
  {
    chave: "clientes",
    nome: "Clientes",
    rota: "/clientes",
    icone: "bi-people",
    grupo: "Principal",
    ordem: 3,
  },
  {
    chave: "produtos",
    nome: "Produtos",
    rota: "/painel",
    icone: "bi-box-seam",
    grupo: "Catálogo",
    ordem: 4,
  },
  {
    chave: "grupos",
    nome: "Grupos (peças)",
    rota: "/part",
    icone: "bi-diagram-3",
    grupo: "Catálogo",
    ordem: 5,
  },
  {
    chave: "devolucoes",
    nome: "Devoluções",
    rota: "/devolucoes",
    icone: "bi-arrow-counterclockwise",
    grupo: "Operações",
    ordem: 6,
  },
  {
    chave: "estoque",
    nome: "Estoque",
    rota: "/estoque",
    icone: "bi-boxes",
    grupo: "Operações",
    ordem: 7,
  },
  {
    chave: "estoque-grupos",
    nome: "Estoque Grupos",
    rota: "/estoque-grupos",
    icone: "bi-collection",
    grupo: "Operações",
    ordem: 8,
  },
  {
    chave: "relatorios",
    nome: "Relatórios",
    rota: "/relatorios",
    icone: "bi-bar-chart",
    grupo: "Ferramentas",
    ordem: 9,
  },
  {
    chave: "backups",
    nome: "Backups",
    rota: "/backup",
    icone: "bi-database",
    grupo: "Ferramentas",
    ordem: 10,
  },
];

module.exports = TELAS;
