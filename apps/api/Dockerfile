# Imagen de la API de tareas (NestJS) para DigitalOcean App Platform.
#
# Se construye desde la RAÍZ del monorepo (el contexto es el repo entero), porque la API depende
# del workspace `@yorga/contracts`. En App Platform: source_dir "/" y dockerfile_path apuntando aquí.
#
# Arranca con ts-node (el mismo comando que en local), igual que el resto de apps del grupo.
FROM node:22-bookworm-slim

# openssl → lo necesita el motor de Prisma; sin él, `migrate deploy` falla al arrancar.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Se copia todo el monorepo: `npm ci` en la raíz necesita el package.json de todos los workspaces.
COPY . .

# Instala dependencias (incluidas las de desarrollo: ts-node y el CLI de prisma hacen falta en runtime).
RUN npm ci

# Genera el cliente Prisma (contra el schema versionado).
RUN npm run db:generate

ENV NODE_ENV=production
# App Platform inyecta el puerto en $PORT; la API ya lee process.env.PORT (por defecto 3000).
EXPOSE 3000

# `migrate deploy` es idempotente: seguro en cada arranque (1 instancia).
CMD ["sh", "-c", "npm run db:migrate && npm run serve -w @yorga/tareas-api"]
