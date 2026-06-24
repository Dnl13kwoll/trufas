-- Recria as políticas de insumos, locais e produtos para que parceiros
-- ativos também consigam fazer soft-delete (UPDATE ativo=false).
-- ALTER POLICY não suporta mudar USING/WITH CHECK — precisa DROP + CREATE.

DROP POLICY IF EXISTS "owner_or_parceiro" ON public.insumos;
CREATE POLICY "owner_or_parceiro" ON public.insumos
  USING  (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()));

DROP POLICY IF EXISTS "owner_or_parceiro" ON public.locais;
CREATE POLICY "owner_or_parceiro" ON public.locais
  USING  (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()));

DROP POLICY IF EXISTS "owner_or_parceiro" ON public.produtos;
CREATE POLICY "owner_or_parceiro" ON public.produtos
  USING  (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()))
  WITH CHECK (user_id = auth.uid() OR user_id IN (SELECT parceiros_ids()));
