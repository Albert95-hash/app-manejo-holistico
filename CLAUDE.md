# HOLOS

App de manejo holístico del pastoreo y monitoreo ambiental (método Savory). Hoy el repo contiene
solo el **motor de cálculo**: funciones puras en TypeScript, sin interfaz ni base de datos.

## Fuente de verdad

`SPEC.md` manda. Las reglas están en su sección 4, el modelo de datos en la 5 y los casos de
prueba en la 7.

- No inventar reglas que no estén en el SPEC. Si falta algo, anotarlo en `docs/discrepancias.md`.
- Si un test falla, revisar primero la implementación. Si el error está en el SPEC (número
  esperado mal calculado o regla contradictoria), **no cambiar el valor esperado**: anotarlo en
  `docs/discrepancias.md` con ID, valor del SPEC, valor calculado y por qué.

## Comandos

- `npm test` — corre todos los tests (Vitest).
- `npm run test:watch` — tests en modo observación.
- `npm run typecheck` — TypeScript estricto, sin emitir.
- `npm run build` — typecheck + build de Vite.

Hoy `npm test` termina con 3 fallas conocidas (TC-08, TC-40, TC-43), explicadas en
`docs/discrepancias.md`. Cualquier otra falla es una regresión.

## Estructura

- `src/motor/` — un archivo por grupo de reglas: `comunes` (CM), `planAbierto` (PA),
  `planCerrado` (PC), `calendario` (CA), `registro` (RG), `monitoreo` (MO), `mapa` (MP),
  `alertas` (AL), más `tipos.ts` (modelo de datos, SPEC 5) e `index.ts`.
- `tests/` — un test por caso de la sección 7 (`TC-xx` en el nombre), con los datos de 7.1 en
  `tests/datos.ts`. `tests/reglasSinCaso.test.ts` cubre reglas que la sección 7 no prueba.
- `docs/discrepancias.md` — diferencias, interpretaciones y faltantes respecto del SPEC.

## Convenciones

- Cada función del motor lleva un comentario que cita el ID de su regla (`CM-09`, `PA-05`,
  `AL-03`…). Cada test cita su `TC-xx` y las reglas que cubre.
- El motor es puro: sin fecha actual implícita (`ahora` se pasa como parámetro), sin UUID, sin
  acceso a disco ni red.
- Cálculos con precisión completa; solo se redondea donde una regla lo indica. Comparaciones con
  `EPS = 1e-9`.
- Fechas ISO `YYYY-MM-DD`; un instante es `{ fecha, turno }` con turno `AM` o `PM`.
- Código, nombres y comentarios en español; números con punto decimal (la coma es de la interfaz).
- Tolerancia de los tests: ±0.01 en valores con decimales (helper `cerca`); exacta en enteros,
  fechas y TP redondeados.
