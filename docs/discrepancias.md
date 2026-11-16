# Discrepancias entre SPEC.md y el motor

Registro de lo que no cierra entre `SPEC.md` y la implementación de `src/motor/`.
Regla del proyecto: si el error está en el SPEC, **no se cambia el valor esperado del test**; se anota acá.

## 1. Tests que fallan por un valor esperado del SPEC

Los tres tienen la misma causa: la sección 7.0 fija una tolerancia de ±0.01, pero el valor esperado
está escrito con un solo decimal, así que el redondeo del propio SPEC se aparta más de 0.01 del
valor exacto. La fórmula y la implementación coinciden; lo que no cierra es la cifra escrita.

| ID | Caso | Regla | Dato | Valor del SPEC | Valor calculado | Diferencia | Por qué |
|---|---|---|---|---|---|---|---|
| D-01 | TC-08 | CM-08 | cabezas/ha de R1 en discordia | 27.1 | 190 / 7 = 27.1429 | 0.043 | Esperado redondeado a 1 decimal. Con 2 decimales sería 27.14. |
| D-02 | TC-40 | PC-04 | `disp_campo` | 1895.7 | 501400 / 264.5 = 1895.6522 | 0.048 | Esperado redondeado a 1 decimal. Con 2 decimales sería 1895.65. |
| D-03 | TC-43 | PC-10 | `dias_cubiertos` | 1010.9 | 25070 / 24.8 = 1010.8871 | 0.013 | Esperado redondeado a 1 decimal. Con 2 decimales sería 1010.89. |

El resto de cada caso pasa (los tests usan `expect.soft`, así que solo falla la cifra indicada).

Cómo cerrarlas (decisión del autor del SPEC, cualquiera de las dos):

- escribir esos tres valores con 2 decimales en la sección 7, o
- aclarar en 7.0 que la tolerancia es media unidad del último decimal escrito.

## 2. Interpretaciones (el test pasa, pero el SPEC admite otra lectura)

| ID | Regla / caso | Qué dice el SPEC | Qué se implementó |
|---|---|---|---|
| I-01 | PA-09, TC-26 | `pct_pastoreo = TPtot / dias_plan` (fracción), pero el caso lo escribe como "10.5 %" y "29.9 %". | La función devuelve la fracción (0.1046 y 0.2988) y el test compara contra 0.105 y 0.299. Comparado en puntos porcentuales (10.46 contra 10.5; 29.88 contra 29.9) quedaría fuera de ±0.01, por la misma causa que D-01 a D-03. |
| I-02 | PA-11 | "tasas que rigieron en algún día de ese intervalo", sin decir si los extremos cuentan. | Intervalo `[desde, hasta)`: un tramo que empieza el mismo día de la nueva entrada AM no cuenta. |
| I-03 | AL-07 | "TP calculado < 1", sin aclarar qué TP en plan cerrado. | En plan cerrado se usa `TPsel` (la estadía de cada selección). Los potreros con `DAT = 0` no emiten AL-07: ya llevan "sin pasto cargado". |
| I-04 | RG-04 | "Si el intervalo cae en un plan abierto". | Se exige el TR solo si el descanso completo (salida y nueva entrada) queda dentro de las fechas del plan. |
| I-05 | RG-06 | `pastoreado`: "ya recibió todas las selecciones planificadas". | Cantidad de movimientos reales cerrados en el potrero ≥ cantidad de períodos vigentes planificados para él. |
| I-06 | RG-06 | `bloqueado` "prevalece sobre los demás salvo `ocupado`". | También prevalece sobre `fuera_de_plan`. |
| I-07 | RG-01 | "próximo período planificado vigente sin registrar". | El primer período vigente (por fecha de entrada) que ningún movimiento tiene vinculado. Después de un movimiento no planificado, el próximo sigue siendo el mismo. |
| I-08 | CA-02 | No dice qué pasa con la vuelta mientras todos los potreros están bloqueados. | Se avanza medio día y se retoma en el mismo potrero y la misma vuelta. |
| I-09 | MO-06 | AL-10 si `|suma − 100| > 5`. | Una muestra sin filas válidas (suma 0) no emite AL-10: no entra en los cálculos (MO-04). |

## 3. Faltantes del SPEC (se implementó lo mínimo y se anota)

| ID | Regla | Qué falta | Qué se hizo |
|---|---|---|---|
| F-01 | CM-03 | No fija el algoritmo del área geodésica (esfera o elipsoide) ni trae caso de prueba. | Aproximación esférica con radio 6378137 m, la misma de Turf.js (tecnología sugerida en la sección 6). |
| F-02 | CM-04, CM-05 | No dice cuánto vale una categoría con `ev_unitario` vacío mientras el usuario no lo carga. | Cuenta como 0 EV; las cabezas se suman igual. |
| F-03 | CM-06 | No cubre una fecha anterior al primer mes con composición. | Devuelve 0 EV y 0 cabezas. |
| F-04 | CA-06 | El paso 3 ("desde el potrero siguiente al último ocupado") no dice en qué selección sigue un plan cerrado. | Sigue en la selección del último período conservado; si ese potrero era el último de la secuencia, pasa a la selección siguiente. |
| F-05 | CA-05 | No dice si, tras una edición manual, el final del calendario se vuelve a recortar en `fin`. | Solo se encadenan los períodos posteriores; no se recorta. "Regenerar" se resuelve con CA-06 (la confirmación es de interfaz). |
| F-06 | CA-02, CA-03 | No contempla un TP redondeado de 0 (por ejemplo, un TP manual 0). | El potrero se saltea sin crear período y sin alerta. |
| F-07 | 5.3 PeriodoRecuperacion | `estado` no tiene valor para un descanso cerrado fuera de un plan abierto (`tr_exigido` nulo). | Se informa `cumple` (no hay TR que incumplir). |
| F-08 | AL-01 a AL-10 | Los textos guía no fijan el formato de números ni de fechas. | Punto decimal y fechas ISO, como el documento. Cada alerta lleva además `datos` para que la interfaz arme el texto en es-AR. |
| F-09 | PA-06 | El SPEC valida `TRmin ≤ TRmax` y `n ≥ 2`, pero no el caso en que un solo potrero concentra toda la calidad (`n − f_max = 0`). | Error de validación. |

## 4. Fuera del motor (no implementado a propósito)

Reglas o partes de reglas que son de persistencia o de interfaz, no de cálculo:

- CM-03: guardar la copia de `sup` en el plan al incluir el potrero.
- MO-02: crear la especie en el catálogo al guardar la muestra (el motor solo normaliza y busca).
- CA-05: pedir confirmación al regenerar.
- MP-01: mostrar solo el nombre cuando la etiqueta no entra por el zoom.
- Validaciones de formularios de la sección 3 (nombres únicos, mínimo de vértices, rangos de calidad).
