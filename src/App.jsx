import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import { supabase } from "./lib/supabase";
import * as db from "./lib/db";
import Auth from "./Auth";

const CX = ["#E74C3C","#F39C12","#8E44AD","#2980B9","#1ABC9C","#D35400","#C0392B","#7F8C8D","#27AE60","#2C3E50","#E67E22","#9B59B6","#16A085","#F1C40F","#3498DB"];
const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const GROUPS = ["Hogar","Transporte","Servicios","Suscripciones","Educación","Personal","Financiero","Alimentación","Salud","Variable","Otro"];
const INCOME_CATS = ["Salario","Freelance","Negocio","Inversiones","Otro ingreso"];

const INIT_CATS = [
  { name:"Alquiler / Vivienda", type:"Fixed", essential:true, group:"Hogar", budget:0 },
  { name:"Energía Eléctrica", type:"Fixed", essential:true, group:"Hogar", budget:0 },
  { name:"Agua", type:"Fixed", essential:true, group:"Hogar", budget:0 },
  { name:"Internet", type:"Fixed", essential:true, group:"Servicios", budget:0 },
  { name:"Teléfono / Datos", type:"Fixed", essential:true, group:"Servicios", budget:0 },
  { name:"Gasolina", type:"Fixed", essential:true, group:"Transporte", budget:0 },
  { name:"Transporte público", type:"Variable", essential:true, group:"Transporte", budget:0 },
  { name:"Seguro vehículo", type:"Fixed", essential:true, group:"Transporte", budget:0 },
  { name:"Mantenimiento auto", type:"Fixed", essential:true, group:"Transporte", budget:0 },
  { name:"Supermercado", type:"Variable", essential:true, group:"Alimentación", budget:0 },
  { name:"Comida fuera", type:"Variable", essential:false, group:"Alimentación", budget:0 },
  { name:"Educación / Colegiatura", type:"Fixed", essential:true, group:"Educación", budget:0 },
  { name:"Cursos / Capacitación", type:"Fixed", essential:false, group:"Educación", budget:0 },
  { name:"Gimnasio", type:"Fixed", essential:false, group:"Salud", budget:0 },
  { name:"Seguro médico", type:"Fixed", essential:true, group:"Salud", budget:0 },
  { name:"Medicamentos", type:"Variable", essential:true, group:"Salud", budget:0 },
  { name:"Suscripciones digitales", type:"Fixed", essential:false, group:"Suscripciones", budget:0 },
  { name:"Streaming", type:"Fixed", essential:false, group:"Suscripciones", budget:0 },
  { name:"Seguros", type:"Fixed", essential:true, group:"Financiero", budget:0 },
  { name:"Deudas / Tarjeta", type:"Fixed", essential:true, group:"Financiero", budget:0 },
  { name:"Cuidado personal", type:"Variable", essential:false, group:"Personal", budget:0 },
  { name:"Ropa", type:"Variable", essential:false, group:"Personal", budget:0 },
  { name:"Entretenimiento", type:"Variable", essential:false, group:"Variable", budget:0 },
  { name:"Gastos varios", type:"Variable", essential:false, group:"Variable", budget:0 },
];

