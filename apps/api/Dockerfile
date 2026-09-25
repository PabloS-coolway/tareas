# Imagen de la API de tareas (NestJS) para DigitalOcean App Platform.
#
# Se construye desde la RAÍZ del monorepo (el contexto es el repo entero), porque la API depende
# del workspace `@yorga/contracts`. En App Platform: source_dir "/" y dockerfile_path apuntando aquí.
#
# Compila a JavaScript y arranca con `node` (NO ts-node): en la instancia pequeña (512 MB) ts-node
# se comía la memoria y el contenedor moría en el import de ClickUp.
FROM node:22-bookworm-slim

# openssl → lo necesita el motor de Prisma; sin él, `migrate deploy` falla al arrancar.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Se copia todo el monorepo: `npm ci` en la raíz necesita el package.json de todos los workspaces.
COPY . .

# Instala dependencias (las de desarrollo hacen falta para compilar y para el CLI de prisma en runtime).
RUN npm ci

# Genera el cliente Prisma (contra el schema versionado) y compila contracts + API.
RUN npm run db:generate \
  && npm run build -w @yorga/contracts \
  && npm run build -w @yorga/tareas-mcp \
  && npm run build -w @yorga/tareas-api \
  # En runtime `@yorga/contracts` se resuelve por node_modules → que apunte al JS compilado (sólo en la imagen).
  && npm pkg set main=dist/index.js types=dist/index.d.ts -w @yorga/contracts

ENV NODE_ENV=production
# App Platform inyecta el puerto en $PORT; la API ya lee process.env.PORT (por defecto 3000).
EXPOSE 3000

# Migra (idempotente, 1 instancia) y arranca. Si la BD no tiene conexiones libres —el contenedor viejo las
# ocupa durante el despliegue— arranca igual y reintenta la migración en segundo plano: ver el script.
CMD ["sh", "apps/api/scripts/arrancar.sh"]
