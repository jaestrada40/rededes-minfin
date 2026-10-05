# Gestor Centralizado de Redes Sociales — MINFIN

Resumen técnico del sistema: qué hace, cómo está construido y con qué tecnologías. Última actualización: 5 de octubre de 2026.

## 1. Qué es

Aplicación institucional del Ministerio de Finanzas Públicas de Guatemala para centralizar la gestión de publicaciones de redes sociales oficiales y distribuirlas a los portales web (WordPress) del ministerio.

El flujo de negocio es:

1. Un administrador o editor **cura publicaciones** de redes sociales (X, Facebook, Instagram, YouTube, LinkedIn) de las cuentas oficiales del MINFIN.
2. Las agrupa en **Feeds** (colecciones ordenadas de publicaciones, cada una con un slug único).
3. Asigna cada Feed a uno o más **Portales WordPress** (sitios del ministerio).
4. Cada portal instala el **plugin de WordPress** del proyecto, que consulta la API pública del backend y renderiza el feed donde se coloque el shortcode `[minfin_social_feed feed="slug"]`.

Es un sistema de una sola institución (no multi-tenant): no hay aislamiento por departamento, todos los administradores y editores comparten el mismo conjunto de feeds y portales.

## 2. Componentes del repositorio

| Carpeta | Qué es |
|---|---|
| `backend/` | API REST (NestJS + Prisma + PostgreSQL) — fuente de verdad, autenticación, lógica de negocio |
| `frontend/` | Panel de administración SPA (React + Vite + Tailwind) |
| `wordpress-plugin/minfin-social-feed/` | Plugin PHP que los portales instalan para renderizar los feeds |
| `openshift/` | Manifiestos de despliegue (Deployment, Service, Route) para OpenShift |
| `docker-compose.yml` | PostgreSQL y WordPress para desarrollo local |
| `docs/superpowers/` | Specs y planes de diseño históricos del desarrollo |

## 3. Funcionalidades principales

### Gestión de contenido
- **Feeds**: crear, editar, duplicar, eliminar, reordenar publicaciones dentro de un feed.
- **Publicaciones**: agregar/quitar publicaciones de un feed, editar su contenido, eliminarlas permanentemente (solo admin/super_admin).
- **Vista previa embebida**: cómo se vería el feed antes de publicarlo, con la opción de guardar la configuración (layout, límite de ítems, métricas, media) como predeterminada del feed.
- **Portales**: registrar portales WordPress, probar su conectividad (resolviendo DNS y verificando que la IP no sea privada antes de conectar — protección anti-SSRF), sincronización masiva.

### Usuarios y seguridad
- **Tres roles**: `super_admin` (DTI — control total), `admin` (gestión operativa, no puede tocar cuentas de super_admin), `editor` (curaduría de contenido, sin gestión de usuarios/configuración).
- **Autenticación**: JWT de acceso (15 min) + refresh token rotativo (7 días, en cookie `HttpOnly`/`Secure`/`SameSite=Strict`), con detección de reutilización (si se reusa un refresh token ya rotado, se revoca toda la cadena de sesión).
- **MFA (TOTP)**: configuración obligatoria según política institucional; "step-up" (pedir el código de nuevo) en acciones sensibles ya autenticadas, como crear un feed o borrar una publicación permanentemente.
- **Gestión de usuarios**: alta, edición, cambio de rol, activar/desactivar cuenta, restablecer contraseña (por un admin), restablecer MFA.
- **Auditoría**: registro de todas las acciones administrativas sensibles (quién, qué, cuándo, resultado), visible solo para `super_admin`.

### Configuración institucional (`super_admin`)
- Dominios CORS permitidos para los portales.
- Lista de cuentas oficiales de redes sociales.
- Política de MFA obligatorio.
- Duración del caché del plugin.
- Secreto de webhook, claves de API de redes sociales (enmascaradas para roles no `super_admin`).
- Modo mantenimiento.

