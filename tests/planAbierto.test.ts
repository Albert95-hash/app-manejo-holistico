// SPEC 7.3 — Plan abierto: TC-20 a TC-31.
import { describe, expect, it } from 'vitest'
import {
  ErrorValidacion,
  calcularPlanAbierto,
  diasEntre,
  generarCalendarioAbierto,
  recuperacionesReales,
  salidaPeriodo,
  type MovimientoCalculado,
  type ModoRecuperacion,
} from '../src/motor'
import { ABIERTO, cerca, potrerosA } from './datos'

const plan = (modo: ModoRecuperacion) =>
  calcularPlanAbierto({ potreros: potrerosA, tr_min: ABIERTO.tr_min, tr_max: ABIERTO.tr_max, modo, dias_plan: ABIERTO.dias })
const curso = plan('curso')
const garantizada = plan('garantizada')
const fila = (r: typeof curso, nombre: string) => {
  const f = r.filas.find((x) => x.nombre === nombre)
  if (!f) throw new Error(`no existe ${nombre}`)
  return f
}
const al = (r: typeof curso, id: string, nombre: string, caso: string) =>
  r.alertas.some((a) => a.id === id && a.potrero_id === nombre && a.datos.caso === caso)

const calendario = (tramos: { fecha_desde: string; tasa: 'rapida' | 'lenta' | 'nula' }[] = []) =>
  generarCalendarioAbierto({
    potreros: garantizada.filas,
    fecha_inicio: ABIERTO.inicio,
    fecha_fin: ABIERTO.fin,
    tramos,
  }).periodos

