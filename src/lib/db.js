import { supabase } from './supabase';

// ── USER SETTINGS ──
export async function loadSettings(userId) {
  const { data } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

export async function upsertSettings(userId, savingsGoal) {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, savings_goal: savingsGoal, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single();
  return { data, error };
}

// ── CATEGORIES ──
export async function loadCategories(userId) {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order');
  return data || [];
}

export async function saveCategories(userId, categories) {
  // Delete existing and re-insert (simplest approach for full array sync)
  await supabase.from('categories').delete().eq('user_id', userId);
  if (categories.length === 0) return;
  const rows = categories.map((c, i) => ({
    user_id: userId,
    name: c.name,
    type: c.type,
    essential: c.essential,
    group: c.group,
    budget: c.budget || 0,
    sort_order: i,
  }));
  await supabase.from('categories').insert(rows);
}

// ── BUDGET INCOME ──
export async function loadBudgetIncome(userId) {
  const { data } = await supabase
    .from('budget_income')
    .select('*')
    .eq('user_id', userId);
  return (data || []).map(r => ({ category: r.category, amount: Number(r.amount) }));
}

export async function saveBudgetIncome(userId, incomes) {
  await supabase.from('budget_income').delete().eq('user_id', userId);
  if (incomes.length === 0) return;
  const rows = incomes.map(i => ({
    user_id: userId,
    category: i.category,
    amount: i.amount || 0,
  }));
  await supabase.from('budget_income').insert(rows);
}

// ── BUDGET OVERRIDES ──
export async function loadBudgetOverrides(userId) {
  const { data } = await supabase
    .from('budget_overrides')
    .select('*')
    .eq('user_id', userId);
  const map = {};
  (data || []).forEach(r => {
    map[`${r.month}:${r.category_name}`] = Number(r.amount);
  });
  return map;
}

export async function upsertBudgetOverride(userId, month, categoryName, amount) {
  await supabase
    .from('budget_overrides')
    .upsert({
      user_id: userId,
      month,
      category_name: categoryName,
      amount,
    }, { onConflict: 'user_id,month,category_name' });
}

// ── TRANSACTIONS ──
export async function loadTransactions(userId) {
  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  return (data || []).map(r => ({
    id: r.id,
    date: r.date,
    type: r.type,
    category: r.category,
    varFixed: r.var_fixed,
    amount: Number(r.amount),
    note: r.note || '',
  }));
}

export async function addTransaction(userId, txn) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      date: txn.date,
      type: txn.type,
      category: txn.category,
      var_fixed: txn.varFixed,
      amount: txn.amount,
      note: txn.note || '',
    })
    .select()
    .single();
  return { data: data ? { ...txn, id: data.id } : null, error };
}

export async function updateTransaction(userId, txn) {
  await supabase
    .from('transactions')
    .update({
      date: txn.date,
      type: txn.type,
      category: txn.category,
      var_fixed: txn.varFixed,
      amount: txn.amount,
      note: txn.note || '',
    })
    .eq('id', txn.id)
    .eq('user_id', userId);
}

export async function deleteTransaction(userId, txnId) {
  await supabase
    .from('transactions')
    .delete()
    .eq('id', txnId)
    .eq('user_id', userId);
}

// ── LOAD ALL DATA ──
export async function loadAllData(userId) {
  const [settings, categories, budgetIncome, budgetOverrides, transactions] = await Promise.all([
    loadSettings(userId),
    loadCategories(userId),
    loadBudgetIncome(userId),
    loadBudgetOverrides(userId),
    loadTransactions(userId),
  ]);
  return {
    savingsGoal: Number(settings?.savings_goal || 0),
    categories: categories.map(c => ({
      name: c.name,
      type: c.type,
      essential: c.essential,
      group: c.group,
      budget: Number(c.budget || 0),
    })),
    budgetIncome: budgetIncome.length > 0 ? budgetIncome : [{ category: 'Salario', amount: 0 }],
    budgetOverrides,
    transactions,
  };
}

// ── SEED DEFAULT CATEGORIES ──
export async function seedDefaults(userId, defaultCategories) {
  const existing = await loadCategories(userId);
  if (existing.length === 0) {
    await saveCategories(userId, defaultCategories);
    await saveBudgetIncome(userId, [{ category: 'Salario', amount: 0 }]);
    await upsertSettings(userId, 0);
  }
}
