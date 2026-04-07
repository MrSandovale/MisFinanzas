# Mis Finanzas — Control de Presupuesto Personal

App de finanzas personales con base de datos, autenticación y asesor financiero IA.

## Stack
- **Frontend:** React + Vite + Tailwind CSS
- **Backend/DB:** Supabase (PostgreSQL + Auth)
- **IA:** Claude API via Netlify Functions
- **Hosting:** Netlify

---

## Configuración paso a paso

### 1. Crear proyecto en Supabase (gratis)

1. Ir a [supabase.com](https://supabase.com) → "Start your project"
2. Crear una organización y un proyecto nuevo
3. Anotar tu **Project URL** y **anon public key** (están en Settings → API)

### 2. Crear las tablas

1. En Supabase Dashboard → **SQL Editor**
2. Copiar y pegar todo el contenido de `supabase-schema.sql`
3. Ejecutar → Esto crea las 5 tablas con Row Level Security

### 3. Configurar autenticación

1. En Supabase → **Authentication → Providers**
2. Asegurar que **Email** esté habilitado
3. (Opcional) En Authentication → URL Configuration, agregar tu URL de Netlify como Site URL

### 4. Variables de entorno

Crear un archivo `.env` en la raíz del proyecto:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

### 5. Instalar y correr localmente

```bash
npm install
npm run dev
```

### 6. Deploy a Netlify

Subir el proyecto a GitHub y conectar con Netlify:
- Build command: `npm run build`
- Publish directory: `dist`

### 7. Variables de entorno en Netlify

En Netlify Dashboard → Site configuration → Environment variables:

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Tu URL de Supabase |
| `VITE_SUPABASE_ANON_KEY` | Tu anon key de Supabase |
| `ANTHROPIC_API_KEY` | Tu API key de Anthropic (para el asesor IA) |

---

## Estructura de la base de datos

| Tabla | Propósito |
|---|---|
| `user_settings` | Meta de ahorro por usuario |
| `categories` | Categorías de gasto personalizables |
| `budget_income` | Fuentes de ingreso presupuestado |
| `budget_overrides` | Presupuesto por categoría por mes |
| `transactions` | Gastos e ingresos reales registrados |

Todas las tablas tienen Row Level Security (RLS) — cada usuario solo ve su propia data.
