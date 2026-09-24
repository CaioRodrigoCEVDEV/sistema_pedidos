# Continuidade da migração para React

Atualizado em 24/09/2026. Este arquivo registra o ponto de parada para outra
pessoa continuar o trabalho sem depender do histórico da conversa.

## Onde paramos

**As fases 1 a 7 estão implementadas no código. As fases 2 a 7 ainda precisam ser
homologadas com o banco real.** O usuário tentou entrar na área React e recebeu
“Usuário não encontrado”; a investigação mostrou que o e-mail informado não
existe no banco configurado localmente, mas o ambiente correto ainda precisa ser
confirmado. Não houve criação nem alteração de usuário para contornar o relato.

O objetivo é migrar apenas o frontend para React e eliminar o recarregamento
completo ao trocar de tela pelo menu. Backend Express e PostgreSQL permanecem.
A migração é gradual: as páginas antigas continuam disponíveis.

O repositório Git está na pasta interna:

```text
C:\Users\Heitor\Documents\GitHub\sistema_pedidos\sistema_pedidos
```

Os comandos abaixo devem ser executados nessa pasta. No momento desta entrega,
as alterações estão no diretório de trabalho, sem commit desta implementação,
sem PR e sem deploy. Há arquivos novos ainda não rastreados, incluindo
`frontend/`, testes e documentação. Preserve esse trabalho ao continuar.

## Andamento do cronograma

| Etapa                                   | Situação                             | Entrega ou próximo marco                                                               |
| --------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| Fase 1 — base React                     | Implementada e validada pelo usuário | React + Vite, roteamento em `/app/`, cliente de API, build e integração Express/Docker |
| Fase 2 — estrutura e primeiras telas    | Implementada; homologação pendente   | Login, sessão, menu/cabeçalho persistentes, Dashboard e Clientes                       |
| Fechamento da fase 2                    | Homologação pendente                 | Resolver o relato de login e validar os fluxos com banco real                          |
| Fase 3 — catálogo                       | Implementada; homologação pendente    | Produtos, Promoções, Grupos e Vitrines dentro da navegação React                       |
| Fase 4 — operações de venda             | Implementada; homologação pendente   | Pedidos e Devoluções dentro da navegação React                                         |
| Fase 5 — estoque                        | Implementada; homologação pendente   | Estoque individual e Estoque Grupos dentro da navegação React                          |
| Fase 6 — administração                  | Implementada; homologação pendente   | Relatórios, Backup, Usuários, Configurações e Perfil                                   |
| Fase 7 — loja pública                   | Implementada; homologação pendente   | Início, catálogo e carrinho em `/loja/`, com pedido pelo WhatsApp                      |
| Troca da entrada principal e publicação | Pendente                             | Redirecionar o acesso para React somente após homologação e preparar o deploy          |

O usuário comentou que faria alguns ajustes da fase 1 depois, mas não detalhou
quais. Não há datas acordadas nem detalhamento recuperável das fases posteriores
neste registro. A sequência abaixo é uma proposta de continuidade, não um prazo
ou escopo adicional já aprovado.

## Login: evidências e próximo diagnóstico

O usuário mostrou a mensagem “Usuário não encontrado” ao tentar entrar com
`teste@teste.com.br`. A senha não foi solicitada nem inspecionada.

O que já foi conferido:

- `frontend/src/components/Login.jsx` envia `POST /auth/login` com
  `{ usuemail, ususenha }`, os mesmos campos usados pelo login antigo em
  `public/html/auth/js/login.js`.
- `src/controllers/loginController.js` retorna essa mensagem quando a consulta
  `SELECT ... FROM usu WHERE usuemail = $1` não encontra nenhum registro.
- O Vite usa `frontend/.env` para configurar `BACKEND_URL`; sem esse arquivo,
  encaminha as APIs para `http://127.0.0.1:3000`.
- Nesta cópia local, `frontend/.env` não existia e o `.env` do backend estava
  configurado. Não copiar credenciais desse arquivo para documentos ou frontend.
- Foi feita **uma consulta somente de leitura** no banco indicado pelo `.env`
  local, contando correspondências desse e-mail. Resultado: **0 correspondências
  exatas e 0 após normalizar espaços e maiúsculas/minúsculas**. Nenhum usuário,
  senha ou outro registro foi alterado.
- Em 23/09/2026, uma nova conferência confirmou que esse banco está acessível,
  que o nome da base corresponde ao `DB_NAME`, que existem a tabela `usu` e a
  empresa de código 1, e que há **2 usuários disponíveis**. Nenhum dos dois tem
  e-mail vazio, espaços nas pontas ou letras maiúsculas. Isso reforça que a
  tentativa chegou a uma base válida, porém diferente daquela em que o usuário
  espera encontrar o cadastro, ou que o e-mail informado não é o cadastrado.