### Plugin de WordPress
- Shortcode `[minfin_social_feed feed="slug"]` con overrides opcionales (`layout`, `limit`, `metrics`, `media`).
- Botones flotantes configurables (uno por red social con publicaciones).
- Caché local (WordPress Transients, 60s por defecto) para no golpear la API en cada carga de página.
- Embeds oficiales de cada plataforma (widget de X/Twitter, Facebook Page Plugin, iframe de YouTube) para que el contenido se vea y comporte igual que en la red social original.
- Lista de "hosts internos permitidos" configurable para instalaciones donde el backend vive en una red privada (p. ej. `.local` de OpenShift), sin comprometer la protección anti-SSRF por defecto.

## 4. Tecnologías

### Backend (`backend/`)
- **NestJS 11** (Node.js, TypeScript) — framework de API.
- **Prisma 6** — ORM y migraciones, sobre **PostgreSQL 16**.
- **Passport + JWT** (`@nestjs/jwt`, `passport-jwt`) — autenticación.
- **bcrypt** — hash de contraseñas.
- **otplib** — TOTP para MFA.
- **AES-256-GCM** (Node `crypto` nativo) — cifrado en reposo de los secretos TOTP.
- **Helmet** — cabeceras de seguridad (CSP, HSTS, X-Frame-Options, etc.).
- **@nestjs/throttler** — límite de tasa (rate limiting) por IP.
- **class-validator / class-transformer** — validación de DTOs.
- **Jest** — tests unitarios y e2e.

### Frontend (`frontend/`)
- **React 19** + **TypeScript**.
- **Vite 6** — build y servidor de desarrollo.
- **Tailwind CSS** — estilos.
- **lucide-react** — iconografía.
- Consumo de API vía `fetch` con manejo propio de refresh de tokens (`src/api/client.ts`).

### Plugin (`wordpress-plugin/minfin-social-feed/`)
- **PHP** puro (sin dependencias de Composer), siguiendo las convenciones del API de plugins de WordPress (`wp_remote_get`, `register_setting`, shortcodes).

### Infraestructura
- **Docker / Docker Compose** — entorno local (PostgreSQL + WordPress).
- **OpenShift** — despliegue en contenedores en producción (namespace `portal-redes-minfin`), con `Route` HTTPS (TLS edge) para backend y frontend, `ConfigMap`/`Secret` para configuración, imágenes propias publicadas a un registro privado (OSNexus).
- **nginx** — sirve el build estático del frontend en producción y hace `proxy_pass` de las rutas de la API al Service interno del backend (una sola imagen de frontend sirve para cualquier entorno, sin variables de build por despliegue).

## 5. Postura de seguridad (estado actual)

Verificado mediante revisión de código y pruebas en vivo contra un entorno local (octubre 2026):

- Límite de intentos de login/MFA por cuenta e IP (5 intentos, bloqueo de 5 min), con contador compartido en base de datos.
- El rol del usuario se revalida en la base de datos en cada petición (no se confía en el rol embebido en el JWT).
- Rotación de refresh tokens con detección de reutilización y revocación en cadena.
- Protección anti-SSRF en la prueba de conexión con portales (bloqueo de IPs privadas, resolución DNS fijada a la IP validada para evitar DNS rebinding).
- CORS con lista blanca fija (sin reflejo del header `Origin`).
- CSRF: las acciones que cambian estado usan Bearer token en memoria (inmunes a CSRF por diseño); la cookie de refresh usa `SameSite=Strict`, verificado con una prueba real de sitio cruzado en navegador.
- Límite de tasa global (120 peticiones/minuto por IP) sobre toda la API, incluidos los endpoints públicos que antes no tenían ningún freno propio.
- El log de auditoría no es forjable por el cliente; todas las entradas usan la identidad del actor autenticado del lado del servidor.
- 0 vulnerabilidades conocidas en dependencias de backend y frontend (`npm audit`).

No se ha realizado una prueba de penetración contra el entorno de producción real; todas las verificaciones anteriores se hicieron contra una copia local.
