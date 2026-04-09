

## Plan: Admin Login mejorado, resultados por sets, y sistema de desafíos

### Resumen

Tres cambios principales:
1. **Login de admin dedicado** — separar la pestaña admin de la página de login pública; el admin accede desde `/admin` directamente con un formulario de login si no está autenticado.
2. **Resultados por puntos de cada set** — en vez de solo "3-1" (sets ganados), registrar el puntaje de cada set individual (ej: 11-9, 11-7, 8-11, 11-5).
3. **Sistema de desafíos** — partidos fuera de torneo entre dos jugadores que también afectan el rating.

---

### 1. Login de Admin integrado en AdminPanel

- Modificar `AdminPanel.tsx`: si el usuario no es admin, mostrar un formulario de login admin directamente en esa página (en vez de redirigir a `/login`).
- Eliminar la pestaña "Admin" de `Login.tsx` para que los jugadores no vean esa opción.
- El admin accede escribiendo `/admin` en la URL.

### 2. Resultados por puntos de set

**Base de datos:**
- Crear migración para agregar una columna `set_scores` (tipo `jsonb`, nullable) en la tabla `matches`. Almacenará un array como `[{"p1": 11, "p2": 9}, {"p1": 11, "p2": 7}, {"p1": 8, "p2": 11}]`.

**Edge Function (`admin/index.ts`):**
- En `record_match`, aceptar un campo `set_scores` (array de objetos) además de `player1_score`/`player2_score`.
- Calcular automáticamente `player1_score` y `player2_score` (sets ganados) a partir de los sets individuales.

**Frontend (`AdminPanel.tsx`):**
- Reemplazar los inputs de "Sets J1" / "Sets J2" por un formulario dinámico donde el admin agrega sets uno a uno (Puntaje J1 / Puntaje J2 por cada set).
- Botón "Agregar Set" para añadir filas.

**Vista (`TournamentDetail.tsx`):**
- Mostrar el detalle de cada set al expandir un partido (ej: "11-9, 11-7, 8-11, 11-5").

### 3. Sistema de Desafíos

**Base de datos:**
- Crear tabla `challenges`:
  - `id` (uuid, PK)
  - `challenger_id` (uuid, NOT NULL) — jugador que desafía
  - `challenged_id` (uuid, NOT NULL) — jugador desafiado
  - `status` (text, default 'pending') — pending/accepted/completed/rejected
  - `set_scores` (jsonb, nullable)
  - `challenger_sets_won` (int, nullable)
  - `challenged_sets_won` (int, nullable)
  - `winner_id` (uuid, nullable)
  - `rating_change_challenger` (int, default 0)
  - `rating_change_challenged` (int, default 0)
  - `created_at` (timestamptz, default now())
- RLS: lectura pública, escritura vía edge functions.

**Edge Function (`admin/index.ts`):**
- Nuevas acciones:
  - `create_challenge` — un jugador desafía a otro (requiere player token).
  - `respond_challenge` — el desafiado acepta o rechaza.
  - `record_challenge_result` — el admin registra el resultado con sets detallados; se aplica el mismo cálculo de rating que los partidos de torneo.

**Frontend:**
- Nueva página `Challenges.tsx` (`/desafios`):
  - Lista de desafíos pendientes, aceptados y completados.
  - Jugadores logueados pueden crear un desafío seleccionando un oponente.
  - El oponente puede aceptar/rechazar desde su vista.
- En `AdminPanel.tsx`: sección para registrar resultados de desafíos (similar a partidos de torneo pero sin torneo).
- Agregar enlace "Desafíos" en el `Navbar`.

### 4. Archivos a modificar/crear

| Archivo | Cambio |
|---|---|
| `supabase/migrations/new` | Agregar `set_scores` a `matches`, crear tabla `challenges` |
| `supabase/functions/admin/index.ts` | Acciones: `record_challenge_result`, soporte `set_scores` en `record_match` |
| `supabase/functions/auth/index.ts` | Acción `create_challenge`, `respond_challenge` |
| `src/pages/AdminPanel.tsx` | Login inline, formulario de sets dinámico, sección desafíos |
| `src/pages/Login.tsx` | Quitar pestaña admin |
| `src/pages/Challenges.tsx` | Nueva página de desafíos |
| `src/pages/TournamentDetail.tsx` | Mostrar detalle de sets |
| `src/pages/PlayerProfile.tsx` | Mostrar historial de desafíos |
| `src/components/Navbar.tsx` | Link a Desafíos |
| `src/App.tsx` | Ruta `/desafios` |
| `src/lib/api.ts` | Helper para acciones de jugador autenticado |

