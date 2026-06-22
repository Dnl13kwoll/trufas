ALTER TABLE despesas ADD COLUMN IF NOT EXISTS valor_unitario DECIMAL(10,4);

-- Preencher valor_unitario para registros existentes
UPDATE despesas SET valor_unitario = ROUND(valor_total / NULLIF(quantidade, 0), 4) WHERE valor_unitario IS NULL;
