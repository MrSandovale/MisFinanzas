-- ══════════════════════════════════════════════════════════════
-- MIS FINANZAS — Supabase PostgreSQL Schema
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. Configuración del usuario (meta de ahorro, etc.)
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  savings_goal NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Categorías de gasto (personalizables por usuario)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Fixed' CHECK (type IN ('Fixed', 'Variable')),
  essential BOOLEAN DEFAULT false,
  "group" TEXT NOT NULL DEFAULT 'Otro',
  budget NUMERIC(12,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Fuentes de ingreso presupuestado
CREATE TABLE budget_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL DEFAULT 'Salario',
  amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Presupuesto por categoría por mes (overrides)
CREATE TABLE budget_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL,          -- formato: "2026-04"
  category_name TEXT NOT NULL,
  amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month, category_name)
);

-- 5. Transacciones (gastos e ingresos reales)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL DEFAULT 'Expense' CHECK (type IN ('Expense', 'Income')),
  category TEXT NOT NULL,
  var_fixed TEXT DEFAULT 'Fixed',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- Row Level Security (RLS) — cada usuario ve solo su data
-- ══════════════════════════════════════════════════════════════

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policies: SELECT, INSERT, UPDATE, DELETE solo para el dueño
CREATE POLICY "Users see own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own categories" ON categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own budget_income" ON budget_income FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own budget_overrides" ON budget_overrides FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own transactions" ON transactions FOR ALL USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════
-- Índices para rendimiento
-- ══════════════════════════════════════════════════════════════

CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX idx_budget_overrides_user_month ON budget_overrides(user_id, month);
CREATE INDEX idx_budget_income_user ON budget_income(user_id);
