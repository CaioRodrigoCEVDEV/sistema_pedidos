const pool = require("./db");

// Estrutura das vitrines da página inicial (home_showcases).
//
// Mantida em um único lugar para ser reaproveitada:
// - pela migration automática de startup (src/config/atualizardb.js);
//
// Regras:
// - `type` identifica a vitrine e é único: featured (manual), best_sellers e
//   new_arrivals (automáticas).
// - `position` define a ordem de exibição na página pública (nunca no front).
// - `max_items` limita quantos produtos as vitrines automáticas exibem.
// - Os itens manuais ficam em home_showcase_items, com position própria.
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS public.home_showcases (
    id SERIAL PRIMARY KEY,
    type VARCHAR(30) NOT NULL,
    title VARCHAR(100) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    position INT NOT NULL DEFAULT 0,
    max_items INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT home_showcases_type_key UNIQUE (type),
    CONSTRAINT home_showcases_type_check CHECK (
      type IN ('featured', 'best_sellers', 'new_arrivals')
    ),
    CONSTRAINT home_showcases_max_items_check CHECK (max_items > 0)
  );

  CREATE TABLE IF NOT EXISTS public.home_showcase_items (
    id SERIAL PRIMARY KEY,
    showcase_id INT NOT NULL REFERENCES public.home_showcases(id) ON DELETE CASCADE,
    procod INT NOT NULL REFERENCES public.pro(procod) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT home_showcase_items_key UNIQUE (showcase_id, procod)
  );
`;

const CREATE_INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS idx_home_showcases_active_position
    ON public.home_showcases (active, position);

  CREATE INDEX IF NOT EXISTS idx_home_showcase_items_showcase
    ON public.home_showcase_items (showcase_id, position);

  CREATE INDEX IF NOT EXISTS idx_home_showcase_items_procod
    ON public.home_showcase_items (procod);
`;

// Vitrines iniciais na ordem Destaques > Mais vendidos > Novidades.
// Apenas Novidades começa ativa; Destaques (sem itens) e Mais vendidos
// ficam desativadas até o administrador habilitar no painel.
const SEED_SQL = `
  INSERT INTO public.home_showcases (type, title, active, position, max_items)
  VALUES
    ('featured', 'Destaques', FALSE, 1, 10),
    ('best_sellers', 'Mais vendidos', FALSE, 2, 10),
    ('new_arrivals', 'Novidades', TRUE, 3, 10)
  ON CONFLICT (type) DO NOTHING;
`;

async function ensureShowcasesSchema(db = pool) {
  await db.query(CREATE_TABLE_SQL);
  await db.query(CREATE_INDEXES_SQL);
  await db.query(SEED_SQL);
}

module.exports = {
  ensureShowcasesSchema,
  CREATE_TABLE_SQL,
  CREATE_INDEXES_SQL,
  SEED_SQL,
};
