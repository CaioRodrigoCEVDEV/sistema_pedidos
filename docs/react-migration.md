# Migração do frontend — fases 1 a 7

Para retomar o trabalho, consulte [o registro de continuidade](CONTINUIDADE_REACT.md),
incluindo o diagnóstico de login ainda pendente e o checklist de homologação.

## Entrega atual

A área administrativa React está disponível em `/app/`, com login próprio, menu
e cabeçalho persistentes. A loja pública React está em `/loja/`. As telas
migradas usam navegação interna, preservam o estado durante a sessão e suportam
voltar, avançar e abrir uma rota diretamente.

| Fase         | Situação                                          | Entrega                                                                 |
| ------------ | ------------------------------------------------- | ----------------------------------------------------------------------- |
| 1            | Implementada                                      | React, Vite, roteamento, cliente de API e integração com Express/Docker |
| 2            | Implementada; pendente homologação com banco real | Layout compartilhado, sessão, permissões, Dashboard e Clientes          |
| 3            | Implementada; pendente homologação                 | Produtos, Promoções, Grupos e Vitrines                                  |
| 4            | Implementada; pendente homologação                 | Pedidos e Devoluções                                                     |
| 5            | Implementada; pendente homologação                 | Estoque e Estoque Grupos                                                 |
| 6            | Implementada; pendente homologação                 | Relatórios, Backup, Usuários, Configurações e Perfil                    |
| 7            | Implementada; pendente homologação                 | Loja pública, catálogo, carrinho e finalização por WhatsApp             |

As rotas antigas continuam disponíveis para comparação. A entrada `/` ainda
serve a loja anterior; a troca para `/loja/` será feita após a homologação.

### Dashboard

- Indicadores de pedidos, estoque, marcas, clientes e vendedores.
- Produtos e marcas mais vendidos, vendas por canal e por mês.
- Períodos predefinidos, intervalo personalizado e filtro Todos.
- Estados de carregamento, ausência de dados, falha e atualização manual.
- Separação explícita entre os indicadores atuais e os gráficos por período.

### Clientes

- Busca e paginação, cadastro, edição, inativação e exclusão com confirmação.
- Ficha com dados cadastrais, seleção de município e resumo da conta.
- Pedidos vinculados, detalhes dos itens, vínculo e desvínculo de pedidos.
- Histórico e lançamentos de conta, cobranças, registro de pagamento e cancelamento.
- Link de WhatsApp e proteção contra envio duplicado das ações.

As regras de negócio e o banco permanecem no backend Express. Os testes usam
dados fictícios e não executam migrações nem operações no banco configurado.

## Execução local

Use Node 22.12+; Node 24 reproduz o estágio de build Docker. Execute os comandos
a partir da pasta que contém o `package.json` do backend.

Instale o frontend uma vez, ou quando seu lockfile mudar:

```sh
npm --prefix frontend ci
```

Inicie o backend com o banco e o `.env` já configurados:

```sh
npm run dev
```

Em outro terminal:

```sh
npm run dev:frontend
```

Abra `http://127.0.0.1:5173/app/` para o painel ou
`http://127.0.0.1:5173/loja/` para a loja. O Vite encaminha tudo fora de
`/app` e `/loja` para `http://127.0.0.1:3000`: APIs, arquivos
públicos e páginas antigas. Para outra porta, copie `frontend/.env.example`
para `frontend/.env`, ajuste `BACKEND_URL` e reinicie o Vite.

Evite alternar entre `localhost` e `127.0.0.1`, pois os cookies pertencem a
hosts distintos. Use `HTTPS=false` no desenvolvimento por HTTP e `HTTPS=true`
quando o acesso ao sistema usar HTTPS. O frontend usa o cookie HttpOnly,
não lê o token e não grava credenciais em localStorage. O proxy dispensa
alterações de CORS. O `.env` do backend não é incluído no frontend.

## Compilação e testes

```sh
npm run build:frontend
npm run test:frontend
```

A suíte cobre o fallback Express, autenticação, autorização das APIs, filtros,
navegação persistente, login e operações das telas com dados fictícios. Os
testes não iniciam `src/app.js` nem chamam `atualizarDB()`.

Para repetir a inspeção visual isolada, após compilar:

```sh
node tests/frontendPreviewServer.js
```

Esse servidor usa somente dados fictícios em memória e abre a aplicação em
`http://127.0.0.1:3012/app/` e `http://127.0.0.1:3012/loja/`. Não serve para
homologar o banco real.

Com o backend real em execução, o build fica disponível em
`http://127.0.0.1:3000/app/` e `http://127.0.0.1:3000/loja/`. O Express devolve
o HTML nas subrotas de `/app` e `/loja`,
permitindo atualizar e abrir endereços diretamente. Arquivos ausentes retornam 404. Sem build, `/app/` retorna 503 com instrução de compilação. O HTML revalida
o cache; os assets com hash têm cache de um ano. As telas são carregadas em
arquivos separados sob demanda.

`npm --prefix frontend run preview` permite conferir o build na porta 4173,
com proxy para o backend. Não é um servidor de produção. `dist` não é versionado.

## Sessão, permissões e integração

- `/me/usuario` e `/me/permissoes` alimentam o estado compartilhado da sessão.
- Menu e rotas respeitam permissões por tela e habilitação de módulos.
- As APIs de Clientes, resumo do Dashboard e quatro consultas de gráficos
  também verificam a permissão no servidor. Ocultar o menu não substitui essa checagem.
- APIs retornam 401 JSON para sessão ausente/expirada e 403 JSON para acesso
  negado. Navegações HTML legadas mantêm seu redirecionamento.
- Uma resposta 401 limpa a área autenticada e apresenta o login na rota atual.
- `GET /cli/:id/pedidos/:pvcod/itens` verifica o vínculo do pedido ao cliente
  antes de reutilizar a consulta de detalhes existente.
- O filtro Todos envia `todos=1` nas quatro consultas de gráficos. Requisições
  antigas sem esse parâmetro preservam seus períodos padrão.
- O tema reutiliza `public/css/theme.css` e `/js/theme-manager.js`, com a mesma
  preferência `sistema_pedidos_theme`. Scripts das telas antigas e Turbo não são
  carregados na área React.

## Publicação e homologação

O Dockerfile compila o frontend em um estágio Node 24 separado e copia somente
`dist` para a imagem final. O runtime do backend permanece como estava. A
`.dockerignore` exclui dependências locais e arquivos `.env`.

O workflow de deploy por SSH chama scripts externos que não estão neste
repositório. Eles precisam instalar/compilar o frontend, ou receber
`frontend/dist` compilado em CI, antes de reiniciar o serviço. Esta implementação
não realizou deploy nem alterações no banco.

Antes de direcionar a entrada principal para React, homologar no ambiente de
desenvolvimento com contas e registros de teste:

- Login, expiração de sessão e permissões reais de administrador e usuário.
- Indicadores e filtros comparados com o sistema atual.
- Cadastro, pedidos, conta e cobranças em Clientes, inclusive erros de negócio.
- Retorno às páginas antigas e comportamento em computador/celular.

As próximas migrações podem reutilizar sessão, layout, acesso às APIs e padrões
de carregamento já implementados. Cada tela precisa manter sua autorização no
servidor e validar seus fluxos antes de substituir a entrada antiga.
