-- ============================================================================
-- Script: fix_part_group_audit_reference.sql
-- Objetivo: Atualizar registros históricos em part_group_audit para definir
--           reference_id com o código/sku da peça quando possível.
--
-- IMPORTANTE: Este script é IDEMPOTENTE - pode ser executado múltiplas vezes
--             sem efeitos colaterais.
--
-- PRÉ-REQUISITOS:
-- - Banco de dados PostgreSQL com tabelas part_group_audit e pro
-- - Permissões de UPDATE na tabela part_group_audit
--
-- INSTRUÇÕES:
-- 1. Execute primeiro em HOMOLOGAÇÃO para validar os resultados
-- 2. Revise os registros atualizados com a query de verificação abaixo
-- 3. Após validação, execute em PRODUÇÃO
--
-- COMO EXECUTAR:
--   psql -d nome_do_banco -f fix_part_group_audit_reference.sql
--
-- ============================================================================

-- Inicia uma transação para garantir atomicidade
BEGIN;

-- ============================================================================
-- PASSO 1: Contar registros que serão atualizados (apenas para log/verificação)
-- ============================================================================
DO $$
DECLARE
    total_registros INTEGER;
    registros_sem_reference INTEGER;
BEGIN
    -- Conta total de registros na tabela de auditoria
    SELECT COUNT(*) INTO total_registros FROM part_group_audit;
    
    -- Conta registros sem reference_id ou com reference_id vazio
    SELECT COUNT(*) INTO registros_sem_reference 
    FROM part_group_audit 
    WHERE reference_id IS NULL OR reference_id = '';
    
    RAISE NOTICE 'Total de registros em part_group_audit: %', total_registros;
    RAISE NOTICE 'Registros sem reference_id: %', registros_sem_reference;
END $$;

-- ============================================================================
-- PASSO 2: Atualizar registros históricos que têm reference_id numérico
--          para usar o código da peça (procod)
--
-- A lógica é:
-- - Se reference_id é um número que corresponde a um procod válido,
--   manter o valor (já está correto)
-- - Se reference_id está vazio ou nulo, tentar identificar a peça pelo grupo
--   e definir o procod como reference_id
--
-- COALESCE usa procod::text como padrão, pois essa é a coluna de código
-- principal na tabela pro deste sistema.
-- ============================================================================

-- Atualiza registros que têm reference_id como número válido de procod
-- para garantir que está no formato texto correto
UPDATE part_group_audit pga
SET reference_id = p.procod::text
FROM pro p
WHERE 
    -- Junta pelo reference_id existente (se for um procod válido)
    pga.reference_id IS NOT NULL 
    AND pga.reference_id != ''
    AND pga.reference_id ~ '^\d+$'  -- Apenas se for numérico
    AND p.procod::text = pga.reference_id
    AND p.part_group_id = pga.part_group_id;

-- ============================================================================
-- PASSO 3: Para registros sem reference_id, tentar inferir pelo grupo
--          (Opcional - apenas atualiza se houver UMA única peça no grupo)
-- ============================================================================

-- Primeiro, identificar grupos com apenas uma peça (casos simples)
-- Nestes casos, podemos inferir com segurança qual peça foi afetada
UPDATE part_group_audit pga
SET reference_id = (
    SELECT p.procod::text
    FROM pro p
    WHERE p.part_group_id = pga.part_group_id
    LIMIT 1
)
WHERE 
    (pga.reference_id IS NULL OR pga.reference_id = '')
    AND (
        SELECT COUNT(*) 
        FROM pro p 
        WHERE p.part_group_id = pga.part_group_id
    ) = 1;

-- ============================================================================
-- PASSO 4: Verificação final
-- ============================================================================
DO $$
DECLARE
    registros_atualizados INTEGER;
    registros_sem_reference INTEGER;
BEGIN
    -- Conta registros que ainda estão sem reference_id
    SELECT COUNT(*) INTO registros_sem_reference 
    FROM part_group_audit 
    WHERE reference_id IS NULL OR reference_id = '';
    
    RAISE NOTICE 'Registros ainda sem reference_id após atualização: %', registros_sem_reference;
    RAISE NOTICE 'Script executado com sucesso!';
END $$;

-- Confirma a transação
COMMIT;

-- ============================================================================
-- QUERIES DE VERIFICAÇÃO (executar manualmente após o script)
-- ============================================================================

-- Query 1: Ver últimos 50 registros de auditoria com nome da peça
/*
SELECT 
    a.id,
    a.part_group_id,
    pg.name as grupo_nome,
    a.change,
    a.reason,
    a.reference_id,
    p.prodes as peca_nome,
    a.created_at
FROM part_group_audit a
LEFT JOIN part_groups pg ON pg.id = a.part_group_id
LEFT JOIN pro p ON p.procod::text = a.reference_id
ORDER BY a.created_at DESC
LIMIT 50;
*/

-- Query 2: Contar registros sem reference_id por grupo
/*
SELECT 
    pg.id,
    pg.name,
    COUNT(*) as registros_sem_reference
FROM part_group_audit a
JOIN part_groups pg ON pg.id = a.part_group_id
WHERE a.reference_id IS NULL OR a.reference_id = ''
GROUP BY pg.id, pg.name
ORDER BY registros_sem_reference DESC;
*/

-- Query 3: Verificar integridade dos reference_ids
/*
SELECT 
    a.id,
    a.reference_id,
    CASE 
        WHEN p.procod IS NOT NULL THEN 'VÁLIDO'
        ELSE 'INVÁLIDO - peça não encontrada'
    END as status
FROM part_group_audit a
LEFT JOIN pro p ON p.procod::text = a.reference_id
WHERE a.reference_id IS NOT NULL AND a.reference_id != ''
LIMIT 100;
*/
