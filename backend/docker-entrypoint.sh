#!/bin/sh
set -e

# Aplica migraciones pendientes antes de arrancar. Falla rápido si la DB
# no está disponible en vez de dejar el pod en CrashLoop silencioso.
npx prisma migrate deploy

exec "$@"
