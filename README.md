# Gestor Centralizado de Redes Sociales — MINFIN

Aplicación para administrar publicaciones institucionales, organizarlas en feeds y distribuirlas en portales WordPress mediante un plugin.

## Componentes

- `frontend/`: panel administrativo en React.
- `backend/`: API NestJS, Prisma y PostgreSQL.
- `wordpress-plugin/minfin-social-feed/`: plugin para insertar feeds con shortcodes.
- `docker-compose.yml`: PostgreSQL y WordPress para desarrollo local.

## Requisitos

- Node.js 20 o superior.
- Docker Desktop y Docker Compose.
- Un archivo `.env` en la raíz, sin subirlo al repositorio.

Ejemplo de variables necesarias en `.env`:

```dotenv
POSTGRES_PASSWORD=use-una-clave-larga-y-unica
MYSQL_ROOT_PASSWORD=use-una-clave-larga-y-unica
MYSQL_PASSWORD=use-una-clave-larga-y-unica
```

El backend utiliza su propio `backend/.env` para `DATABASE_URL`, secretos JWT y demás configuración privada. Parta de `backend/.env.example` y no publique secretos.

## Inicio local

```bash
docker compose up -d

cd backend
npm install
npx prisma migrate deploy
npm run start:dev
```

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Servicios locales:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`
- WordPress: `http://localhost:8080`
- PostgreSQL: `127.0.0.1:5433`

Las bases de datos y WordPress se exponen únicamente en `localhost`; para producción deben permanecer detrás de HTTPS y un proxy inverso.

## WordPress

El plugin `minfin-social-feed` se monta automáticamente en WordPress al usar Docker. Actívelo desde **Plugins** y configure la URL pública de la API. Para insertar un feed:

```text
[minfin_social_feed slug="nombre-del-feed"]
```

Las publicaciones de X se muestran mediante el embed oficial para preservar texto, enlaces, multimedia y formato de la plataforma. El plugin agrega además un botón **Ver publicación en X** que abre el post institucional exacto.

## MFA y administración de usuarios

MFA se configura por usuario con TOTP. Cuando el requisito global está activo, los usuarios sin MFA deben configurarlo en su siguiente inicio de sesión.

Un **superadministrador** puede restablecer el MFA de un usuario desde **Usuarios** con el botón de escudo ámbar, o mediante `PATCH /users/:id/reset-mfa`. El restablecimiento elimina la configuración TOTP, revoca sesiones activas y obliga al usuario a registrar un nuevo código al volver a iniciar sesión si MFA es obligatorio.

Los administradores normales no pueden modificar cuentas de superadministrador.

## Verificación

```bash
cd backend
npm run build
npm test -- --runInBand
npm audit

docker exec gestor-centralizado-de-redes-sociales---minfin-wordpress-1 \
  php -l /var/www/html/wp-content/plugins/minfin-social-feed/minfin-social-feed.php
```

## Seguridad

- Tokens de actualización en cookies `HttpOnly` y sesiones revocables.
- Protección contra fuerza bruta con límites por cuenta e IP.
- Validación de roles, estado de cuenta y MFA en cada sesión.
- Auditoría de acciones administrativas y restablecimientos MFA.
- Peticiones del plugin limitadas a API HTTPS pública, con excepción local controlada para desarrollo.
