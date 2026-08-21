# Sub-proyecto 3: Integración del Frontend con la API Real — Diseño

Fecha: 2026-08-20
Proyecto: Gestor Centralizado de Redes Sociales — MINFIN

## Contexto

Sub-proyectos 1 (auth/RBAC/audit) y 2 (feeds/posts/portales/settings) están completos y
mergeados en `/backend`. El frontend en `/frontend` sigue funcionando 100% en memoria:
`frontend/src/context/AppContext.tsx` simula todo (login sin verificar contraseña, MFA que
acepta cualquier código de 6 dígitos, CRUD de feeds/posts/portales persistido en
`localStorage`) y arranca ya autenticado (`isAuthenticated`/`isMfaVerified` en `true` por
defecto). No existe cliente HTTP, ni `VITE_API_URL`, ni manejo de tokens — investigación previa
confirmó cero llamadas `fetch`/`axios` en todo `frontend/src`.

Este es el sub-proyecto 3 de 5:
1. Base del backend (completo)
2. API de Feeds y Portales (completo)
3. **Integración del frontend con la API real** (este documento)
4. Plugin de WordPress
5. Docker Compose + env + README + pruebas de integración

## Alcance de este sub-proyecto

- Cliente HTTP con manejo de JWT (access token en memoria, refresh token persistido) y
  renovación automática en 401.
- Reescritura de `AppContext.tsx` para que cada acción llame al backend real en vez de mutar
  estado local — **manteniendo `AppContextType` con la misma forma que hoy** (mismos nombres de
  campos/funciones) para minimizar cambios en los 13 componentes consumidores ya identificados.
- Pantalla de autenticación real: login con contraseña verificada por el backend, flujo de
  configuración MFA (QR) en el primer login, flujo de verificación MFA en logins subsecuentes.
  Se elimina la UI de demostración (auto-completar código MFA, "Simular Rol Institucional").
- Backend: pequeña extensión de alcance — `PortalsController` (sub-proyecto 2) no expone
  creación de portales (correcto: la gestión real de portales es el plugin WordPress,
  sub-proyecto 4). Para que la app sea usable hoy, el seed del backend siembra los 25 portales
  de `frontend/src/data/initialData.ts` como datos iniciales, igual que ya siembra roles/admin.
- Variables de entorno: `frontend/.env.example` gana `VITE_API_URL`; `backend/.env.example` ya
  tiene `CORS_ORIGIN` (sub-proyecto 1) — se documenta apuntándolo a `http://localhost:3000`.

Fuera de alcance: plugin WordPress real (sub-proyecto 4), CRUD de portales desde el frontend
(no hay endpoint — gestión de portales vive en el plugin WordPress), scraping real de redes
sociales (el backend ya genera contenido de muestra igual que el mock, ver spec sub-proyecto 2),
`docker-compose.yml` completo (sub-proyecto 5).

## Decisiones de diseño

**Contrato de `AppContextType` sin cambios de forma.** Los 13 componentes que consumen
`useApp()` siguen leyendo `feeds`, `posts`, `portals`, `auditLogs`, `settings`, `user`, y
llamando `createFeed`, `updateFeed`, `addPost`, etc. con las mismas firmas. Donde el backend
devuelve un tipo ligeramente distinto (p. ej. `Feed` del backend incluye `posts`/`portals` como
relaciones anidadas en `GET /feeds/:id` en vez de `postIds`/`assignedPortalIds`), el contexto
adapta la respuesta a la forma que el frontend ya espera (deriva `postIds` con
`.posts.map(p => p.postId)`, ordenados por el campo `order` del backend).

**Tokens: access en memoria, refresh en `localStorage`.** El backend no usa cookies; devuelve
`{ accessToken, refreshToken }` en el cuerpo JSON. El access token (vida corta, 15 min) vive
solo en un `useRef`/estado de React — nunca en `localStorage`, para reducir superficie XSS. El
refresh token (vida larga, 7 días, ya hasheado y con rotación en el backend) se guarda en
`localStorage` bajo `minfin_refresh_token` para sobrevivir recargas de página; al montar la app,
si existe, se intenta `POST /auth/refresh` silenciosamente para restaurar sesión sin pedir login
de nuevo. Si el refresh falla (expirado/revocado), se limpia y se muestra la pantalla de login.

**Cliente HTTP centralizado con reintento en 401.** `frontend/src/api/client.ts` expone un
`apiFetch(path, options)` que añade `Authorization: Bearer <accessToken>`, y si la respuesta es
401, intenta una única renovación vía `POST /auth/refresh` y reintenta la petición original una
vez; si el refresh también falla, dispara `logout()` (limpia estado, refresh token, muestra
login). Nunca reintenta más de una vez (evita bucles).

**Sin proxy de Vite; `VITE_API_URL` directo.** El backend (sub-proyecto 1) ya exige
`CORS_ORIGIN` configurado y falla al arrancar si falta — no hay wide-open CORS por defecto. El
frontend llama directamente a `${VITE_API_URL}` (default `http://localhost:4000`) con
`credentials: 'include'` no es necesario (no hay cookies), pero si se usa se documenta que no
aplica aquí.

**Auditoría: ya no la dispara el frontend.** Hoy `logAudit()` es una función expuesta en el
contexto que cada handler de UI llama manualmente. En el backend real, cada servicio ya llama
`AuditService.log(...)` internamente en cada mutación (sub-proyectos 1 y 2) — el frontend no
necesita (ni debe) duplicar esa llamada. `logAudit` se elimina de `AppContextType`; los 0
componentes que la llamaban directamente (confirmado en la investigación: solo el propio
`AppContext.tsx` la invocaba internamente) no requieren cambios adicionales por esto.
`auditLogs` sigue siendo un campo de solo lectura, poblado por `GET /audit` (rol `admin`/
`auditor` — componentes que no tengan ese rol reciben 403 y `AuditView.tsx` debe manejarlo
mostrando un estado vacío/mensaje, no un error sin manejar).

