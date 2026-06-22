-- Corrige bug: a política de UPDATE em parceiros exigia user_id_a = auth.uid(),
-- impedindo que o convidado ativasse o próprio convite ao fazer login.

CREATE POLICY "aceitar_convite" ON parceiros
  FOR UPDATE
  USING (
    email_b = (SELECT email FROM perfis WHERE user_id = auth.uid())
    AND status = 'pendente'
  )
  WITH CHECK (
    user_id_b = auth.uid()
    AND status = 'ativo'
  );
