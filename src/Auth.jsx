import { useState } from 'react';
import { supabase } from './lib/supabase';

export default function Auth() {
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message);
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); setLoading(false); return; }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });
    if (error) setError(error.message);
    else { setSuccess('¡Cuenta creada! Revisá tu correo para confirmar.'); setMode('login'); }
    setLoading(false);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) setError(error.message);
    else setSuccess('Te enviamos un enlace para restablecer tu contraseña.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold" style={{ fontFamily: 'Space Mono' }}>MF</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Finanzas</h1>
          <p className="text-gray-500 text-sm mt-1">
            {mode === 'login' && 'Iniciá sesión para controlar tus finanzas'}
            {mode === 'register' && 'Creá tu cuenta gratuita'}
            {mode === 'forgot' && 'Recuperá tu contraseña'}
          </p>
        </div>

        {/* Features (only on login) */}
        {mode === 'login' && (
          <div className="space-y-2.5 mb-8">
            {[
              ['📋', 'Planificá tu presupuesto mensual'],
              ['💳', 'Registrá tus gastos reales'],
              ['📊', 'Visualizá a dónde va tu dinero'],
              ['📈', 'Proyectá tu ahorro en el tiempo'],
              ['🤖', 'Consultá a tu asesor financiero IA'],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
                <span className="text-lg">{icon}</span>
                <span className="text-sm text-gray-700">{text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        <form onSubmit={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleForgot} className="space-y-3">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Nombre completo"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              required
            />
          )}
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            required
          />
          {mode !== 'forgot' && (
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              required
            />
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <p className="text-xs text-emerald-600">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-gray-800 active:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Cargando...
              </span>
            ) : (
              <>
                {mode === 'login' && 'Iniciar sesión'}
                {mode === 'register' && 'Crear cuenta'}
                {mode === 'forgot' && 'Enviar enlace'}
              </>
            )}
          </button>
        </form>

        {/* Links */}
        <div className="mt-4 text-center space-y-2">
          {mode === 'login' && (
            <>
              <button onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }} className="text-xs text-gray-400 hover:text-gray-600 block w-full">
                ¿Olvidaste tu contraseña?
              </button>
              <p className="text-sm text-gray-500">
                ¿No tenés cuenta?{' '}
                <button onClick={() => { setMode('register'); setError(''); setSuccess(''); }} className="text-gray-900 font-semibold hover:underline">
                  Registrate
                </button>
              </p>
            </>
          )}
          {(mode === 'register' || mode === 'forgot') && (
            <p className="text-sm text-gray-500">
              <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }} className="text-gray-900 font-semibold hover:underline">
                ← Volver al inicio de sesión
              </button>
            </p>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-6 text-center">Tus datos se guardan de forma segura en la nube</p>
      </div>
    </div>
  );
}
