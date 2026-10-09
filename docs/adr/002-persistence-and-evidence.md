# ADR 002: Persistencia y evidencias

Estado: Aceptada  
Fecha: 2026-08-17

## Decisión

- Usar SQLite mediante el plugin SQL oficial de Tauri.
- Mantener migraciones SQL versionadas, registradas desde Rust y ejecutadas transaccionalmente.
- Guardar la base en el directorio de configuración administrado por Tauri.
- Guardar imágenes en `AppLocalData/evidence/<task-id>/` y persistir sólo rutas relativas y metadatos.
- Seleccionar archivos con el plugin Dialog y copiarlos con File System usando permisos limitados.
- Admitir PNG, JPEG y WebP de hasta 10 MB; no admitir SVG en el MVP.
- Usar UUID generados por Angular y parámetros SQL para todos los valores.

## Modelo inicial

- `projects`: identidad, nombre, color, archivo y timestamps.
- `tasks`: contenido, proyecto, prioridad, estado, fecha civil, orden, tiempos y timestamps.
- `task_rollovers`: tarea, fecha origen/destino, posición aplicada y timestamp.
- `evidence`: tarea, ruta relativa, nombre, MIME, tamaño y timestamp.
- `app_settings`: clave y valor JSON para preferencias pequeñas.

## Integridad

- Foreign keys activas y borrado en cascada para relaciones propiedad de una tarea.
- Índices por estado/fecha/orden, proyecto y fecha de finalización.
- Un rollover por tarea y fecha destino.
- `CHECK` para estados, prioridad, minutos no negativos y títulos no vacíos.

## Consecuencias

- Las estadísticas se resuelven con consultas agregadas sin cargar todo el historial.
- La base no crece con blobs y las evidencias sobreviven al movimiento del archivo original.
- El borrado de evidencia requiere coordinar archivo y fila; un proceso de reconciliación podrá limpiar huérfanos.

## Alternativas descartadas

- **JSON/localStorage:** sencillo al inicio, frágil para concurrencia, historial, filtros y migraciones.
- **Tauri Store:** apropiado para preferencias, no para relaciones ni analítica.
- **BLOB en SQLite:** transacciones simples, pero backups y crecimiento de la base empeoran con imágenes.