const fmtL = (v) => `L ${Number(v || 0).toLocaleString("es-HN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtS = (v) => { if (v >= 1e6) return `L${(v / 1e6).toFixed(1)}M`; if (v >= 1e3) return `L${(v / 1e3).toFixed(0)}k`; return `L${v}`; };
const pc = (p, t) => t > 0 ? Math.round(p / t * 100) : 0;
const td = () => new Date().toISOString().split("T")[0];
const getMk = (d) => d?.substring(0, 7) || "";
const cm = () => td().substring(0, 7);

const SK = "mis-finanzas-data"; // kept as fallback key

// Clean number input helper
const NumInput = ({ value, onChange, placeholder = "0", className = "", style = {} }) => {
  const display = value ? String(value) : "";
  return (
    <input
      type="number"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      onFocus={e => { if (e.target.value === "0") e.target.value = ""; }}
      className={`border border-gray-200 rounded-xl px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white ${className}`}
      style={{ fontFamily: "Space Mono", ...style }}
    />
  );
};

const Card = ({ children, className = "" }) => (<div className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${className}`}>{children}</div>);
const Badge = ({ children, color = "bg-gray-100 text-gray-600" }) => (<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{children}</span>);
const PB = ({ value, max, color = "#10B981", h = "8px" }) => (<div className="w-full rounded-full overflow-hidden" style={{ background: "#f0f0f0", height: h }}><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, max > 0 ? value / max * 100 : 0)}%`, background: color }} /></div>);
const Tab = ({ active, children, onClick, count }) => (
  <button onClick={onClick} className={`px-3 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${active ? "bg-gray-900 text-white shadow-md" : "text-gray-500 hover:bg-gray-100"}`}>
    {children}
    {count > 0 && <span className={`text-xs rounded-full px-1.5 ${active ? "bg-white/20" : "bg-gray-200"}`}>{count}</span>}
  </button>
);

// ════════════ ANALYTICS ════════════
function AnalyticsPanel({ income, expenses, categories, savingsGoal }) {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const net = income - total;
  const fixed = expenses.filter(e => e.varFixed === "Fixed").reduce((s, e) => s + e.amount, 0);
  const variable = total - fixed;
  const savRate = income > 0 ? Math.round(net / income * 100) : 0;
  const savPct = savingsGoal > 0 ? Math.min(100, Math.round(Math.max(0, net) / savingsGoal * 100)) : 0;

  const catTotals = useMemo(() => {
    const m = {}; expenses.forEach(e => { m[e.category] = (m[e.category] || 0) + e.amount; });
    return Object.entries(m).map(([n, a]) => ({ name: n, amount: a })).sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const grpTotals = useMemo(() => {
    const m = {}; expenses.forEach(e => { const c = categories.find(x => x.name === e.category); m[c?.group || "Otro"] = (m[c?.group || "Otro"] || 0) + e.amount; });
    return Object.entries(m).map(([n, a]) => ({ name: n, amount: a })).sort((a, b) => b.amount - a.amount);
  }, [expenses, categories]);

  const nonEss = useMemo(() => {
    const ess = new Set(categories.filter(c => c.essential).map(c => c.name));
    return catTotals.filter(c => !ess.has(c.name));
  }, [catTotals, categories]);
  const nonEssTotal = nonEss.reduce((s, e) => s + e.amount, 0);
  const essTotal = total - nonEssTotal;

  const radarData = useMemo(() => grpTotals.length >= 3 ? grpTotals.map(g => ({ subject: g.name, amount: g.amount })) : [], [grpTotals]);

  if (total === 0 && income === 0) return <Card className="p-8 text-center"><p className="text-gray-400 text-sm">Agregá datos para ver el análisis</p></Card>;

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3"><div className="text-xs text-gray-400 uppercase tracking-wider">Ingresos</div><div className="text-xl font-bold text-emerald-600" style={{ fontFamily: "Space Mono" }}>{fmtL(income)}</div></Card>
        <Card className="p-3"><div className="text-xs text-gray-400 uppercase tracking-wider">Gastos</div><div className="text-xl font-bold text-red-500" style={{ fontFamily: "Space Mono" }}>{fmtL(total)}</div></Card>
        <Card className="p-3"><div className="text-xs text-gray-400 uppercase tracking-wider">Ahorro neto</div><div className={`text-xl font-bold ${net >= 0 ? "text-gray-900" : "text-red-600"}`} style={{ fontFamily: "Space Mono" }}>{fmtL(net)}</div><div className="text-xs text-gray-400">{savRate}% del ingreso</div></Card>
        {savingsGoal > 0 && <Card className="p-3"><div className="text-xs text-gray-400 uppercase tracking-wider">Meta</div><div className={`text-xl font-bold ${savPct >= 100 ? "text-emerald-600" : "text-amber-500"}`}>{savPct}%</div><div className="text-xs text-gray-400">{fmtL(savingsGoal)}</div></Card>}
      </div>

      {/* Progress */}
      {savingsGoal > 0 && (
        <Card className="p-4">
          <div className="flex justify-between mb-2"><span className="text-sm font-semibold text-gray-700">Meta de ahorro</span><span className="text-sm font-bold" style={{ fontFamily: "Space Mono" }}>{fmtL(Math.max(0, net))} / {fmtL(savingsGoal)}</span></div>
          <PB value={Math.max(0, net)} max={savingsGoal} color={savPct >= 100 ? "#10B981" : savPct >= 70 ? "#F59E0B" : "#EF4444"} h="12px" />
        </Card>
      )}

      {/* Charts */}
      {catTotals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Por categoría</h3>
            <ResponsiveContainer width="100%" height={170}><PieChart><Pie data={catTotals} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={28}>{catTotals.map((_, i) => <Cell key={i} fill={CX[i % CX.length]} />)}</Pie><Tooltip formatter={v => fmtL(v)} /></PieChart></ResponsiveContainer>
            <div className="space-y-1 mt-1 max-h-28 overflow-y-auto">{catTotals.map((c, i) => (<div key={c.name} className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CX[i % CX.length] }} /><span className="text-gray-600 truncate flex-1">{c.name}</span><span className="font-medium text-gray-800" style={{ fontFamily: "Space Mono", fontSize: "10px" }}>{fmtL(c.amount)}</span></div>))}</div>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Composición</h3>
            <div className="space-y-3 mt-3">
              <div><div className="flex justify-between text-xs mb-1"><span className="text-blue-600 font-medium">Fijos: {fmtL(fixed)}</span><span className="text-gray-400">{pc(fixed, total)}%</span></div><PB value={fixed} max={total} color="#5B6FED" h="8px" /></div>
              <div><div className="flex justify-between text-xs mb-1"><span className="text-amber-600 font-medium">Variables: {fmtL(variable)}</span><span className="text-gray-400">{pc(variable, total)}%</span></div><PB value={variable} max={total} color="#F59E0B" h="8px" /></div>
              <div className="pt-2 border-t border-gray-100"><div className="flex justify-between text-xs mb-1"><span className="text-emerald-600 font-medium">Esenciales: {fmtL(essTotal)}</span><span className="text-gray-400">{pc(essTotal, total)}%</span></div><PB value={essTotal} max={total} color="#10B981" h="8px" /></div>
              <div><div className="flex justify-between text-xs mb-1"><span className="text-red-500 font-medium">No esenciales: {fmtL(nonEssTotal)}</span><span className="text-gray-400">{pc(nonEssTotal, total)}%</span></div><PB value={nonEssTotal} max={total} color="#EF4444" h="8px" /></div>
            </div>
          </Card>
        </div>
      )}

      {/* Ranking */}
      {catTotals.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Ranking</h3>
          <div className="space-y-2">{catTotals.map((c, i) => {
            const isE = categories.find(x => x.name === c.name)?.essential;
            return (<div key={c.name}><div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-300 w-4 text-right" style={{ fontFamily: "Space Mono" }}>{i + 1}</span><div className="flex-1"><div className="flex items-center justify-between mb-1"><span className="text-xs text-gray-700 flex items-center gap-1">{c.name}{!isE && <span className="text-amber-500">⚠</span>}</span><span className="text-xs font-bold text-gray-900" style={{ fontFamily: "Space Mono" }}>{fmtL(c.amount)} ({pc(c.amount, total)}%)</span></div><PB value={c.amount} max={catTotals[0]?.amount || 1} color={CX[i % CX.length]} h="4px" /></div></div></div>);
          })}</div>
        </Card>
      )}

      {/* Radar */}
      {radarData.length >= 3 && (<Card className="p-4"><h3 className="text-sm font-semibold text-gray-700 mb-2">Perfil</h3><ResponsiveContainer width="100%" height={220}><RadarChart data={radarData}><PolarGrid stroke="#e5e7eb" /><PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#6b7280" }} /><PolarRadiusAxis tick={{ fontSize: 8 }} tickFormatter={fmtS} /><Radar dataKey="amount" stroke="#6366F1" fill="#6366F1" fillOpacity={0.2} strokeWidth={2} /></RadarChart></ResponsiveContainer></Card>)}

      {/* Diagnóstico */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Diagnóstico</h3>
        <div className="space-y-2">
          {[
            { e: savRate >= 20 ? "🏆" : savRate >= 10 ? "✅" : "🔴", t: "Tasa de ahorro", d: `${savRate}% — ${savRate >= 20 ? "Excelente" : savRate >= 10 ? "Buena" : "Baja"}` },
            { e: total > 0 && fixed / total > 0.8 ? "⚠️" : "✅", t: "Rigidez", d: `${pc(fixed, total)}% fijos — ${total > 0 && fixed / total > 0.8 ? "Muy rígido" : "Flexible"}` },
            { e: nonEssTotal > income * 0.15 ? "⚠️" : "✅", t: "Prescindibles", d: `${fmtL(nonEssTotal)} (${pc(nonEssTotal, income)}%) — ${nonEssTotal > income * 0.15 ? "Revisar" : "OK"}` },
          ].map((x, i) => (<div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50"><span className="text-lg">{x.e}</span><div><p className="text-sm font-medium text-gray-700">{x.t}</p><p className="text-xs text-gray-500">{x.d}</p></div></div>))}
        </div>
      </Card>

      {/* 50/30/20 */}
      {income > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Regla 50/30/20</h3>
          <div className="grid grid-cols-3 gap-2">
            {[{ l: "Necesidades", ideal: 0.5, actual: essTotal, clr: "#1d4ed8" }, { l: "Deseos", ideal: 0.3, actual: nonEssTotal, clr: "#7e22ce" }, { l: "Ahorro", ideal: 0.2, actual: Math.max(0, net), clr: "#059669" }].map(x => (
              <div key={x.l} className="text-center p-2 bg-gray-50 rounded-xl">
                <div className="text-base font-bold" style={{ fontFamily: "Space Mono", color: x.clr }}>{fmtL(income * x.ideal)}</div>
                <div className="text-xs text-gray-500">{x.l} ({x.ideal * 100}%)</div>
                <div className="text-xs text-gray-400 mt-1">Real: {pc(x.actual, income)}%</div>
                <div className={`text-xs font-medium ${pc(x.actual, income) <= (x.ideal * 100 + 5) ? "text-emerald-600" : "text-red-500"}`}>{pc(x.actual, income) <= (x.ideal * 100 + 5) ? "✓" : "✗"}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Oportunidades */}
      {nonEss.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">💰 Podrías ahorrar</h3>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
            <div className="space-y-1">{nonEss.map(e => (<div key={e.name} className="flex justify-between text-xs"><span className="text-amber-700">{e.name}</span><span className="font-bold text-amber-800" style={{ fontFamily: "Space Mono" }}>+{fmtL(e.amount)}</span></div>))}</div>
            <div className="mt-2 pt-2 border-t border-amber-200"><p className="text-xs font-bold text-amber-900">{fmtL(nonEssTotal)}/mes → {fmtL(nonEssTotal * 12)}/año extra</p></div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ════════════ MAIN APP ════════════
export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center mx-auto mb-3 animate-pulse">
          <span className="text-white text-sm font-bold" style={{ fontFamily: "Space Mono" }}>MF</span>
        </div>
        <p className="text-gray-400 text-sm">Cargando...</p>
      </div>
    </div>
  );

  if (!session) return <Auth />;

  return <Dashboard session={session} />;
}

function Dashboard({ session }) {
  const userId = session.user.id;
  const userName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '';

  const [categories, setCategories] = useState(INIT_CATS);
  const [budgetIncome, setBudgetIncome] = useState([{ category: "Salario", amount: 0 }]);
  const [budgetOverrides, setBudgetOverrides] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [savingsGoal, setSavingsGoal] = useState(0);
  const [view, setView] = useState("presupuesto");
  const [selectedMonth, setSelectedMonth] = useState(cm());
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(td());
  const [formType, setFormType] = useState("Expense");
  const [formCat, setFormCat] = useState("");
  const [formVF, setFormVF] = useState("Fixed");
  const [formAmt, setFormAmt] = useState("");
  const [formNote, setFormNote] = useState("");
  const [editId, setEditId] = useState(null);
  const [projMonths, setProjMonths] = useState(12);
  const [projSavings, setProjSavings] = useState(0);
  const [projInterest, setProjInterest] = useState(0);
  const [projExpenses, setProjExpenses] = useState(0);
  const [editingCats, setEditingCats] = useState(false);
  const [addingIncome, setAddingIncome] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load data from Supabase on mount
  useEffect(() => {
    (async () => {
      await db.seedDefaults(userId, INIT_CATS);
      const data = await db.loadAllData(userId);
      if (data.categories.length > 0) setCategories(data.categories);
      setBudgetIncome(data.budgetIncome);
      setBudgetOverrides(data.budgetOverrides);
      setTransactions(data.transactions);
      setSavingsGoal(data.savingsGoal);
      setLoaded(true);
    })();
  }, [userId]);

  // Auto-save to Supabase — short debounce to batch rapid typing, then save
  const saveTimer = useRef(null);
  const pendingSave = useRef(false);

  const doSave = useCallback(async () => {
    if (!loaded) return;
    pendingSave.current = false;
    setSaving(true);
    try {
      await Promise.all([
        db.saveCategories(userId, categories),
        db.saveBudgetIncome(userId, budgetIncome),
        db.upsertSettings(userId, savingsGoal),
      ]);
    } catch (e) {
      console.error('Error saving data:', e);
    }
    setSaving(false);
  }, [userId, categories, budgetIncome, savingsGoal, loaded]);

  useEffect(() => {
    if (!loaded) return;
    pendingSave.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [categories, budgetIncome, savingsGoal, loaded, doSave]);

  // Save pending changes when user closes the tab
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingSave.current && loaded) {
        // Use sendBeacon for reliable save on page close
        const payload = JSON.stringify({ categories, budgetIncome, savingsGoal, userId });
        navigator.sendBeacon?.('/.netlify/functions/advisor', ''); // just trigger any pending network
        // Force synchronous save attempt
        doSave();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [doSave, categories, budgetIncome, savingsGoal, loaded, userId]);

  const handleLogout = async () => {
    // Save before logging out
    await doSave();
    await supabase.auth.signOut();
  };

  const getBudgetAmt = (catName, month) => {
    const key = `${month}:${catName}`;
    return budgetOverrides[key] !== undefined ? budgetOverrides[key] : (categories.find(c => c.name === catName)?.budget || 0);
  };
  const setBudgetAmt = (catName, month, val) => {
    setBudgetOverrides(prev => ({ ...prev, [`${month}:${catName}`]: val }));
    db.upsertBudgetOverride(userId, month, catName, val);
  };

  const budgetExpenses = useMemo(() => categories.filter(c => getBudgetAmt(c.name, selectedMonth) > 0).map(c => ({ category: c.name, amount: getBudgetAmt(c.name, selectedMonth), varFixed: c.type, date: `${selectedMonth}-01` })), [categories, selectedMonth, budgetOverrides]);
  const budgetTotal = budgetExpenses.reduce((s, e) => s + e.amount, 0);
  const budgetIncomeTotal = budgetIncome.reduce((s, i) => s + (i.amount || 0), 0);

  const monthTxns = useMemo(() => transactions.filter(t => getMk(t.date) === selectedMonth), [transactions, selectedMonth]);
  const realIncome = useMemo(() => monthTxns.filter(t => t.type === "Income").reduce((s, t) => s + t.amount, 0), [monthTxns]);
  const realExpTxns = useMemo(() => monthTxns.filter(t => t.type === "Expense" && t.amount > 0), [monthTxns]);
  const realExpTotal = realExpTxns.reduce((s, t) => s + t.amount, 0);

  const availableMonths = useMemo(() => {
    const set = new Set(transactions.map(t => getMk(t.date)));
    set.add(cm());
    return [...set].sort().reverse();
  }, [transactions]);

  // ── PROJECTION: Only show lines the user has configured ──
  const projData = useMemo(() => {
    const hasSavings = projSavings > 0;
    const hasExpenses = projExpenses > 0;
    if (!hasSavings && !hasExpenses) return [];
    const d = []; let cs = 0, ce = 0; const mr = projInterest / 100 / 12;
    for (let i = 0; i <= projMonths; i++) {
      if (i > 0) { if (hasSavings) cs = cs * (1 + mr) + projSavings; if (hasExpenses) ce += projExpenses; }
      const now = new Date(); const ml = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const entry = { month: `${MONTHS_ES[ml.getMonth()]} ${ml.getFullYear().toString().slice(2)}` };
      if (hasSavings) entry.ahorro = Math.round(cs);
      if (hasExpenses) entry.gastos = Math.round(ce);
      d.push(entry);
    } return d;
  }, [projMonths, projSavings, projInterest, projExpenses]);

  const handleSave = async () => {
    if (!formCat || !formAmt) return;
    const t = { date: formDate, type: formType, category: formCat, varFixed: formType === "Income" ? "" : formVF, amount: parseFloat(formAmt) || 0, note: formNote };
    if (editId) {
      t.id = editId;
      await db.updateTransaction(userId, t);
      setTransactions(p => p.map(x => x.id === editId ? t : x));
    } else {
      const { data } = await db.addTransaction(userId, t);
      if (data) setTransactions(p => [data, ...p]);
    }
    resetForm();
  };
  const resetForm = () => { setFormDate(td()); setFormType("Expense"); setFormCat(""); setFormVF("Fixed"); setFormAmt(""); setFormNote(""); setEditId(null); setShowForm(false); };
  const handleEdit = (t) => { setEditId(t.id); setFormDate(t.date); setFormType(t.type); setFormCat(t.category); setFormVF(t.varFixed || "Fixed"); setFormAmt(t.amount.toString()); setFormNote(t.note || ""); setShowForm(true); setView("gastos"); };
  const handleDelete = async (id) => {
    await db.deleteTransaction(userId, id);
    setTransactions(p => p.filter(t => t.id !== id));
  };

  const handleExport = () => { const csv = "Fecha,Tipo,Categoría,Fijo/Variable,Monto,Nota\n" + transactions.map(t => `${t.date},${t.type},${t.category},${t.varFixed},${t.amount},${t.note || ""}`).join("\n"); const b = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "mis-finanzas.csv"; a.click(); };
  const handleReset = async () => {
    if (confirm("¿Borrar todos los datos? Esta acción no se puede deshacer.")) {
      setCategories(INIT_CATS);
      setBudgetIncome([{ category: "Salario", amount: 0 }]);
      setBudgetOverrides({});
      setTransactions([]);
      setSavingsGoal(0);
      await db.saveCategories(userId, INIT_CATS);
      await db.saveBudgetIncome(userId, [{ category: "Salario", amount: 0 }]);
      await db.upsertSettings(userId, 0);
    }
  };

  if (!loaded) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-pulse text-gray-400">Cargando...</div></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center"><span className="text-white text-xs font-bold" style={{ fontFamily: "Space Mono" }}>MF</span></div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 leading-tight">Mis Finanzas</h1>
              {saving && <span className="text-[10px] text-emerald-500">Guardando...</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
              {availableMonths.map(m => { const [y, mo] = m.split("-"); return <option key={m} value={m}>{MONTHS_ES[parseInt(mo) - 1]} {y}</option>; })}
            </select>
            <button onClick={handleLogout} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors" title="Cerrar sesión">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          <Tab active={view === "presupuesto"} onClick={() => setView("presupuesto")}>📋 Presupuesto</Tab>
          <Tab active={view === "gastos"} onClick={() => setView("gastos")} count={monthTxns.filter(t => t.amount > 0).length}>💳 Gastos</Tab>
          <Tab active={view === "proyeccion"} onClick={() => setView("proyeccion")}>📈 Proyección</Tab>
          <Tab active={view === "asesor"} onClick={() => setView("asesor")}>🤖 Asesor IA</Tab>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 pb-28">

        {/* ═══ PRESUPUESTO ═══ */}
        {view === "presupuesto" && (
          <div className="space-y-5">
            {/* Meta de ahorro - prominente */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div><h3 className="text-sm font-semibold text-gray-700">Meta de ahorro mensual</h3><p className="text-xs text-gray-400">¿Cuánto querés ahorrar cada mes?</p></div>
                <NumInput value={savingsGoal} onChange={setSavingsGoal} className="w-28" />
              </div>
            </Card>

            {/* Ingresos */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-emerald-700">💰 Ingresos del mes</h3>
                <span className="text-lg font-bold text-emerald-700" style={{ fontFamily: "Space Mono" }}>{fmtL(budgetIncomeTotal)}</span>
              </div>
              <div className="space-y-2">
                {budgetIncome.map((inc, idx) => (
                  <div key={idx} className="flex items-center gap-2 py-1.5">
                    <span className="text-sm text-gray-700 flex-1">{inc.category}</span>
                    <NumInput value={inc.amount} onChange={v => setBudgetIncome(p => p.map((x, i) => i === idx ? { ...x, amount: v } : x))} className="w-28 border-emerald-200 focus:ring-emerald-400" />
                    {budgetIncome.length > 1 && <button onClick={() => setBudgetIncome(p => p.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-400 text-sm">✕</button>}
                  </div>
                ))}
                {addingIncome ? (
                  <div className="flex gap-2 items-center mt-2">
                    <select className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2" id="newIncCat">
                      {INCOME_CATS.filter(c => !budgetIncome.find(i => i.category === c)).map(c => <option key={c}>{c}</option>)}
                    </select>
                    <button onClick={() => { const sel = document.getElementById("newIncCat").value; if (sel) { setBudgetIncome(p => [...p, { category: sel, amount: 0 }]); setAddingIncome(false); } }} className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm">Agregar</button>
                    <button onClick={() => setAddingIncome(false)} className="text-xs text-gray-400">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingIncome(true)} className="text-xs text-emerald-600 hover:text-emerald-700 mt-1">+ Agregar fuente de ingreso</button>
                )}
              </div>
            </Card>

            {/* Gastos por grupo */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-red-500">📝 Gastos planificados</h3>
                <span className="text-lg font-bold text-red-500" style={{ fontFamily: "Space Mono" }}>{fmtL(budgetTotal)}</span>
              </div>

              {GROUPS.filter(g => categories.some(c => c.group === g)).map(group => {
                const cats = categories.filter(c => c.group === group);
                const gt = cats.reduce((s, c) => s + getBudgetAmt(c.name, selectedMonth), 0);
                return (
                  <div key={group} className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{group}</span>
                      {gt > 0 && <span className="text-xs text-gray-400" style={{ fontFamily: "Space Mono" }}>{fmtL(gt)}</span>}
                    </div>
                    <div className="space-y-1">
                      {cats.map(cat => (
                        <div key={cat.name} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50">
                          <span className={`text-xs ${cat.essential ? "text-emerald-500" : "text-amber-400"}`}>{cat.essential ? "●" : "○"}</span>
                          <span className="text-sm text-gray-700 flex-1 truncate">{cat.name}</span>
                          <NumInput value={getBudgetAmt(cat.name, selectedMonth)} onChange={v => setBudgetAmt(cat.name, selectedMonth, v)} className="w-24 border-gray-200" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Manage categories toggle */}
              <div className="border-t border-gray-100 pt-3 mt-3">
                <button onClick={() => setEditingCats(!editingCats)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                  ⚙️ {editingCats ? "Ocultar" : "Administrar categorías"}
                </button>
              </div>

              {editingCats && (
                <div className="mt-3 space-y-2 p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-2">Editá, eliminá o agregá categorías</p>
                  {categories.map((cat, idx) => (
                    <div key={idx} className="flex items-center gap-2 py-1">
                      <button onClick={() => setCategories(p => p.map((c, i) => i === idx ? { ...c, essential: !c.essential } : c))} className={`w-4 h-4 rounded border flex items-center justify-center text-xs flex-shrink-0 ${cat.essential ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300"}`}>✓</button>
                      <input value={cat.name} onChange={e => setCategories(p => p.map((c, i) => i === idx ? { ...c, name: e.target.value } : c))} className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white min-w-0" />
                      <select value={cat.group} onChange={e => setCategories(p => p.map((c, i) => i === idx ? { ...c, group: e.target.value } : c))} className="text-xs border border-gray-200 rounded-lg px-1 py-1 bg-white w-24">{GROUPS.map(g => <option key={g}>{g}</option>)}</select>
                      <select value={cat.type} onChange={e => setCategories(p => p.map((c, i) => i === idx ? { ...c, type: e.target.value } : c))} className="text-xs border border-gray-200 rounded-lg px-1 py-1 bg-white"><option value="Fixed">Fijo</option><option value="Variable">Var</option></select>
                      <button onClick={() => setCategories(p => p.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 text-xs flex-shrink-0">✕</button>
                    </div>
                  ))}
                  <AddCatInline onAdd={(n, t, e, g) => setCategories(p => [...p, { name: n, type: t, essential: e, group: g, budget: 0 }])} />
                </div>
              )}
            </Card>

            {/* Summary */}
            <Card className="p-4 bg-gray-900 text-white border-gray-800">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs text-gray-400">Ahorro proyectado</div>
                  <div className="text-2xl font-bold" style={{ fontFamily: "Space Mono" }}>{fmtL(budgetIncomeTotal - budgetTotal)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">de tu ingreso</div>
                  <div className="text-2xl font-bold">{budgetIncomeTotal > 0 ? pc(budgetIncomeTotal - budgetTotal, budgetIncomeTotal) : 0}%</div>
                </div>
              </div>
            </Card>

            {/* Analytics */}
            {(budgetTotal > 0 || budgetIncomeTotal > 0) && (
              <>
                <p className="text-xs text-gray-400 text-center">— Análisis del presupuesto —</p>
                <AnalyticsPanel income={budgetIncomeTotal} expenses={budgetExpenses} categories={categories} savingsGoal={savingsGoal} />
              </>
            )}

            {/* Data actions */}
            <div className="flex gap-2 pt-2">
              <button onClick={handleExport} className="flex-1 px-4 py-2 bg-gray-100 rounded-xl text-xs text-gray-600 hover:bg-gray-200 active:bg-gray-300">Exportar CSV</button>
              <button onClick={handleReset} className="px-4 py-2 bg-red-50 rounded-xl text-xs text-red-500 hover:bg-red-100 active:bg-red-200">Borrar todo</button>
            </div>
          </div>
        )}

        {/* ═══ GASTOS REALES ═══ */}
        {view === "gastos" && (
          <div className="space-y-5">
            {/* Quick compare */}
            {(budgetTotal > 0 || realExpTotal > 0) && (
              <Card className="p-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><div className="text-xs text-gray-400">Plan</div><div className="text-sm font-bold text-gray-500" style={{ fontFamily: "Space Mono" }}>{fmtL(budgetTotal)}</div></div>
                  <div><div className="text-xs text-gray-400">Gastado</div><div className={`text-sm font-bold ${realExpTotal > budgetTotal && budgetTotal > 0 ? "text-red-600" : "text-emerald-600"}`} style={{ fontFamily: "Space Mono" }}>{fmtL(realExpTotal)}</div></div>
                  <div><div className="text-xs text-gray-400">Disponible</div><div className={`text-sm font-bold ${budgetTotal - realExpTotal >= 0 ? "text-emerald-600" : "text-red-600"}`} style={{ fontFamily: "Space Mono" }}>{fmtL(budgetTotal - realExpTotal)}</div></div>
                </div>
              </Card>
            )}

            {/* Form */}
            {showForm ? (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-gray-700">{editId ? "Editar" : "Nuevo registro"}</h3><button onClick={resetForm} className="text-gray-400 text-lg">&times;</button></div>
                <div className="space-y-3">
                  <div className="flex gap-2">{["Expense", "Income"].map(t => (<button key={t} onClick={() => { setFormType(t); setFormCat(""); }} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${formType === t ? (t === "Expense" ? "bg-red-50 text-red-600 ring-2 ring-red-200" : "bg-emerald-50 text-emerald-600 ring-2 ring-emerald-200") : "bg-gray-50 text-gray-400"}`}>{t === "Expense" ? "Gasto" : "Ingreso"}</button>))}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-gray-500 block mb-1">Fecha</label><input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" /></div>
                    <div><label className="text-xs text-gray-500 block mb-1">Monto</label><NumInput value={formAmt ? parseFloat(formAmt) : 0} onChange={v => setFormAmt(v ? String(v) : "")} className="w-full" /></div>
                  </div>
                  <div><label className="text-xs text-gray-500 block mb-1">Categoría</label>
                    <select value={formCat} onChange={e => { setFormCat(e.target.value); if (formType === "Expense") { const c = categories.find(x => x.name === e.target.value); if (c) setFormVF(c.type); } }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                      <option value="">Seleccionar...</option>
                      {formType === "Income" ? INCOME_CATS.map(c => <option key={c}>{c}</option>) : categories.map(c => <option key={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs text-gray-500 block mb-1">Nota (opcional)</label><input type="text" value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Ej: Almuerzo con amigos" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" /></div>
                  <button onClick={handleSave} className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-gray-800 active:bg-gray-700">{editId ? "Actualizar" : "Guardar"}</button>
                </div>
              </Card>
            ) : (
              <button onClick={() => setShowForm(true)} className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-5 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 active:bg-gray-50 transition-colors">+ Registrar gasto o ingreso</button>
            )}

            {/* List */}
            <Card className="divide-y divide-gray-50 overflow-hidden">
              {monthTxns.filter(t => t.amount > 0).length === 0 ? <p className="text-gray-400 text-sm text-center py-8">Sin registros este mes</p> :
                [...monthTxns].filter(t => t.amount > 0).sort((a, b) => b.date.localeCompare(a.date)).map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${t.type === "Income" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>{t.type === "Income" ? "↑" : "↓"}</div>
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium text-gray-800 truncate">{t.category}</div><div className="text-xs text-gray-400">{new Date(t.date + "T12:00:00").toLocaleDateString("es-HN", { day: "numeric", month: "short" })} {t.note ? `· ${t.note}` : ""}</div></div>
                    <span className={`text-sm font-bold whitespace-nowrap ${t.type === "Income" ? "text-emerald-600" : "text-red-500"}`} style={{ fontFamily: "Space Mono" }}>{t.type === "Income" ? "+" : "-"}{fmtL(t.amount)}</span>
                    <button onClick={() => handleEdit(t)} className="text-gray-300 hover:text-blue-500 text-xs p-1">✏️</button>
                    <button onClick={() => handleDelete(t.id)} className="text-gray-300 hover:text-red-500 text-xs p-1">🗑</button>
                  </div>
                ))
              }
            </Card>

            {/* Plan vs Real */}
            {realExpTxns.length > 0 && budgetTotal > 0 && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Plan vs Real</h3>
                <div className="space-y-2">
                  {categories.filter(c => getBudgetAmt(c.name, selectedMonth) > 0 || realExpTxns.some(t => t.category === c.name)).map(cat => {
                    const b = getBudgetAmt(cat.name, selectedMonth); const a = realExpTxns.filter(t => t.category === cat.name).reduce((s, t) => s + t.amount, 0); const over = a > b && b > 0;
                    return (<div key={cat.name} className="py-1.5 px-2 rounded-lg bg-gray-50"><div className="flex items-center justify-between mb-1"><span className="text-xs text-gray-700 truncate">{cat.name}</span><div className="flex gap-2 text-xs" style={{ fontFamily: "Space Mono" }}><span className="text-gray-400">{fmtL(b)}</span><span className={over ? "text-red-600 font-bold" : "text-emerald-600 font-bold"}>{fmtL(a)}</span></div></div>{b > 0 && <PB value={a} max={b} color={over ? "#EF4444" : "#10B981"} h="3px" />}</div>);
                  })}
                </div>
              </Card>
            )}

            {/* Analytics */}
            {realExpTxns.length > 0 && (
              <>
                <p className="text-xs text-gray-400 text-center">— Análisis de gastos reales —</p>
                <AnalyticsPanel income={realIncome || budgetIncomeTotal} expenses={realExpTxns} categories={categories} savingsGoal={savingsGoal} />
              </>
            )}
          </div>
        )}

        {/* ═══ PROYECCIÓN ═══ */}
        {view === "proyeccion" && (
          <div className="space-y-5">
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Configurar proyección</h3>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500 block mb-1">Ahorro mensual</label><NumInput value={projSavings} onChange={setProjSavings} placeholder="¿Cuánto ahorrás al mes?" className="w-full" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Gastos mensuales (opcional, para comparar)</label><NumInput value={projExpenses} onChange={setProjExpenses} placeholder="Ej: tus gastos fijos mensuales" className="w-full" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Meses: {projMonths} ({(projMonths / 12).toFixed(1)} años)</label><input type="range" min={3} max={60} value={projMonths} onChange={e => setProjMonths(Number(e.target.value))} className="w-full mt-1 accent-gray-900" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Interés anual (%)</label><NumInput value={projInterest} onChange={setProjInterest} placeholder="0" className="w-full" /></div>
              </div>
            </Card>

            {projData.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-gray-400 text-sm">Ingresá un monto de ahorro o gastos para ver la proyección</p>
              </Card>
            ) : (
              <>
                {/* Main chart */}
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">
                    {projSavings > 0 && projExpenses > 0 ? "Ahorro vs Gastos" : projSavings > 0 ? "Proyección de ahorro" : "Proyección de gastos"}
                  </h3>
                  {projSavings > 0 && <p className="text-xs text-gray-400 mb-3">{fmtL(projSavings)}/mes → <span className="font-bold text-emerald-600">{fmtL(projData[projData.length - 1]?.ahorro || 0)}</span> en {projMonths} meses</p>}

                  <ResponsiveContainer width="100%" height={260}>
                    {projSavings > 0 && projExpenses > 0 ? (
                      <LineChart data={projData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="month" tick={{ fontSize: 9 }} interval={Math.max(0, Math.floor(projMonths / 6))} /><YAxis tickFormatter={fmtS} tick={{ fontSize: 10 }} /><Tooltip formatter={v => fmtL(v)} /><Legend />
                        <Line type="monotone" dataKey="ahorro" name="Ahorro" stroke="#10B981" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="gastos" name="Gastos" stroke="#EF4444" strokeWidth={2.5} dot={false} strokeDasharray="5 5" />
                      </LineChart>
                    ) : (
                      <AreaChart data={projData}>
                        <defs>
                          <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={projSavings > 0 ? "#10B981" : "#EF4444"} stopOpacity={0.3} /><stop offset="95%" stopColor={projSavings > 0 ? "#10B981" : "#EF4444"} stopOpacity={0} /></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="month" tick={{ fontSize: 9 }} interval={Math.max(0, Math.floor(projMonths / 6))} /><YAxis tickFormatter={fmtS} tick={{ fontSize: 10 }} /><Tooltip formatter={v => fmtL(v)} />
                        {projSavings > 0 && <Area type="monotone" dataKey="ahorro" name="Ahorro" stroke="#10B981" fill="url(#gA)" strokeWidth={2.5} dot={false} />}
                        {projExpenses > 0 && !projSavings && <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#EF4444" fill="url(#gA)" strokeWidth={2.5} dot={false} />}
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </Card>

                {/* Milestones */}
                {projSavings > 0 && (
                  <Card className="p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Hitos de ahorro</h3>
                    <div className="space-y-2">{[50000, 100000, 250000, 500000, 1000000].map(g => { const n = Math.ceil(g / projSavings); return (<div key={g} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"><span className="text-sm text-gray-700">{fmtL(g)}</span><span className="text-xs text-gray-400" style={{ fontFamily: "Space Mono" }}>{n <= 120 ? `${n} meses (${(n / 12).toFixed(1)} años)` : "—"}</span></div>); })}</div>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ ASESOR IA ═══ */}
        {view === "asesor" && (
          <AdvisorPanel
            income={budgetIncomeTotal}
            budgetTotal={budgetTotal}
            categories={categories}
            transactions={transactions}
            savingsGoal={savingsGoal}
            selectedMonth={selectedMonth}
            getBudgetAmt={getBudgetAmt}
            realExpTotal={realExpTotal}
            realIncome={realIncome}
          />
        )}
      </main>

      {view !== "asesor" && <button onClick={() => { setShowForm(true); setView("gastos"); }} className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gray-900 text-white shadow-xl flex items-center justify-center text-2xl hover:scale-105 active:scale-95 transition-transform z-50">+</button>}
    </div>
  );
}

// ════════════ AI ADVISOR ════════════
function AdvisorPanel({ income, budgetTotal, categories, transactions, savingsGoal, selectedMonth, getBudgetAmt, realExpTotal, realIncome }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEnd = useRef(null);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const monthTxns = useMemo(() => transactions.filter(t => getMk(t.date) === selectedMonth), [transactions, selectedMonth]);
  const expTxns = useMemo(() => monthTxns.filter(t => t.type === "Expense" && t.amount > 0), [monthTxns]);
  const incTxns = useMemo(() => monthTxns.filter(t => t.type === "Income"), [monthTxns]);

  const catSpent = useMemo(() => {
    const m = {};
    expTxns.forEach(e => { m[e.category] = (m[e.category] || 0) + e.amount; });
    return m;
  }, [expTxns]);

  const buildSystemPrompt = () => {
    const catBudgets = categories
      .filter(c => getBudgetAmt(c.name, selectedMonth) > 0)
      .map(c => `  ${c.name} (${c.group}, ${c.essential ? "Esencial" : "No esencial"}, ${c.type}): Presupuesto L ${getBudgetAmt(c.name, selectedMonth)} | Gastado L ${catSpent[c.name] || 0}`)
      .join("\n");

    const recentExp = expTxns
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 25)
      .map(e => `  ${e.date} | ${e.category} | ${e.note || "Sin nota"}: L ${e.amount}`)
      .join("\n");

    const incomeDetail = incTxns.length > 0
      ? incTxns.map(i => `  ${i.category}: L ${i.amount}`).join("\n")
      : "  (Sin ingresos registrados este mes)";

    const totalExpMonth = expTxns.reduce((s, e) => s + e.amount, 0);
    const available = income - totalExpMonth;

    return `Eres el Asesor Financiero IA de la app "Mis Finanzas (MF)". Tu rol es ayudar al usuario a tomar mejores decisiones financieras basándote en sus datos reales. Eres directo, honesto y práctico.

DATOS FINANCIEROS DEL USUARIO — MES: ${selectedMonth}
══════════════════════════════════════════
Ingreso Presupuestado: L ${income}
Ingreso Real Registrado: L ${realIncome || 0}
Gasto Presupuestado Total: L ${budgetTotal}
Gasto Real Total: L ${totalExpMonth}
Disponible (Ingreso - Gasto Real): L ${available}
Meta de Ahorro Mensual: L ${savingsGoal}
Ahorro Proyectado: L ${income - totalExpMonth}

INGRESOS REALES:
${incomeDetail}

PRESUPUESTO vs GASTO REAL POR CATEGORÍA:
${catBudgets || "  (Sin presupuesto definido)"}

ÚLTIMOS GASTOS REGISTRADOS:
${recentExp || "  (Sin gastos registrados)"}
══════════════════════════════════════════

INSTRUCCIONES:
- Respondé SIEMPRE en español
- Sé directo, concreto y usá los datos reales del usuario
- Usá emojis moderadamente
- Cuando evalúes una compra, analizá: si cabe en el presupuesto, en qué categoría entra, cuánto queda disponible después, y si afecta la meta de ahorro. Siempre da un veredicto claro (✅ Viable / ⚠️ Ajustado / ❌ No recomendable)
- Si ves gastos excesivos o patrones preocupantes, señálalos con tacto pero honestidad
- Da consejos prácticos y específicos, no genéricos
- Formateá montos como "L X,XXX"
- Mantené respuestas concisas (máximo 4 párrafos)
- Si no hay datos suficientes, sugerí al usuario que registre más información
- Cuando compares plan vs real, señalá las categorías que se pasaron del presupuesto`;
  };

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));
      const response = await fetch("/.netlify/functions/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildSystemPrompt(),
          messages: apiMessages,
        })
      });
      const data = await response.json();
      const aiText = data.content?.map(b => b.text || "").join("") || "No pude procesar tu consulta. Intentá de nuevo.";
      setMessages(prev => [...prev, { role: "assistant", content: aiText }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Error al conectar con el asesor. Verificá que la API key esté configurada en Netlify (ANTHROPIC_API_KEY) y que tengas conexión a internet." }]);
    }
    setLoading(false);
  };

  const quickActions = [
    { icon: "🛒", label: "¿Puedo comprar...?", prompt: "Quiero evaluar una compra. Primero, basándote en mis datos actuales, ¿cuál es mi margen real para una compra extra este mes? ¿Cuánto puedo gastar sin comprometer mi meta de ahorro?" },
    { icon: "🔍", label: "Analizar gastos", prompt: "Analizá mis gastos del mes en detalle. ¿Hay categorías donde me pasé del presupuesto? ¿Patrones preocupantes? Dame tu evaluación honesta comparando plan vs real." },
    { icon: "💡", label: "Dónde ahorrar", prompt: "Basándote en mis gastos y presupuesto, ¿en qué áreas concretas puedo recortar o ahorrar? Dame sugerencias prácticas y específicas con montos estimados." },
    { icon: "📋", label: "Resumen", prompt: "Dame un resumen ejecutivo de mi salud financiera este mes. Incluí: lo positivo, lo que preocupa, si voy a cumplir mi meta de ahorro, y un consejo clave." },
  ];

  return (
    <div className="space-y-4">
      {/* AI Header */}
      <Card className="p-4 bg-gradient-to-br from-indigo-50 to-emerald-50 border-indigo-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center text-white text-lg shadow-md">🧠</div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Asesor Financiero MF</h2>
            <p className="text-xs text-gray-500">Analiza tus datos en tiempo real</p>
          </div>
        </div>
        {messages.length === 0 && (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Preguntame si podés comprar algo, pedí que analice tus gastos, o pedí consejos personalizados basados en tus datos reales.
          </p>
        )}
      </Card>

      {/* Quick Actions */}
      {messages.length === 0 && (
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((qa, i) => (
            <button key={i} onClick={() => sendMessage(qa.prompt)}
              className="flex items-center gap-2 p-3 bg-white rounded-xl border border-gray-100 text-left hover:border-gray-300 hover:shadow-sm active:bg-gray-50 transition-all">
              <span className="text-lg">{qa.icon}</span>
              <span className="text-xs font-medium text-gray-700">{qa.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Chat Messages */}
      <div className="space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-gray-900 text-white rounded-br-md"
                : "bg-white border border-gray-100 text-gray-700 rounded-bl-md shadow-sm"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEnd} />
      </div>

      {/* Input Area */}
      <div className="sticky bottom-20 bg-gray-50 pt-2 pb-1">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="¿Puedo comprar un iPhone 16...?"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg transition-all ${
              input.trim() && !loading
                ? "bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-700 shadow-md"
                : "bg-gray-100 text-gray-300 cursor-not-allowed"
            }`}
          >
            ➤
          </button>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="text-xs text-gray-400 hover:text-gray-600 mt-2 w-full text-center">
            Limpiar conversación
          </button>
        )}
      </div>
    </div>
  );
}

function AddCatInline({ onAdd }) {
  const [n, sN] = useState(""); const [g, sG] = useState("Personal"); const [t, sT] = useState("Fixed"); const [e, sE] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
      <input value={n} onChange={e => sN(e.target.value)} placeholder="Nueva categoría" className="flex-1 min-w-24 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white" />
      <select value={g} onChange={e => sG(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-1 py-1.5 bg-white">{GROUPS.map(g => <option key={g}>{g}</option>)}</select>
      <button onClick={() => { if (n.trim()) { onAdd(n.trim(), t, e, g); sN(""); } }} className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium">+</button>
    </div>
  );
}
