-- ── Perfis públicos (para lookup de user_id por email) ───────────
CREATE TABLE IF NOT EXISTS perfis (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email   TEXT NOT NULL UNIQUE,
  nome    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura_auth"  ON perfis FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "proprio_write" ON perfis FOR ALL    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Parcerias entre usuários ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS parceiros (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_a   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_b     TEXT NOT NULL,
  user_id_b   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pendente', -- pendente | ativo
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id_a, email_b)
);
ALTER TABLE parceiros ENABLE ROW LEVEL SECURITY;
-- Quem convidou ou foi convidado (por user_id) pode ver
CREATE POLICY "membros" ON parceiros FOR ALL USING (
  user_id_a = auth.uid() OR user_id_b = auth.uid()
) WITH CHECK (user_id_a = auth.uid());
-- Convidado pendente pode ver pelo email (antes de ter user_id_b)
CREATE POLICY "pendente_email" ON parceiros FOR SELECT USING (
  email_b = (SELECT email FROM perfis WHERE user_id = auth.uid())
);

-- ── Helper: retorna todos os user_ids parceiros do usuário atual ──
CREATE OR REPLACE FUNCTION parceiros_ids()
RETURNS SETOF UUID LANGUAGE sql SECURITY DEFINER AS $$
  SELECT user_id_a FROM parceiros WHERE user_id_b = auth.uid() AND status = 'ativo'
  UNION
  SELECT user_id_b FROM parceiros WHERE user_id_a = auth.uid() AND status = 'ativo' AND user_id_b IS NOT NULL
$$;

-- ── Atualizar RLS de todas as tabelas para incluir parceiros ──────
-- Remover políticas antigas
DROP POLICY IF EXISTS "owner" ON insumos;
DROP POLICY IF EXISTS "owner" ON locais;
DROP POLICY IF EXISTS "owner" ON despesas;
DROP POLICY IF EXISTS "owner" ON produtos;
DROP POLICY IF EXISTS "owner" ON estoque_local;
DROP POLICY IF EXISTS "owner" ON producoes;
DROP POLICY IF EXISTS "owner" ON vendas;
DROP POLICY IF EXISTS "owner" ON transferencias;

-- Novas políticas: dono OU parceiro ativo pode ver/editar
CREATE POLICY "owner_or_parceiro" ON insumos
  USING (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner_or_parceiro" ON locais
  USING (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner_or_parceiro" ON despesas
  USING (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner_or_parceiro" ON produtos
  USING (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner_or_parceiro" ON estoque_local
  USING (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner_or_parceiro" ON producoes
  USING (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner_or_parceiro" ON vendas
  USING (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner_or_parceiro" ON transferencias
  USING (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid());