Isso indica que o e-mail informado não existe na base consultada localmente.
**Ainda não confirma que essa é a mesma base atendendo o navegador do usuário.**
Não tratar como problema de senha nem criar um usuário automaticamente.

Foi perguntado ao usuário qual endereço estava aberto e se o mesmo e-mail
entrava pelo login antigo. Essas respostas ainda não foram recebidas.

Próximos passos, nesta ordem:

1. Confirmar o endereço usado pelo usuário e o backend que o atende. Comparar
   com o destino do proxy e com o ambiente em que o cadastro existe.
2. Comparar o login antigo e o React usando a mesma conta e o mesmo backend.
   O usuário deve digitar a própria senha, sem registrá-la em logs ou documentos.
3. Verificar se o cadastro está na base correta e se o e-mail corresponde ao
   informado. Não alterar o banco para mascarar uma conexão ao ambiente errado.
4. Corrigir a configuração ou o defeito comprovado e validar o login real.
5. Depois do login, conferir `/me/usuario`, `/me/permissoes` e o cookie de sessão.
   Para HTTP local, `HTTPS=false`; para HTTPS, `HTTPS=true`. Não alternar entre
   `localhost` e `127.0.0.1` na mesma sessão.

Nota de execução: `src/app.js` carrega o `.env` da pasta de execução e inicia
rotinas de atualização do banco. `src/config/db.js` também tenta carregar
`../.env`. Não iniciar a aplicação contra um banco desconhecido só para investigar
a conexão; identificar o ambiente primeiro. A consulta de diagnóstico executada
carregou explicitamente o `.env` local e não iniciou `src/app.js`.

## O que a fase 2 entrega

- Área React em `/app/`, com login, sessão compartilhada e tratamento de expiração.
- Menu e cabeçalho persistentes, tema compartilhado e navegação adaptada ao celular.
- Dashboard em `/app/dashboard`: indicadores, gráficos, atualização manual,
  períodos predefinidos e personalizados. O filtro Todos envia `todos=1`;
  chamadas antigas sem esse parâmetro mantêm seus períodos padrão.
- Clientes em `/app/clientes`: busca, paginação, cadastro, edição, inativação,
  exclusão com confirmação, seleção de município e resumo da conta.
- Ficha do cliente: pedidos e detalhes, vínculo/desvínculo, histórico e lançamentos,
  cobranças, registro de pagamento, cancelamento e links de WhatsApp.
- Permissões no menu e nas rotas React, com validação também no servidor para
  as APIs migradas. Não remover essas verificações para resolver acesso negado.

Dashboard e Clientes navegam entre si sem recarregar o documento. **Os demais
itens migrados também usam a navegação interna.** As rotas antigas não foram
substituídas nem redirecionadas.

## O que a fase 3 entrega

- Produtos em `/app/produtos`, com busca, paginação, cadastro, edição e exclusão.
- Cadastros auxiliares de marcas, modelos, tipos e cores na tela de Produtos.
- Promoções em `/app/promocoes`, com produto, desconto, período e situação.
- Grupos em `/app/grupos`, com dados, peças/variações, estoque e histórico.
- Vitrines em `/app/vitrines`, com configuração, ordem, prévia e Destaques.
- Respostas JSON do middleware administrativo para as chamadas React.

Essas quatro entradas usam navegação interna e mantêm o shell montado. As telas
antigas continuam disponíveis para comparação durante a homologação.

## O que a fase 4 entrega

- Pedidos em `/app/pedidos`, com indicadores, filtro de período, abas de
  pendentes e confirmados, detalhes e edição das quantidades.
- Confirmação de pedido com validação transacional de estoque, cancelamento
  individual e cancelamento em lote sem recarregar o documento.
- Devoluções em `/app/devolucoes`, com busca por pedido/peça/cor, período,
  limite de quantidade devolvível, motivo, observação e opção de repor estoque.
- Histórico das últimas devoluções e atualização das duas listas após registrar.
- Permissões de `pedidos` e `devolucoes` validadas no React e nas APIs, incluindo
  a exigência do módulo de vendas da empresa.
- A confirmação registra o vendedor a partir da sessão autenticada; o frontend
  não precisa informar ou confiar em um código de usuário recebido do navegador.

Pedidos e Devoluções agora usam links internos no menu e mantêm o shell React
montado durante a troca de tela. As páginas antigas continuam acessíveis pelas
rotas fora de `/app` para comparação durante a homologação.

## O que a fase 5 entrega

- Estoque em `/app/estoque`, com busca e filtros por marca, modelo e situação.
- Entradas e saídas registradas como diferenças de saldo, com bloqueio de saldo
  negativo e atualização das vitrines e do catálogo após a operação.
