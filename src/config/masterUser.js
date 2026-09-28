// Identidade do usuário master do sistema.
//
// O master é o usuário default criado em atualizardb.js
// ('orderup' / admin@orderup.com.br). Ele não aparece na lista de usuários e
// tem acesso a todas as telas, independentemente das liberações em usu_telas.
//
// Centralizado aqui para que a regra de identificação seja a mesma em todos os
// pontos (middleware de tela, montagem do menu, listagens e relatórios).
const MASTER_EMAIL = "admin@orderup.com.br";

// Comparação tolerante a caixa/espaços, já que o e-mail vem do token JWT.
function isMasterUser(usuario) {
  if (!usuario || typeof usuario.usuemail !== "string") return false;
  return usuario.usuemail.trim().toLowerCase() === MASTER_EMAIL;
}

module.exports = { MASTER_EMAIL, isMasterUser };
