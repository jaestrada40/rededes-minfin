# --- Etapa 1: dependencias + build ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# --- Etapa 2: runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# OpenShift ejecuta el contenedor con un UID arbitrario perteneciente al grupo
# root (GID 0). `npm ci` como root ya deja node_modules con permisos 644/755
# (legibles/ejecutables por cualquiera), así que solo hace falta ajustar el
# grupo de lo que SÍ construimos nosotros (dist/ y el entrypoint) — recorrer
# node_modules completo (decenas de miles de archivos) es lo que hacía tardar
# este paso ~20 minutos sin necesidad real.
RUN chgrp -R 0 /app/dist /usr/local/bin/docker-entrypoint.sh && \
    chmod -R g=u /app/dist && \
    chmod g+x /usr/local/bin/docker-entrypoint.sh

USER 1001
EXPOSE 4000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/src/main"]