- Reconhecimento de variações vinculadas a grupos: o ajuste passa a alterar o
  saldo compartilhado, sincroniza todas as peças e registra auditoria.
- Estoque Grupos em `/app/estoque-grupos`, com período, marca, vendas, saldo,
  quantidade ideal, situação, ajuste rápido e histórico de movimentações.
- Permissões distintas para `estoque` e `estoque-grupos`, exigindo também o
  módulo de estoque ativo na empresa e no usuário.

As duas entradas usam navegação interna no menu. O novo contrato corrige a
ambiguidade da tela antiga, cujo botão “Adicionar” enviava um valor que o backend
tratava como saldo absoluto.

## O que a fase 6 entrega

- Relatórios em `/app/relatorios`, com filtros, agrupamento por peça ou grupo e
  exportação em PDF/Excel, além do PDF de peças cadastradas.
- Backups em `/app/backup`, com busca, filtro por tipo, navegação pelas pastas e
  download dos arquivos disponíveis.
- Usuários em `/app/users`, com busca, cadastro, edição, exclusão, situação,
  perfil de administrador/vendedor e permissões por tela.
- Configurações em `/app/configuracoes`, com dados da empresa, WhatsApp, controle
  de estoque, quantidade mínima e envio da logo.
- Perfil em `/app/perfil`, com atualização do nome e da senha do próprio usuário.
- Permissões administrativas aplicadas também às APIs de usuários, catálogo de
  telas e configurações. Relatórios e backups respeitam suas permissões próprias.
- A atualização de perfil confere o usuário da sessão no servidor e não aceita
  alterar outra conta por troca do código na URL.

Todas essas entradas agora usam a navegação interna do React e mantêm menu e
cabeçalho montados durante a troca de tela. Os downloads continuam sendo feitos
diretamente pelo navegador, sem trocar a página atual.

## O que a fase 7 entrega

- Loja pública React em `/loja/`, separada da área administrativa `/app/`.
- Página inicial com busca, marcas e vitrines configuradas no painel.
- Catálogo em `/loja/catalogo`, com busca, filtros por marca, modelo e tipo,
  promoções, situação de estoque e paginação.
- Escolha da cor disponível antes de adicionar o produto.
- Carrinho persistido no navegador e compatível com a chave `cart` usada pela
  loja antiga, com alteração de quantidade, remoção e observações.
- Revalidação de preço no servidor antes de mostrar o total e antes de concluir.
- Registro do pedido no backend antes de abrir a mensagem pronta no WhatsApp.
- Layout responsivo, tema compartilhado e fallback com a inicial da empresa
  quando o arquivo de logo não existe.

A navegação entre início, catálogo e carrinho mantém o documento carregado. A
entrada antiga `/` continua ativa para permitir comparação e homologação antes
da troca definitiva.

## Mapa dos arquivos principais

Todos os caminhos desta seção são relativos à raiz Git indicada acima.

| Área                       | Arquivos                                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rotas React                | `frontend/src/App.jsx`, `frontend/src/main.jsx`                                                                                                                                                         |
| Sessão e login             | `frontend/src/state/Session.jsx`, `frontend/src/components/Login.jsx`                                                                                                                                   |
| Menu e layout              | `frontend/src/components/Shell.jsx`, `frontend/src/lib/navigation.js`, `frontend/src/styles.css`                                                                                                        |
| API e carregamento         | `frontend/src/api/client.js`, `frontend/src/hooks/useResource.js`, `frontend/src/components/UI.jsx`                                                                                                     |
| Dashboard                  | `frontend/src/pages/DashboardPage.jsx`                                                                                                                                                                  |
| Clientes                   | `frontend/src/pages/ClientsPage.jsx`, `frontend/src/pages/clients/ClientSheet.jsx`, `OrdersTab.jsx`, `FinanceTabs.jsx`                                                                                  |
| Pedidos e Devoluções       | `frontend/src/pages/OrdersPage.jsx`, `frontend/src/pages/ReturnsPage.jsx`                                                                                                                              |
| Estoque                    | `frontend/src/pages/StockPage.jsx`, `frontend/src/pages/GroupStockPage.jsx`, `src/controllers/estoqueController.js`, `src/routes/estoqueRoutes.js`                                                   |
| Administração              | `frontend/src/pages/ReportsPage.jsx`, `BackupsPage.jsx`, `UsersPage.jsx`, `SettingsPage.jsx`, `ProfilePage.jsx`                                                                                       |
| Loja pública               | `frontend/src/store/StorefrontApp.jsx`, `StoreShell.jsx`, `CartContext.jsx`, `StoreProductCard.jsx`, `frontend/src/store/pages/`                                                                      |
| Build e proxy              | `frontend/package.json`, `frontend/package-lock.json`, `frontend/vite.config.js`, `Dockerfile`                                                                                                          |
| HTML React no Express      | `src/routes/frontendRoutes.js`, registro em `src/app.js`                                                                                                                                                |
| Autenticação e autorização | `src/controllers/loginController.js`, `src/controllers/telaController.js`, `src/middlewares/middlewares.js`, `src/middlewares/telaMiddleware.js`                                                        |
| APIs ajustadas             | `src/routes/cliRoutes.js`, `src/routes/dashboardRoutes.js`, `src/routes/pedidosRoutesV2.js`, `src/controllers/cliController.js`, `src/controllers/pedidosControllerV2.js`, `src/models/pedidoModels.js` |

