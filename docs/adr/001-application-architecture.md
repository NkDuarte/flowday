# ADR 001: Arquitectura de aplicación

Estado: Aceptada  
Fecha: 2026-08-17

## Contexto

Flowday necesita UI Angular, persistencia local y capacidades desktop, pero no necesita backend remoto ni una capa Rust extensa para su MVP.

## Decisión

- Mantener Angular standalone como aplicación y usar rutas lazy por feature.
- Usar signals para estado local y stores de feature; no introducir NgRx.
- Separar `domain`, `core`, `features` y `shared` sin replicar una arquitectura empresarial.
- Definir puertos TypeScript para tareas, proyectos, evidencias y ventana.
- Implementar esos puertos con adaptadores Tauri/SQLite; los componentes no importan APIs nativas ni SQL.
- Mantener en Rust sólo bootstrap, plugins, migraciones y lifecycle nativo.
- Usar servicios de dominio puros para rollover, fechas y cálculos estadísticos.

## Flujo

`UI -> feature store/use case -> domain port -> Tauri adapter -> plugin/native resource`

## Consecuencias

- El dominio se prueba sin WebView ni Rust.
- Las integraciones futuras pueden añadir otro adaptador sin reescribir componentes.
- El plugin SQL expone acceso a la base al frontend; se mitiga centralizando SQL, parametrizando valores y limitando capabilities.
- No se añade una capa de comandos Rust por cada operación CRUD mientras no aporte una regla o límite de seguridad real.

## Alternativas descartadas

- **NgRx:** coste conceptual y boilerplate desproporcionados para estado local de una sola persona.
- **Repositorio completo en Rust:** frontera más fuerte, pero duplica DTO, errores y comandos sin necesidad actual.
- **LocalStorage como base:** no ofrece consultas, integridad ni migraciones adecuadas para historial y métricas.
