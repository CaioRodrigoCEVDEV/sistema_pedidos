# Envio de pedidos aprovados ao CRM

Cada instalação da loja usa seu próprio banco e suas próprias variáveis de ambiente.
Cadastre a loja no CRM com `POST /api/store-orders/stores` e guarde o `id` e o `secret`
devolvidos. Configure na instalação correspondente:

```env
CRM_API_BASE_URL=https://crm.exemplo.com
CRM_STORE_ID=id-da-loja-no-crm
CRM_STORE_SECRET=credencial-exibida-no-cadastro
```

O endpoint do CRM exige HTTPS fora de `localhost`/`127.0.0.1`. Não copie a credencial
de uma loja para outra e não registre essas variáveis no Git.

Ao confirmar um pedido pela rota `PUT /pedidos/confirmar/:pvcod`, a loja grava uma
saída pendente em `crm_order_approval_outbox` na mesma transação da aprovação e da
movimentação de estoque. A comunicação com o CRM ocorre em segundo plano a cada
15 segundos. Se o CRM estiver indisponível, a aprovação local permanece válida e o
envio é repetido com intervalo crescente, limitado a uma hora. Reenvios usam o mesmo
`pvcod`; o CRM os reconhece como o mesmo pedido.

Antes de cada envio, a loja lê os itens aprovados (`pvi`) e o total (`pvvl`) do próprio
banco e inclui código, descrição, cor, quantidade, preço unitário e total por item.
O CRM guarda esses dados para exibir no detalhe de Entregas. Valores são enviados como
texto decimal para preservar os quatro dígitos decimais do banco. Se a saída já tiver
sido entregue antes desta atualização, ela não é reenviada automaticamente.
Atualize primeiro o banco e a API do CRM; a versão anterior rejeita os campos novos
e a loja precisará repetir o envio pela fila.

Sem as três variáveis, a fila permanece no banco e não tenta enviar. Ao configurá-las
e reiniciar a aplicação, as saídas pendentes voltam a ser processadas. Para conferir
o estado da integração nesta instalação:

```sql
SELECT pvcod, approved_at, delivered_at, attempts, next_attempt_at, last_error
FROM crm_order_approval_outbox
ORDER BY approved_at DESC;
```

Somente novas confirmações feitas pela rota acima entram na fila. Pedidos aprovados
antes da implantação precisam de uma decisão de importação separada; esta mudança
não os reenvia automaticamente.