Foi adicionada a rota `GET /cli/:id/pedidos/:pvcod/itens`, que verifica o vínculo
entre pedido e cliente antes de consultar os itens. As APIs de Clientes e os
indicadores do Dashboard passaram a exigir a permissão da respectiva tela.

## Validações já realizadas

- Build de produção concluído com sucesso.
- `npm run test:frontend`: **69 testes passaram** — 29 de integração/backend,
  11 de utilitários/cliente de API e 29 de interface React.
- `node tests/loginAttempts.test.js`: **5 testes passaram**.
- No navegador, com dados fictícios, a navegação Dashboard → Clientes → Dashboard
  manteve **uma única requisição de documento**. O cabeçalho permaneceu montado.
- Inspeção visual em computador e celular, abertura da ficha do cliente, menu
  móvel e atualização direta de `/app/dashboard`. Nenhum erro de console foi
  observado na conferência final.
- Na loja fictícia, início → catálogo → seleção de cor → carrinho manteve
  **uma única requisição de documento**. O carrinho foi conferido em computador
  e celular, sem erros de console. O envio final não foi acionado nessa inspeção.
- `git diff --check` passou ao concluir a implementação.

Os testes de interface usam uma API simulada. **Eles não comprovaram o login ou
as operações com o banco real.** A consulta de e-mail descrita acima foi feita
depois, durante o diagnóstico, e não substitui a homologação.

O servidor de prévia com dados fictícios usado na validação foi encerrado.

## Como executar

Usar Node 22.12+; o build foi validado com Node 24. Dependências do frontend
têm instalação e lockfile próprios.

```sh
npm --prefix frontend ci
npm run build:frontend
npm run test:frontend
node tests/loginAttempts.test.js
```

Após conferir o ambiente/banco, iniciar o backend e, em outro terminal, o Vite:

```sh
npm run dev
```

```sh
npm run dev:frontend
```

Acessar `http://127.0.0.1:5173/app/` para o painel ou
`http://127.0.0.1:5173/loja/` para a loja. No build servido pelo backend, usar
as mesmas rotas na porta 3000.

Para inspecionar somente a interface, sem banco, após gerar o build:

```sh
node tests/frontendPreviewServer.js
```

A prévia fica em `http://127.0.0.1:3012/app/` e
`http://127.0.0.1:3012/loja/`, usando dados fictícios em memória.
Não confundir esse servidor com o sistema conectado ao banco.

## Checklist para concluir a fase 2

- [ ] Resolver o relato de login e confirmar o ambiente correto.
- [ ] Validar administrador e usuário comum, sessão expirada e acesso negado.
- [ ] Comparar indicadores e filtros do Dashboard com as consultas do sistema atual.
- [ ] Homologar Clientes com registros de teste: cadastro, edição, pedidos, conta
      e cobranças, incluindo falhas e restrições do backend.
- [ ] Conferir uso em computador/celular e retorno às páginas antigas.
- [ ] Levantar os ajustes visuais que o usuário deixou para depois.
- [ ] Registrar a aprovação da fase 2 antes de considerar encerrada a homologação.

## Sequência sugerida após a homologação

1. ~~Migrar as telas de catálogo: Produtos, Promoções, Grupos e Vitrines.~~
2. ~~Migrar Pedidos e Devoluções, preservando cálculos, permissões e transações.~~
3. ~~Migrar Estoque e Estoque Grupos, validando movimentações e saldos.~~
4. ~~Migrar Relatórios, Backup, Usuários, Configurações e Perfil.~~
5. ~~Migrar a loja pública: início, catálogo e carrinho.~~
6. Fazer a homologação completa e preparar a entrada principal e a publicação.

Confirmar essa ordem com o responsável pelo projeto. Para cada módulo, mapear
as APIs e permissões, implementar a tela, comparar com o legado e homologar
antes de substituir a entrada antiga. Não há estimativas de prazo acordadas.

O Dockerfile já compila o frontend. O deploy por SSH usa scripts externos ao
repositório; ainda é necessário garantir que instalem/compilem o frontend ou
recebam `frontend/dist`. Não houve publicação nesta entrega.

Detalhes adicionais de arquitetura e execução: [react-migration.md](react-migration.md).
