# --- Etapa 1: build ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite incrusta las variables VITE_* en el bundle en tiempo de build, no en
# runtime — hay que pasar la URL real del backend al construir la imagen.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# --- Etapa 2: runtime (nginx no-root, compatible con SCC restricted de OpenShift) ---
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
