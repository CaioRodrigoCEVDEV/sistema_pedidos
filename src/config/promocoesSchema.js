const pool = require("./db");

// Estrutura das promoções por produto (promocoes).
//
// Mantida em um único lugar para ser reaproveitada pela migration automática de
// startup (src/config/atualizardb.js).
//
// Regras:
// - Cada produto tem no máximo uma promoção (UNIQUE procod); recriar a promoção
//   de um produto atualiza o registro existente.
// - `promocaotipo` define como o desconto é calculado sobre pro.provl:
//     'P' = percentual (promocaovalor representa % de 0 a 100)
//     'V' = valor fixo (promocaovalor é subtraído do preço)
// - A promoção vale enquanto `promocaoativo` for TRUE e a data atual estiver
//   dentro do período (datas nulas significam sem limite naquele lado).
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS public.promocoes (
    promocaocod      SERIAL PRIMARY KEY,
    procod           INT NOT NULL REFERENCES public.pro(procod) ON DELETE CASCADE,
    promocaotipo     VARCHAR(1) NOT NULL,
    promocaovalor    NUMERIC(14,4) NOT NULL,
    promocaoativo    BOOLEAN NOT NULL DEFAULT TRUE,
    promocaodtinicio DATE NULL,
    promocaodtfim    DATE NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT promocoes_procod_key UNIQUE (procod),
    CONSTRAINT promocoes_tipo_check CHECK (promocaotipo IN ('P', 'V')),
    CONSTRAINT promocoes_valor_check CHECK (promocaovalor > 0),
    CONSTRAINT promocoes_periodo_check CHECK (
      promocaodtfim IS NULL
      OR promocaodtinicio IS NULL
      OR promocaodtfim >= promocaodtinicio
    )
  );
`;

const CREATE_INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS idx_promocoes_ativas
    ON public.promocoes (procod)
    WHERE promocaoativo;
`;

async function ensurePromocoesSchema(db = pool) {
  await db.query(CREATE_TABLE_SQL);
  await db.query(CREATE_INDEXES_SQL);
}

module.exports = {
  ensurePromocoesSchema,
  CREATE_TABLE_SQL,
  CREATE_INDEXES_SQL,
};