describe('7.3 Plan abierto', () => {
  it('TC-20 (PA-01 a PA-04) n, Σ CP, CPm, f_max', () => {
    expect(garantizada.n).toBe(12)
    cerca(garantizada.suma_cp, 730.18, 'Σ CP')
    cerca(garantizada.cpm, 60.8483, 'CPm')
    cerca(garantizada.f_max, 3.2869, 'f_max')
    expect(garantizada.filas.find((f) => f.f === garantizada.f_max)?.nombre).toBe('puesto palma')
  })

  it('TC-21 (PA-05) PP en modo curso y garantizada', () => {
    cerca(curso.pp_min, 5.4545, 'curso PP(60)')
    cerca(curso.pp_max, 10.9091, 'curso PP(120)')
    cerca(garantizada.pp_min, 6.8862, 'garantizada PP(60)')
    cerca(garantizada.pp_max, 13.7723, 'garantizada PP(120)')
  })

  it('TC-22 (PA-06, CM-09) TP por potrero, calculado → redondeado', () => {
    // nombre, CP, f, [curso TPmin], [curso TPmax], [garantizada TPmin], [garantizada TPmax]
    const tabla: [string, number, number, number[], number[], number[], number[]][] = [
      ['discordia', 70, 1.1504, [6.27, 7], [12.55, 13], [7.92, 8], [15.84, 16]],
      ['pitranto', 42, 0.6902, [3.76, 4], [7.53, 8], [4.75, 5], [9.51, 10]],
      ['chacrita', 63.5, 1.0436, [5.69, 6], [11.38, 12], [7.19, 8], [14.37, 15]],
      ['R.Ovejas 1', 54.8, 0.9006, [4.91, 5], [9.82, 10], [6.2, 7], [12.4, 13]],
      ['P. Mosquetas', 67.5, 1.1093, [6.05, 7], [12.1, 13], [7.64, 8], [15.28, 16]],
      ['P. Pasto (Tio)', 38.08, 0.6258, [3.41, 4], [6.83, 7], [4.31, 5], [8.62, 9]],
      ['P. Casa', 13.8, 0.2268, [1.24, 2], [2.47, 3], [1.56, 2], [3.12, 4]],
      ['P. Compañero', 4.5, 0.074, [0.4, 0.5], [0.81, 1], [0.51, 1], [1.02, 2]],
      ['P. Pasto (victor)', 29, 0.4766, [2.6, 3], [5.2, 6], [3.28, 4], [6.56, 7]],
      ['mallin', 105, 1.7256, [9.41, 10], [18.82, 19], [11.88, 12], [23.77, 24]],
      ['puesto palma', 200, 3.2869, [17.93, 18], [35.86, 36], [22.63, 23], [45.27, 46]],
      ['P. Mosquetas victor', 42, 0.6902, [3.76, 4], [7.53, 8], [4.75, 5], [9.51, 10]],
    ]
    expect(curso.filas.map((f) => f.nombre)).toEqual(tabla.map((t) => t[0]))
    for (const [nombre, cp, f, cMin, cMax, gMin, gMax] of tabla) {
      const c = fila(curso, nombre)
      const g = fila(garantizada, nombre)
      cerca(c.cp, cp, `${nombre} CP`)
      cerca(c.f, f, `${nombre} f`)
      cerca(c.tp_min_calculado, cMin[0], `${nombre} curso TPmin`)
      cerca(c.tp_max_calculado, cMax[0], `${nombre} curso TPmax`)
      cerca(g.tp_min_calculado, gMin[0], `${nombre} garantizada TPmin`)
      cerca(g.tp_max_calculado, gMax[0], `${nombre} garantizada TPmax`)
      expect.soft([c.tp_min, c.tp_max, g.tp_min, g.tp_max], `${nombre} redondeados`).toEqual([cMin[1], cMax[1], gMin[1], gMax[1]])
    }
  })

  it('TC-23 (PA-07) duración de la vuelta calculada y redondeada', () => {
    cerca(curso.vuelta_min_calculada, 65.45, 'curso V(60)')
    cerca(curso.vuelta_max_calculada, 130.91, 'curso V(120)')
    cerca(garantizada.vuelta_min_calculada, 82.63, 'garantizada V(60)')
    cerca(garantizada.vuelta_max_calculada, 165.27, 'garantizada V(120)')
    expect(curso.vuelta_min_redondeada).toBe(70.5)
    expect(curso.vuelta_max_redondeada).toBe(136)
    expect(garantizada.vuelta_min_redondeada).toBe(88)
    expect(garantizada.vuelta_max_redondeada).toBe(172)
  })

  it('TC-24 (PA-08, AL-01) modo curso, valores redondeados', () => {
    const palma = fila(curso, 'puesto palma')
    expect([palma.recuperacion_min, palma.recuperacion_max]).toEqual([52.5, 100])
    expect([al(curso, 'AL-01', 'puesto palma', 'min'), al(curso, 'AL-01', 'puesto palma', 'max')]).toEqual([true, true])
    const mallin = fila(curso, 'mallin')
    expect([mallin.recuperacion_min, mallin.recuperacion_max]).toEqual([60.5, 117])
    expect([al(curso, 'AL-01', 'mallin', 'min'), al(curso, 'AL-01', 'mallin', 'max')]).toEqual([false, true])
    const discordia = fila(curso, 'discordia')
    expect([discordia.recuperacion_min, discordia.recuperacion_max]).toEqual([63.5, 123])
    expect([al(curso, 'AL-01', 'discordia', 'min'), al(curso, 'AL-01', 'discordia', 'max')]).toEqual([false, false])
  })

  it('TC-25 (PA-08) modo garantizada, valores redondeados', () => {
    const palma = fila(garantizada, 'puesto palma')
    expect([palma.recuperacion_min, palma.recuperacion_max]).toEqual([65, 126])
    const mallin = fila(garantizada, 'mallin')
    expect([mallin.recuperacion_min, mallin.recuperacion_max]).toEqual([76, 148])
    expect(garantizada.alertas.filter((a) => a.id === 'AL-01')).toEqual([])
    cerca(palma.recuperacion_min_calculada, 60, 'puesto palma R(60) sin redondear')
    cerca(palma.recuperacion_max_calculada, 120, 'puesto palma R(120) sin redondear')
  })

  it('TC-26 (PA-09) modo curso, indicadores de referencia', () => {
    const d = fila(curso, 'discordia').referencia!
    cerca(d.tp_total, 18.82, 'discordia TPtot')
    cerca(d.sin_animales, 161.18, 'discordia sin_animales')
    cerca(d.pct_pastoreo, 0.105, 'discordia pct_pastoreo')
    const p = fila(curso, 'puesto palma').referencia!
    cerca(p.tp_total, 53.78, 'puesto palma TPtot')
    cerca(p.sin_animales, 126.22, 'puesto palma sin_animales')
    cerca(p.pct_pastoreo, 0.299, 'puesto palma pct_pastoreo')
  })

  it('TC-27 (AL-07) P. Compañero', () => {
    expect(al(garantizada, 'AL-07', 'P. Compañero', 'min')).toBe(true)
    expect(al(garantizada, 'AL-07', 'P. Compañero', 'max')).toBe(false)
    expect(al(curso, 'AL-07', 'P. Compañero', 'min')).toBe(true)
    expect(al(curso, 'AL-07', 'P. Compañero', 'max')).toBe(true)
    // Ningún otro potrero emite AL-07.
    for (const r of [curso, garantizada]) {
      expect(r.alertas.filter((a) => a.id === 'AL-07' && a.potrero_id !== 'P. Compañero')).toEqual([])
    }
  })

  it('TC-28 (CA-02) calendario en modo garantizada, tasa rápida', () => {
    const esperado: [string, string, number, string][] = [
      ['discordia', '2026-11-01', 8, '2026-11-09'],
      ['pitranto', '2026-11-09', 5, '2026-11-14'],
      ['chacrita', '2026-11-14', 8, '2026-11-22'],
      ['R.Ovejas 1', '2026-11-22', 7, '2026-11-29'],
      ['P. Mosquetas', '2026-11-29', 8, '2026-12-07'],
      ['P. Pasto (Tio)', '2026-12-07', 5, '2026-12-12'],
      ['P. Casa', '2026-12-12', 2, '2026-12-14'],
      ['P. Compañero', '2026-12-14', 1, '2026-12-15'],
      ['P. Pasto (victor)', '2026-12-15', 4, '2026-12-19'],
      ['mallin', '2026-12-19', 12, '2026-12-31'],
      ['puesto palma', '2026-12-31', 23, '2027-01-23'],
      ['P. Mosquetas victor', '2027-01-23', 5, '2027-01-28'],
    ]
    const periodos = calendario()
    esperado.forEach(([nombre, entrada, dur, salida], i) => {
      const p = periodos[i]
      expect([p.potrero_id, p.fecha_entrada, p.turno_entrada, p.duracion_dias, p.vuelta, p.tasa_aplicada]).toEqual([
        nombre, entrada, 'AM', dur, 1, 'rapida',
      ])
      expect(salidaPeriodo(p)).toEqual({ fecha: salida, turno: 'AM' })
    })
    const v2 = periodos[12]
    expect([v2.potrero_id, v2.fecha_entrada, v2.turno_entrada, v2.vuelta]).toEqual(['discordia', '2027-01-28', 'AM', 2])
    expect(diasEntre(salidaPeriodo(periodos[0]), { fecha: v2.fecha_entrada, turno: v2.turno_entrada })).toBe(80)
  })

  it('TC-29 (PA-10, CA-02) tramo lenta desde 2026-11-20', () => {
    const base = calendario()
    const periodos = calendario([{ fecha_desde: '2026-11-20', tasa: 'lenta' }])
    expect(periodos.slice(0, 3)).toEqual(base.slice(0, 3))
    const esperado: [string, string, number, string][] = [
      ['R.Ovejas 1', '2026-11-22', 13, '2026-12-05'],
      ['P. Mosquetas', '2026-12-05', 16, '2026-12-21'],
      ['P. Pasto (Tio)', '2026-12-21', 9, '2026-12-30'],
    ]
    esperado.forEach(([nombre, entrada, dur, salida], i) => {
      const p = periodos[i + 3]
      expect([p.potrero_id, p.fecha_entrada, p.turno_entrada, p.duracion_dias, p.tasa_aplicada]).toEqual([nombre, entrada, 'AM', dur, 'lenta'])
      expect(salidaPeriodo(p)).toEqual({ fecha: salida, turno: 'AM' })
    })
  })

  it('TC-30 (PA-11, RG-04, AL-02) recuperación real de discordia', () => {
    const mov = (potrero_id: string, e: string, s: string | null): MovimientoCalculado => ({
      potrero_id,
      periodo_pastoreo_id: null,
      fecha_entrada: e,
      turno_entrada: 'AM',
      fecha_salida: s,
      turno_salida: s ? 'AM' : null,
      ev_rodeo: 24.8,
      cabezas: 190,
    })
    const movimientos = [
      mov('discordia', '2026-11-01', '2026-11-08'),
      mov('pitranto', '2026-11-08', '2027-01-02'),
      mov('discordia', '2027-01-02', null),
    ]
    const base = { fecha_inicio: ABIERTO.inicio, fecha_fin: ABIERTO.fin, tr_min: 60, tr_max: 120 }

    const rapida = recuperacionesReales(movimientos, { plan_abierto: base })
    const r1 = rapida.recuperaciones.find((r) => r.potrero_id === 'discordia')!
    expect([r1.dias, r1.tr_exigido, r1.estado]).toEqual([55, 60, 'no_cumple'])
    expect(rapida.alertas.map((a) => [a.id, a.potrero_id])).toEqual([['AL-02', 'discordia']])

    const lenta = recuperacionesReales(movimientos, {
      plan_abierto: { ...base, tramos: [{ fecha_desde: '2026-12-01', tasa: 'lenta' }] },
    })
    const r2 = lenta.recuperaciones.find((r) => r.potrero_id === 'discordia')!
    expect([r2.dias, r2.tr_exigido, r2.estado]).toEqual([55, 120, 'no_cumple'])
    expect(lenta.alertas.map((a) => [a.id, a.potrero_id])).toEqual([['AL-02', 'discordia']])
  })

  it('TC-31 (PA-02) un solo potrero incluido → error de validación', () => {
    const calcular = () => calcularPlanAbierto({ potreros: potrerosA.slice(0, 1), tr_min: 60, tr_max: 120 })
    expect(calcular).toThrow(ErrorValidacion)
    expect(calcular).toThrow('se necesitan al menos 2 potreros')
  })
})