**`switchRole` se elimina.** Era una función de demostración que cambiaba el rol de la sesión
sin backend real. Con auth real, el rol viene fijo del JWT tras el login; cambiarlo requiere que
un `admin` edite el usuario vía `PATCH /users/:id/role` (fuera del flujo de sesión). Se retira de
`AppContextType`, del `Header.tsx` y de `AuthScreen.tsx`.

**Refresco de datos: fetch al montar + refetch tras mutar.** Sin WebSockets ni polling en este
sub-proyecto (no está en el alcance de los 5 sub-proyectos). Cada slice de datos (`feeds`,
`posts` derivados, `portals`, `settings`, `auditLogs`) se carga con `GET` al montar el
`AppProvider` (tras autenticación exitosa) y cada mutación exitosa vuelve a pedir la lista
afectada (o actualiza el estado local con la respuesta del backend cuando esta ya trae la
entidad completa — p. ej. `POST /feeds` devuelve el `Feed` creado, se antepone a la lista sin
refetch).

**Seed de portales (extensión de sub-proyecto 2).** `backend/prisma/seed.ts` gana un bloque que
siembra los 25 `WordPressPortal` de `frontend/src/data/initialData.ts` (mismos campos: name,
domain, category, connectionStatus, ipAddress, wpVersion, pluginVersion, tokenValid,
webhookEnabled, description), usando `upsert` por `domain` (campo `@unique`) para ser
idempotente. Sin esto la app no tendría portales que mostrar ni asignar, ya que no existe
`POST /portals` (correcto por diseño: los portales los registra el plugin WordPress en
sub-proyecto 4).

## Estructura de archivos nuevos/modificados

```
frontend/
  .env.example                        # + VITE_API_URL
  src/
    api/
      client.ts                       # apiFetch con auth header + retry en 401
      auth.ts                         # login/mfaSetup/mfaSetupVerify/mfaVerify/refresh/logout
      feeds.ts                        # CRUD feeds + posts anidados
      portals.ts                      # findAll/assign/syncAll/testConnection
      settings.ts                     # get/update
      audit.ts                        # findAll
    context/
      AppContext.tsx                  # reescrito: llama a src/api/*, misma forma de contexto
    components/
      AuthScreen.tsx                  # reescrito: login real + setup/verify MFA, sin demo UI
      Header.tsx                      # quita botón de "Simular Rol"
backend/
  prisma/
    seed.ts                           # + siembra de 25 WordPressPortal
```

## Flujo de autenticación en la UI

1. Al montar `AppProvider`: si hay `minfin_refresh_token` en `localStorage`, intenta
   `POST /auth/refresh`; éxito → `isAuthenticated=true`, `isMfaVerified=true`, guarda nuevo
   access token en memoria, cae directo al dashboard. Fallo → limpia, muestra `AuthScreen`.
2. `AuthScreen`, paso "login": el usuario ingresa email + contraseña → `POST /auth/login`.
   - Si `requiresMfaSetup`: pasa a paso "mfa-setup", pide `POST /auth/mfa/setup` con el
     `setupToken`, muestra el QR (`qrDataUrl`) y un campo para el código TOTP inicial de 6
     dígitos → al enviar, `POST /auth/mfa/setup/verify`; éxito emite tokens, autentica.
   - Si `requiresMfaCode`: pasa a paso "mfa-verify", pide el código TOTP →
     `POST /auth/mfa/verify` con el `challengeToken`; éxito emite tokens, autentica.
   - Credenciales inválidas: el backend responde 401 con mensaje genérico; se muestra tal cual,
     sin revelar si el email existe (ya garantizado por el backend, sub-proyecto 1).
3. Tras autenticar: `AppProvider` guarda el access token en memoria, el refresh token en
   `localStorage`, decodifica el JWT (o usa la respuesta) para poblar `user` (nombre/email/rol
   vienen de `GET /users` filtrando por el propio id, ya que el JWT solo trae `sub`/`email`/
   `role` — se resuelve `name`/`department`/`mfaEnabled`/`lastLogin` con una llamada a
   `GET /users` tras login), y dispara la carga inicial de `feeds`/`portals`/`settings`/
   `auditLogs` (este último solo si el rol es `admin`/`auditor`, si no se deja vacío sin
   llamar al endpoint para evitar un 403 esperado en consola).
4. `logout()`: `POST /auth/logout` con el refresh token actual, limpia memoria y
   `localStorage`, vuelve a `AuthScreen`.

## Testing

Sin infraestructura de test de frontend existente en el repo (no hay Vitest/Jest/RTL
configurado) — fuera de alcance añadir un framework de test de frontend en este sub-proyecto.
Verificación manual: levantar Postgres + backend (`npm run start:dev`) + frontend
(`npm run dev`), ejecutar el flujo login → setup MFA → dashboard con datos reales → crear un
feed → agregar una publicación → asignarlo a un portal → ver auditoría, confirmando en cada
paso que los datos persisten en Postgres (sobreviven un refresh de página).

## Fuera de alcance (se aborda en sub-proyectos posteriores)

- Plugin de WordPress real y CRUD de portales desde el frontend (sub-proyecto 4).
- `docker-compose.yml` completo con servicios `backend`/`frontend` y README final
  (sub-proyecto 5).
- Framework de pruebas automatizadas de frontend (no estaba en el alcance original de ningún
  sub-proyecto del plan de 5 partes).
