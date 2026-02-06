-- =====================================================
-- SCHÉMA SUPABASE POUR ELECTION PRINT SHOP
-- =====================================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: products
-- Les 3 types de produits disponibles
-- =====================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) UNIQUE NOT NULL, -- 'affiches', 'bulletins', 'professions_foi'
  name VARCHAR(200) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE: product_options
-- Options disponibles pour chaque produit
-- =====================================================
CREATE TABLE product_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  option_key VARCHAR(50) NOT NULL, -- 'format', 'couleur', 'papier', 'finition', 'pliage'
  option_value VARCHAR(100) NOT NULL, -- 'A3', 'A2', 'Couleur', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, option_key, option_value)
);

-- =====================================================
-- TABLE: pricing_rules
-- Grille de prix en centimes d'euros
-- =====================================================
CREATE TABLE pricing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  format VARCHAR(20), -- 'A3', 'A2', 'A1', 'A6', 'A5', 'A4'
  color VARCHAR(20), -- 'nb', 'couleur'
  paper VARCHAR(50), -- 'standard', 'premium', 'epais'
  finish_or_fold VARCHAR(50), -- 'aucune', 'pelliculage', 'oui', 'non'
  unit_price_cents INTEGER NOT NULL, -- Prix unitaire en centimes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour accélérer les recherches de prix
CREATE INDEX idx_pricing_rules_lookup 
ON pricing_rules(product_id, format, color, paper, finish_or_fold);

-- =====================================================
-- TABLE: orders
-- Commandes passées
-- =====================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'processing', 'shipped', 'cancelled'
  
  -- Montants en centimes
  total_ht_cents INTEGER NOT NULL,
  tva_rate DECIMAL(5,2) DEFAULT 20.00, -- TVA en %
  total_ttc_cents INTEGER NOT NULL,
  shipping_cents INTEGER DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',
  
  -- Informations client
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  mairie_name VARCHAR(255) NOT NULL,
  commune VARCHAR(255) NOT NULL,
  
  -- Adresses en JSONB
  billing_address JSONB,
  shipping_address JSONB,
  
  -- Stripe
  stripe_session_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherches fréquentes
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_email ON orders(customer_email);
CREATE INDEX idx_orders_stripe_session ON orders(stripe_session_id);

-- =====================================================
-- TABLE: order_items
-- Lignes de commande (produits + options)
-- =====================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_type VARCHAR(50) NOT NULL, -- 'affiches', 'bulletins', 'professions_foi'
  product_name VARCHAR(200),
  
  -- Options sélectionnées stockées en JSONB
  options JSONB NOT NULL, -- { "format": "A3", "couleur": "Couleur", ... }
  
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL,
  line_total_cents INTEGER NOT NULL, -- quantity * unit_price_cents
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- =====================================================
-- TABLE: stripe_events
-- Pour l'idempotence des webhooks Stripe
-- =====================================================
CREATE TABLE stripe_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id VARCHAR(255) UNIQUE NOT NULL, -- ID de l'événement Stripe
  type VARCHAR(100) NOT NULL, -- 'checkout.session.completed', etc.
  processed BOOLEAN DEFAULT false,
  data JSONB, -- Données complètes de l'événement
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_stripe_events_event_id ON stripe_events(event_id);
CREATE INDEX idx_stripe_events_type ON stripe_events(type);

-- =====================================================
-- TRIGGER: Mise à jour automatique de updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED: Produits de base
-- =====================================================
INSERT INTO products (type, name, is_active) VALUES
  ('affiches', 'Affiches électorales', true),
  ('bulletins', 'Bulletins de vote', true),
  ('professions_foi', 'Professions de foi', true);

-- =====================================================
-- SEED: Options produits
-- =====================================================

-- Options pour Affiches
INSERT INTO product_options (product_id, option_key, option_value)
SELECT id, 'format', option_value
FROM products, (VALUES ('A3'), ('A2'), ('A1')) AS options(option_value)
WHERE type = 'affiches';

INSERT INTO product_options (product_id, option_key, option_value)
SELECT id, 'couleur', option_value
FROM products, (VALUES ('N&B'), ('Couleur')) AS options(option_value)
WHERE type = 'affiches';

INSERT INTO product_options (product_id, option_key, option_value)
SELECT id, 'papier', option_value
FROM products, (VALUES ('Standard'), ('Premium')) AS options(option_value)
WHERE type = 'affiches';

INSERT INTO product_options (product_id, option_key, option_value)
SELECT id, 'finition', option_value
FROM products, (VALUES ('Aucune'), ('Pelliculage')) AS options(option_value)
WHERE type = 'affiches';

-- Options pour Bulletins
INSERT INTO product_options (product_id, option_key, option_value)
SELECT id, 'format', option_value
FROM products, (VALUES ('A6'), ('A5')) AS options(option_value)
WHERE type = 'bulletins';

INSERT INTO product_options (product_id, option_key, option_value)
SELECT id, 'couleur', option_value
FROM products, (VALUES ('N&B'), ('Couleur')) AS options(option_value)
WHERE type = 'bulletins';

