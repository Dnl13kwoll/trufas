ALTER TABLE produtos ADD COLUMN IF NOT EXISTS preco_promocional DECIMAL(10,2);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS qtd_min_promocional INTEGER DEFAULT 0;

-- Comentário: preco_promocional = preço por unidade quando qtd >= qtd_min_promocional
-- Exemplo: trufa a R$5,50 normal, R$5,00 a partir de 3 unidades
