# Despliegue en OpenShift

## 1. Pull secret del registro (una sola vez por namespace)

Los Deployments usan `imagePullSecrets: srv-osnexus01.minfin.gob.gt` para que
OpenShift pueda descargar de un registro privado. Si el namespace no lo tiene
ya (p. ej. reutilizado de otro proyecto), crearlo con:

```bash
oc create secret docker-registry srv-osnexus01.minfin.gob.gt \
  --docker-server=srv-osnexus01.minfin.gob.gt:8006 \
  --docker-username=desadti --docker-password='Desadti..'
```

## 2. Build y push de imágenes a OSNexus

Desde cada carpeta hay un `.bat` (`backend/MakeImageBackend.bat`,
`frontend/MakeImageFrontend.bat`) que hace login + build + tag + push con los
nombres que ya coinciden con los `image:` de los Deployments. Ninguno de los
dos `.bat` va a git (`.gitignore` los excluye) — quedan solo en tu máquina.

El frontend **no** necesita `--build-arg VITE_API_URL`: `nginx.conf` hace
`proxy_pass` de `/auth`, `/users`, `/audit`, `/settings`, `/feeds`, `/posts`,
`/portals`, `/public` al Service interno `minfin-backend:4000`, así que el
bundle usa rutas relativas y una sola imagen sirve para cualquier
namespace/cluster (a diferencia del backend, que no cambia entre entornos).

```bash
backend/MakeImageBackend.bat
frontend/MakeImageFrontend.bat
```

Reemplazar `srv-osnexus01.minfin.gob.gt:8006` por el host real del registro OSNexus, y las
etiquetas `<namespace>`/`<cluster-domain>` en los manifiestos (rutas, configmap) por los
valores reales del proyecto de OpenShift.

## 3. PostgreSQL dentro del cluster

`00-postgresql.yaml` levanta Postgres en el mismo namespace (PVC + Deployment
+ Service + Secret), igual que en `enlaces-minfin-backend/openshift/postgresql.yaml`.
Si en cambio vas a usar un Postgres gestionado externo, no apliques este
archivo y apunta `DATABASE_URL` (paso 4) a ese host en su lugar.

```bash
# Editar el password real en 00-postgresql.yaml antes de aplicar.
oc apply -f openshift/00-postgresql.yaml
```

## 4. Secretos y config del backend (deben existir antes del Deployment)

```bash
# Completar JWT_ACCESS_SECRET, MFA_ENCRYPTION_KEY, DATABASE_URL, etc. en
# 01-backend-secret.yaml antes de aplicar.
oc apply -f openshift/01-backend-secret.yaml
oc apply -f openshift/02-backend-configmap.yaml
```

Generar secretos únicos por despliegue, no reutilizar los de desarrollo local:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_ACCESS_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # MFA_ENCRYPTION_KEY
```

Si usas `00-postgresql.yaml`, `DATABASE_URL` debe apuntar al Service interno
`postgresql:5432` con el mismo usuario/password que `postgresql-secret`.

El Deployment del backend referencia el Secret y el ConfigMap vía `envFrom` —
si se crea antes que ellos, el pod queda en `CreateContainerConfigError` hasta
que existan (no falla feo, pero conviene aplicar en este orden).

## 5. Backend, luego frontend

El backend necesita que Postgres ya esté arriba (corre `prisma migrate
deploy` al iniciar) y el frontend depende en runtime del Service
`minfin-backend` (nginx le hace `proxy_pass`), así que el orden real es
Postgres → backend → frontend:

```bash
oc apply -f openshift/03-backend-deployment.yaml
oc apply -f openshift/04-backend-service.yaml
oc apply -f openshift/05-backend-route.yaml

oc apply -f openshift/06-frontend-deployment.yaml
oc apply -f openshift/07-frontend-service.yaml
oc apply -f openshift/08-frontend-route.yaml
```

## 6. Migraciones

El backend corre `npx prisma migrate deploy` automáticamente al arrancar
(ver `backend/docker-entrypoint.sh`) antes de levantar la app — no hace falta
correrlas a mano, pero si la DB no está lista el pod fallará rápido en vez de
quedar en un estado inconsistente.

## Notas

- Las imágenes corren como usuario no-root con permisos de grupo `root`
  (compatibles con la SCC `restricted` por defecto de OpenShift) — no hace
  falta `anyuid` ni SCC especiales.
- El seed (`prisma/seed.ts`, usuario `super_admin`) **no** corre
  automáticamente en el contenedor — ejecutarlo una sola vez manualmente
  contra la DB de producción (`oc rsh` a un pod del backend + `npx prisma db
  seed`, con `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` ya en el Secret).
