# ADR 003: Estrategia de ventana

Estado: Aceptada  
Fecha: 2026-08-17

## Decisión

- Usar una sola webview window `main` con modos `full` y `compact`.
- El modo compacto cambia tamaño, restricciones y always-on-top sobre la misma ventana.
- Persistir geometría independiente por modo y restaurarla dentro de los monitores disponibles.
- Interpretar minimizar como entrada a modo compacto.
- Interpretar cerrar mediante `X` como salida real de la aplicación.
- Usar el plugin oficial Single Instance para enfocar la ventana existente al intentar una segunda apertura.
- No incluir tray ni autostart en el MVP.

## Motivo

Una sola ventana conserva un único árbol Angular, un único store y una única conexión lógica de datos. Dos ventanas exigirían sincronización de estado y resolución de carreras sin ofrecer valor suficiente para validar el producto.

## Responsabilidades

- Angular decide qué layout renderizar y solicita cambios mediante `WindowPort`.
- Tauri aplica tamaño, posición, foco, visibilidad y always-on-top con permisos explícitos.
- Rust registra Single Instance y reacciona a una segunda apertura.

## Alternativa futura

Si el producto necesita que la vista completa y la flotante coexistan, se crearán labels `main` y `compact` y se sincronizarán mediante eventos invalidados por operaciones persistidas. Esa decisión requiere una ADR nueva.
