#!/bin/sh
# Arranque de la API en App Platform: migraciones y luego la API.
#
# Por qué no es un simple `migrate && node`: en un despliegue el contenedor viejo sigue vivo hasta que el
# nuevo pasa la comprobación de salud. Si el viejo tiene llenas las conexiones de la base de datos (la de
# desarrollo admite pocas), el nuevo no puede ni comprobar migraciones y muere; el viejo nunca se apaga y
# ningún despliegue —ni la vuelta atrás— entra. Pasó el 25-sep-2026.
#
# Así que: si la migración falla SOLO por falta de conexiones, se arranca igual y se reintenta en segundo
# plano (en cuanto el viejo se apaga, hay sitio). Cualquier otro fallo de migración para el arranque, como antes.

API="node apps/api/dist/apps/api/src/interface/http/main.js"
SIN_CONEXIONES="remaining connection slots|too many clients|Too many database connections"

migrar() {
  salida=$(npm run db:migrate 2>&1)
  rc=$?
  echo "$salida"
  [ $rc -eq 0 ] && return 0
  echo "$salida" | grep -Eq "$SIN_CONEXIONES" && return 2
  return 1
}

intento=1
while :; do
  migrar
  rc=$?
  [ $rc -eq 0 ] && break
  if [ $rc -eq 1 ]; then
    echo "[arranque] la migración falló (no por conexiones): no arranco"
    exit 1
  fi
  if [ $intento -ge 3 ]; then
    echo "[arranque] sin conexiones libres tras $intento intentos: arranco la API y reintento la migración en segundo plano"
    (
      n=0
      while [ $n -lt 40 ]; do
        sleep 15
        n=$((n + 1))
        migrar >/dev/null 2>&1
        r=$?
        if [ $r -eq 0 ]; then echo "[arranque] migración aplicada en segundo plano"; exit 0; fi
        if [ $r -eq 1 ]; then echo "[arranque] la migración en segundo plano falló (no por conexiones)"; exit 1; fi
      done
      echo "[arranque] la migración en segundo plano no encontró conexión en 10 min"
    ) &
    break
  fi
  intento=$((intento + 1))
  sleep 5
done

exec $API
