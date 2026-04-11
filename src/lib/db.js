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
    .upsert(
      { user_id: userId, savings_goal: savingsGoal, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select()
    .single();
  if (error) console.error('Error saving settings:', error);
  return { data, error };
}

// ── CATEGORIES ──
export async function loadCategories(userId) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order');
  if (error) console.error('Error loading categories:', error);
  return data || [];
}

export async function saveCategories(userId, categories) {
  if (!categories || categories.length === 0) return;

  // Get existing categories
  const { data: existing } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', userId);

  const existingMap = {};
  (existing || []).forEach(e => { existingMap[e.name] = e.id; });

  // Upsert each category (update if exists, insert if new)
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    if (existingMap[c.name]) {
      await supabase
        .from('categories')
        .update({
          type: c.type,
          essential: c.essential,
          group: c.group,
          budget: c.budget || 0,
          sort_order: i,
        })
        .eq('id', existingMap[c.name])
        .eq('user_id', userId);
      delete existingMap[c.name];
    } else {
      await supabase.from('categories').insert({
        user_id: userId,
        name: c.name,
        type: c.type,
        essential: c.essential,
        group: c.group,
        budget: c.budget || 0,
        sort_order: i,
      });
    }
  }

  // Delete categories that were removed by the user
  const orphanIds = Object.values(existingMap);
  if (orphanIds.length > 0) {
    await supabase
      .from('categories')
      .delete()
      .in('id', orphanIds)
      .eq('user_id', userId);
  }
}

// ── BUDGET INCOME ──
export async function loadBudgetIncome(userId) {
  const { data, error } = await supabase
    .from('budget_income')
    .select('*')
    .eq('user_id', userId);
  if (error) console.error('Error loading budget income:', error);
  return (data || []).map(r => ({ category: r.category, amount: Number(r.amount) }));
}

export async function saveBudgetIncome(userId, incomes) {
  if (!incomes || incomes.length === 0) return;

  const { data: existing } = await supabase
    .from('budget_income')
    .select('id, category')
    .eq('user_id', userId);

  const existingMap = {};
  (existing || []).forEach(e => { existingMap[e.category] = e.id; });

  for (const inc of incomes) {
    if (existingMap[inc.category]) {
      await supabase
        .from('budget_income')
        .update({ amount: inc.amount || 0 })
        .eq('id', existingMap[inc.category])
        .eq('user_id', userId);
      delete existingMap[inc.category];
    } else {
      await supabase.from('budget_income').insert({
        user_id: userId,
        category: inc.category,
        amount: inc.amount || 0,
      });
    }
  }

  const orphanIds = Object.values(existingMap);
  if (orphanIds.length > 0) {
    await supabase
      .from('budget_income')
      .delete()
      .in('id', orphanIds)
      .eq('user_id', userId);
  }
}

// ── BUDGET OVERRIDES ──
export async function loadBudgetOverrides(userId) {
  const { data, error } = await supabase
    .from('budget_overrides')
    .select('*')
    .eq('user_id', userId);
  if (error) console.error('Error loading budget overrides:', error);
  const map = {};
  (data || []).forEach(r => {
    map[`${r.month}:${r.category_name}`] = Number(r.amount);
  });
  return map;
}

export async function upsertBudgetOverride(userId, month, categoryName, amount) {
  const { error } = await supabase
    .from('budget_overrides')
    .upsert({
      user_id: userId,
      month,
      category_name: categoryName,
      amount,
    }, { onConflict: 'user_id,month,category_name' });
  if (error) console.error('Error saving budget override:', error);
}

// ── TRANSACTIONS ──
export async function loadTransactions(userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) console.error('Error loading transactions:', error);
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
  if (error) console.error('Error adding transaction:', error);
  return { data: data ? { ...txn, id: data.id } : null, error };
}

export async function updateTransaction(userId, txn) {
  const { error } = await supabase
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
  if (error) console.error('Error updating transaction:', error);
}

export async function deleteTransaction(userId, txnId) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', txnId)
    .eq('user_id', userId);
  if (error) console.error('Error deleting transaction:', error);
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

// ── SEED DEFAULT CATEGORIES (only if truly empty) ──
export async function seedDefaults(userId, defaultCategories) {
  const { count } = await supabase
    .from('categories')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (count === 0) {
    for (let i = 0; i < defaultCategories.length; i++) {
      await supabase.from('categories').insert({
        user_id: userId,
        name: defaultCategories[i].name,
        type: defaultCategories[i].type,
        essential: defaultCategories[i].essential,
        group: defaultCategories[i].group,
        budget: defaultCategories[i].budget || 0,
        sort_order: i,
      });
    }
    await supabase.from('budget_income').insert({
      user_id: userId,
      category: 'Salario',
      amount: 0,
    });
    await upsertSettings(userId, 0);
  }
}
