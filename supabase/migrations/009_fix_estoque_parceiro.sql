-- Migration 007 corrigiu insumos/locais/produtos mas esqueceu estoque_local,
-- producoes, vendas, transferencias e despesas. Parceiros falhavam ao tentar
-- UPDATE no estoque porque WITH CHECK so permitia user_id = auth.uid() (dono).

DROP POLICY IF EXISTS "owner_or_parceiro" ON estoque_local;
CREATE POLICY "owner_or_parceiro" ON estoque_local
  USING  (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()));

DROP POLICY IF EXISTS "owner_or_parceiro" ON producoes;
CREATE POLICY "owner_or_parceiro" ON producoes
  USING  (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()));

DROP POLICY IF EXISTS "owner_or_parceiro" ON vendas;
CREATE POLICY "owner_or_parceiro" ON vendas
  USING  (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()));

DROP POLICY IF EXISTS "owner_or_parceiro" ON transferencias;
CREATE POLICY "owner_or_parceiro" ON transferencias
  USING  (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()));

DROP POLICY IF EXISTS "owner_or_parceiro" ON despesas;
CREATE POLICY "owner_or_parceiro" ON despesas
  USING  (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()));
