// Mapa (SPEC 4.8): MP-01.

import { EPS } from './comunes'
import { AVISO_SIN_PASTO } from './planCerrado'
import type { TasaCrecimiento } from './tipos'

/** Situación del potrero en el plan elegido en el mapa. */
export type SituacionPotrero =
  /** Incluido en un plan abierto: TP redondeados (PA-06, CM-09) y tasa vigente (PA-10). */
  | { tipo: 'abierto'; tp_min: number; tp_max: number; tasa?: TasaCrecimiento }
  /** Incluido en un plan cerrado: DAT, TPsel redondeado (PC-06, CM-09) y selecciones. */
  | { tipo: 'cerrado'; dat: number; tp_sel: number; selecciones: number }
  /** No incluido en el plan, o no hay plan elegido. */
  | null

export interface EtiquetaPotrero {
  /** Etiqueta completa: partes unidas con " · ". */
  texto: string
  nombre: string
  superficie: string
  /** Null si la etiqueta no lleva parte de días. */
  dias: string | null
  /** Valor de la parte de días que se resalta (plan abierto, según la tasa vigente). */
  resaltado: 'min' | 'max' | null
  /** Texto del valor resaltado, por ejemplo "16". */
  valor_resaltado: string | null
}

/** MP-01 — Los días se escriben sin decimales salvo el medio día. */
export function formatearDias(dias: number, separadorDecimal = '.'): string {
  return String(dias).replace('.', separadorDecimal)
}

/**
 * MP-01 — Etiqueta del potrero: nombre, superficie (2 decimales, "ha") y días según el plan
 * elegido, separados por " · ". `separadorDecimal` permite a la interfaz usar coma.
 */
export function etiquetaPotrero(
  nombre: string,
  superficieHa: number,
  situacion: SituacionPotrero,
  separadorDecimal = '.',
): EtiquetaPotrero {
  const superficie = `${superficieHa.toFixed(2).replace('.', separadorDecimal)} ha`
  let dias: string | null = null
  let resaltado: 'min' | 'max' | null = null
  let valor_resaltado: string | null = null

  if (situacion?.tipo === 'abierto') {
    const min = formatearDias(situacion.tp_min, separadorDecimal)
    const max = formatearDias(situacion.tp_max, separadorDecimal)
    dias = Math.abs(situacion.tp_min - situacion.tp_max) <= EPS ? `${min} d` : `${min}–${max} d`
    resaltado = (situacion.tasa ?? 'rapida') === 'rapida' ? 'min' : 'max'
    valor_resaltado = resaltado === 'min' ? min : max
  } else if (situacion?.tipo === 'cerrado') {
    if (situacion.dat <= EPS) dias = AVISO_SIN_PASTO
    else {
      const tp = formatearDias(situacion.tp_sel, separadorDecimal)
      dias = situacion.selecciones > 1 ? `${tp} d × ${situacion.selecciones}` : `${tp} d`
    }
  }

  return {
    texto: [nombre, superficie, ...(dias === null ? [] : [dias])].join(' · '),
    nombre,
    superficie,
    dias,
    resaltado,
    valor_resaltado,
  }
}
