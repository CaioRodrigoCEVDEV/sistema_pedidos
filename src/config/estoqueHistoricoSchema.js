// Ledger independente: preserva nomes e vinculos da data do movimento,
// inclusive quando uma peca/grupo for removido posteriormente.
const ESTOQUE_HISTORICO_SQL = `
CREATE TABLE IF NOT EXISTS public.estoque_historico (
  id BIGSERIAL PRIMARY KEY,
  ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  origem TEXT NOT NULL,
  origem_id INTEGER NOT NULL,
  descricao TEXT NOT NULL,
  variacao NUMERIC NOT NULL CHECK (variacao <> 0),
  saldo_anterior NUMERIC,
  saldo_atual NUMERIC,
  motivo TEXT,
  itens JSONB NOT NULL DEFAULT '[]',
  legado_id INTEGER UNIQUE
);
CREATE INDEX IF NOT EXISTS estoque_historico_data ON public.estoque_historico(ocorrido_em DESC, id DESC);
CREATE TABLE IF NOT EXISTS public.estoque_historico_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1), iniciado_em TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION public.estoque_historico_itens(produto INTEGER, grupo INTEGER, cor INTEGER DEFAULT NULL)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb) FROM (
    SELECT DISTINCT jsonb_build_object(
      'procod', p.procod, 'peca', p.prodes,
      'marca_id', p.promarcascod, 'marca', b.marcasdes,
      'tipo_id', p.protipocod, 'tipo', t.tipodes,
      'modelos', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.modcod, 'nome', m.moddes) ORDER BY m.moddes)
        FROM (
          SELECT m2.modcod, m2.moddes FROM public.modelo m2 WHERE m2.modcod = p.promodcod
          UNION
          SELECT m3.modcod, m3.moddes FROM public.promod pm
          JOIN public.modelo m3 ON m3.modcod = pm.promodmodcod
          WHERE pm.promodprocod = p.procod
        ) m), '[]'::jsonb),
      'cor', c.cornome
    ) AS item
    FROM public.pro p
    LEFT JOIN public.marcas b ON b.marcascod = p.promarcascod
    LEFT JOIN public.tipo t ON t.tipocod = p.protipocod
    LEFT JOIN public.procor pc ON pc.procorprocod = p.procod
    LEFT JOIN public.cores c ON c.corcod = pc.procorcorescod
    WHERE (produto IS NOT NULL AND p.procod = produto AND (cor IS NULL OR pc.procorid = cor))
       OR (grupo IS NOT NULL AND EXISTS (SELECT 1 FROM public.part_group_items gi
           WHERE gi.group_id = grupo AND gi.procorid = pc.procorid))
  ) dados;
$$;

-- Importa somente a auditoria que existia na primeira instalacao. As proximas
-- baixas sao capturadas pelo saldo, nao pelo audit, evitando duplicidade.
DO $$
DECLARE timeout_anterior TEXT := current_setting('statement_timeout');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.estoque_historico_meta WHERE id = 1) THEN
    -- Import unico e pesado: calcula os itens uma vez por grupo e desliga
    -- temporariamente o statement_timeout para nao abortar em bases grandes,
    -- restaurando em seguida.
    PERFORM set_config('statement_timeout', '0', true);
    -- Tabela temporaria garante avaliacao unica da funcao por grupo em qualquer
    -- versao (a CTE seria inlined no PG12+ e voltaria a rodar por linha).
    CREATE TEMP TABLE itens_grupo_import ON COMMIT DROP AS
      SELECT g.group_id, public.estoque_historico_itens(NULL, g.group_id) AS itens
      FROM (
        SELECT DISTINCT a.part_group_id AS group_id
        FROM public.part_group_audit a
        WHERE a.change <> 0
      ) g;
    INSERT INTO public.estoque_historico(ocorrido_em, origem, origem_id, descricao, variacao, motivo, itens, legado_id)
    SELECT a.created_at, 'grupo', a.part_group_id, pg.name, a.change, a.reason,
      ig.itens, a.id
    FROM public.part_group_audit a
    JOIN public.part_groups pg ON pg.id = a.part_group_id
    JOIN itens_grupo_import ig ON ig.group_id = a.part_group_id
    WHERE a.change <> 0
    ON CONFLICT (legado_id) DO NOTHING;
    PERFORM set_config('statement_timeout', timeout_anterior, true);
    INSERT INTO public.estoque_historico_meta(id) VALUES (1);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.registrar_movimento_estoque()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE anterior NUMERIC := 0; atual NUMERIC; codigo INTEGER; nome TEXT; dados JSONB; fonte TEXT;
BEGIN
  IF TG_TABLE_NAME = 'part_groups' THEN
    fonte := 'grupo'; codigo := NEW.id; nome := NEW.name; atual := COALESCE(NEW.stock_quantity, 0);
    IF TG_OP = 'UPDATE' THEN anterior := COALESCE(OLD.stock_quantity, 0); END IF;
    IF atual = anterior THEN RETURN NEW; END IF;
    dados := public.estoque_historico_itens(NULL, codigo);
  ELSIF TG_TABLE_NAME = 'procor' THEN
    -- O grupo registra a variacao real; a copia do saldo nos membros nao e outra entrada/saida.
    IF COALESCE(NEW.procorcorescod, 0) = 0 OR EXISTS (SELECT 1 FROM public.part_group_items WHERE procorid = NEW.procorid) THEN RETURN NEW; END IF;
    fonte := 'cor'; codigo := NEW.procorid; atual := COALESCE(NEW.procorqtde, 0);
    IF TG_OP = 'UPDATE' THEN anterior := COALESCE(OLD.procorqtde, 0); END IF;
    IF atual = anterior THEN RETURN NEW; END IF;
    SELECT prodes INTO nome FROM public.pro WHERE procod = NEW.procorprocod;
    dados := public.estoque_historico_itens(NEW.procorprocod, NULL, codigo);
  ELSE
    IF EXISTS (SELECT 1 FROM public.procor pc WHERE pc.procorprocod = NEW.procod
      AND (COALESCE(pc.procorcorescod, 0) <> 0 OR EXISTS (
        SELECT 1 FROM public.part_group_items gi WHERE gi.procorid = pc.procorid))) THEN RETURN NEW; END IF;
    fonte := 'produto'; codigo := NEW.procod; nome := NEW.prodes; atual := COALESCE(NEW.proqtde, 0);
    IF TG_OP = 'UPDATE' THEN anterior := COALESCE(OLD.proqtde, 0); END IF;
    IF atual = anterior THEN RETURN NEW; END IF;
    dados := public.estoque_historico_itens(codigo, NULL);
  END IF;
  INSERT INTO public.estoque_historico(origem, origem_id, descricao, variacao, saldo_anterior, saldo_atual, motivo, itens)
  VALUES (fonte, codigo, COALESCE(nome, 'Estoque'), atual - anterior, anterior, atual,
    CASE WHEN TG_OP = 'INSERT' THEN 'Saldo inicial' ELSE 'Alteração de saldo' END, dados);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS registrar_historico_grupo ON public.part_groups;
CREATE TRIGGER registrar_historico_grupo AFTER INSERT OR UPDATE OF stock_quantity ON public.part_groups
  FOR EACH ROW EXECUTE PROCEDURE public.registrar_movimento_estoque();
DROP TRIGGER IF EXISTS registrar_historico_produto ON public.pro;
CREATE TRIGGER registrar_historico_produto AFTER INSERT OR UPDATE OF proqtde ON public.pro
  FOR EACH ROW EXECUTE PROCEDURE public.registrar_movimento_estoque();
DROP TRIGGER IF EXISTS registrar_historico_cor ON public.procor;
CREATE TRIGGER registrar_historico_cor AFTER INSERT OR UPDATE OF procorqtde ON public.procor
  FOR EACH ROW EXECUTE PROCEDURE public.registrar_movimento_estoque();
`;

module.exports = { ESTOQUE_HISTORICO_SQL };