INSERT INTO product_options (product_id, option_key, option_value)
SELECT id, 'papier', option_value
FROM products, (VALUES ('Standard'), ('Épais')) AS options(option_value)
WHERE type = 'bulletins';

-- Options pour Professions de foi
INSERT INTO product_options (product_id, option_key, option_value)
SELECT id, 'format', option_value
FROM products, (VALUES ('A4'), ('A5')) AS options(option_value)
WHERE type = 'professions_foi';

INSERT INTO product_options (product_id, option_key, option_value)
SELECT id, 'couleur', option_value
FROM products, (VALUES ('N&B'), ('Couleur')) AS options(option_value)
WHERE type = 'professions_foi';

INSERT INTO product_options (product_id, option_key, option_value)
SELECT id, 'papier', option_value
FROM products, (VALUES ('Standard'), ('Premium')) AS options(option_value)
WHERE type = 'professions_foi';

INSERT INTO product_options (product_id, option_key, option_value)
SELECT id, 'pliage', option_value
FROM products, (VALUES ('Oui'), ('Non')) AS options(option_value)
WHERE type = 'professions_foi';

-- =====================================================
-- SEED: Exemples de prix (en centimes)
-- Prix indicatifs - À ajuster selon vos besoins
-- =====================================================

-- Prix pour Affiches (exemples)
INSERT INTO pricing_rules (product_id, format, color, paper, finish_or_fold, unit_price_cents)
SELECT 
  id,
  f.format,
  c.color,
  p.paper,
  fi.finish,
  -- Formule de calcul du prix (exemple simplifié)
  CASE 
    WHEN f.format = 'A3' THEN 50
    WHEN f.format = 'A2' THEN 80
    WHEN f.format = 'A1' THEN 120
  END +
  CASE WHEN c.color = 'Couleur' THEN 30 ELSE 0 END +
  CASE WHEN p.paper = 'Premium' THEN 20 ELSE 0 END +
  CASE WHEN fi.finish = 'Pelliculage' THEN 40 ELSE 0 END
FROM products,
  (VALUES ('A3'), ('A2'), ('A1')) AS f(format),
  (VALUES ('N&B'), ('Couleur')) AS c(color),
  (VALUES ('Standard'), ('Premium')) AS p(paper),
  (VALUES ('Aucune'), ('Pelliculage')) AS fi(finish)
WHERE type = 'affiches';

-- Prix pour Bulletins (exemples)
INSERT INTO pricing_rules (product_id, format, color, paper, finish_or_fold, unit_price_cents)
SELECT 
  id,
  f.format,
  c.color,
  p.paper,
  NULL, -- pas de finition/pliage pour bulletins
  CASE 
    WHEN f.format = 'A6' THEN 10
    WHEN f.format = 'A5' THEN 15
  END +
  CASE WHEN c.color = 'Couleur' THEN 5 ELSE 0 END +
  CASE WHEN p.paper = 'Épais' THEN 5 ELSE 0 END
FROM products,
  (VALUES ('A6'), ('A5')) AS f(format),
  (VALUES ('N&B'), ('Couleur')) AS c(color),
  (VALUES ('Standard'), ('Épais')) AS p(paper)
WHERE type = 'bulletins';

-- Prix pour Professions de foi (exemples)
INSERT INTO pricing_rules (product_id, format, color, paper, finish_or_fold, unit_price_cents)
SELECT 
  id,
  f.format,
  c.color,
  p.paper,
  pl.pliage,
  CASE 
    WHEN f.format = 'A4' THEN 25
    WHEN f.format = 'A5' THEN 20
  END +
  CASE WHEN c.color = 'Couleur' THEN 15 ELSE 0 END +
  CASE WHEN p.paper = 'Premium' THEN 10 ELSE 0 END +
  CASE WHEN pl.pliage = 'Oui' THEN 8 ELSE 0 END
FROM products,
  (VALUES ('A4'), ('A5')) AS f(format),
  (VALUES ('N&B'), ('Couleur')) AS c(color),
  (VALUES ('Standard'), ('Premium')) AS p(paper),
  (VALUES ('Oui'), ('Non')) AS pl(pliage)
WHERE type = 'professions_foi';

-- =====================================================
-- PERMISSIONS RLS (Row Level Security) - Optionnel
-- Si vous voulez sécuriser davantage
-- =====================================================

-- Activer RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Politique de lecture publique pour les produits et prix
CREATE POLICY "Products are viewable by everyone"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Product options are viewable by everyone"
  ON product_options FOR SELECT
  USING (true);

CREATE POLICY "Pricing rules are viewable by everyone"
  ON pricing_rules FOR SELECT
  USING (true);

-- Les commandes ne sont accessibles que via le service role
CREATE POLICY "Orders are only accessible via service role"
  ON orders FOR ALL
  USING (false);

CREATE POLICY "Order items are only accessible via service role"
  ON order_items FOR ALL
  USING (false);

-- =====================================================
-- FIN DU SCHÉMA
-- =====================================================

-- Pour vérifier que tout fonctionne:
-- SELECT * FROM products;
-- SELECT * FROM product_options;
-- SELECT * FROM pricing_rules LIMIT 10;
