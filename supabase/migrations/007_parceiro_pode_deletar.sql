-- Permite que parceiros ativos também façam soft-delete (UPDATE ativo=false)
-- em insumos, locais e produtos.
-- Para hard-delete (despesas, producoes, vendas, transferencias) o RLS USING
-- já permite parceiros; apenas o WITH CHECK bloqueava UPDATEs.

ALTER POLICY "owner_or_parceiro" ON insumos
  USING  (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()));

ALTER POLICY "owner_or_parceiro" ON locais
  USING  (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()));

ALTER POLICY "owner_or_parceiro" ON produtos
  USING  (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()));
