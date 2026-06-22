-- ── Insumos (ingredientes e materiais) ───────────────────────────
CREATE TABLE IF NOT EXISTS insumos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  unidade     TEXT NOT NULL DEFAULT 'unidade', -- kg, g, L, mL, unidade, cx, etc.
  estoque_minimo DECIMAL(10,3) DEFAULT 0,
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Locais (onde o estoque fica) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS locais (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  descricao   TEXT,
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Despesas (compras de insumos) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS despesas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insumo_id   UUID REFERENCES insumos(id) ON DELETE SET NULL,
  quantidade  DECIMAL(10,3) NOT NULL,
  valor_total DECIMAL(10,2) NOT NULL,
  data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Produtos (sabores de trufas) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS produtos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  preco_venda DECIMAL(10,2) NOT NULL DEFAULT 0,
  descricao   TEXT,
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Estoque por local ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estoque_local (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produto_id  UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  local_id    UUID NOT NULL REFERENCES locais(id) ON DELETE CASCADE,
  quantidade  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(produto_id, local_id)
);

-- ── Produções (adiciona ao estoque) ───────────────────────────────
CREATE TABLE IF NOT EXISTS producoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produto_id      UUID REFERENCES produtos(id) ON DELETE SET NULL,
  local_id        UUID REFERENCES locais(id) ON DELETE SET NULL,
  quantidade      INTEGER NOT NULL,
  data_producao   DATE NOT NULL DEFAULT CURRENT_DATE,
  custo_estimado  DECIMAL(10,2),
  observacao      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Vendas ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produto_id  UUID REFERENCES produtos(id) ON DELETE SET NULL,
  local_id    UUID REFERENCES locais(id) ON DELETE SET NULL,
  quantidade  INTEGER NOT NULL,
  valor_total DECIMAL(10,2) NOT NULL,
  data_venda  DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Transferências de estoque ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS transferencias (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produto_id         UUID REFERENCES produtos(id) ON DELETE SET NULL,
  local_origem_id    UUID REFERENCES locais(id) ON DELETE SET NULL,
  local_destino_id   UUID REFERENCES locais(id) ON DELETE SET NULL,
  quantidade         INTEGER NOT NULL,
  data_transferencia DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao         TEXT,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE insumos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE locais        ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_local ENABLE ROW LEVEL SECURITY;
ALTER TABLE producoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias ENABLE ROW LEVEL SECURITY;

-- Políticas: cada usuário vê apenas seus próprios dados
DO $$ BEGIN
  CREATE POLICY "owner" ON insumos       USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "owner" ON locais        USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "owner" ON despesas      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "owner" ON produtos      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "owner" ON estoque_local USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "owner" ON producoes     USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "owner" ON vendas        USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "owner" ON transferencias USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
