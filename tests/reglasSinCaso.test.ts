// Pruebas adicionales de reglas que la sección 7 del SPEC no cubre con un caso propio.
// No son casos TC: verifican el comportamiento que describe cada regla.
import { describe, expect, it } from 'vitest'
import {
  calcularPlanAbierto,
  calcularPlanCerrado,
  cosechaPotrero,
  editarDuracion,
  estadoPotrero,
  evRodeoEnFecha,
  evolucion,
  generarCalendarioAbierto,
  generarCalendarioCerrado,
  replanificarAbierto,
  salidaPeriodo,
  superficieCalculadaHa,
  superficiePotrero,
  utilizacionReal,
  type EventoEntrada,
  type MovimientoCalculado,
} from '../src/motor'
import { ABIERTO, CERRADO, R1, R2, potrerosA, potrerosC } from './datos'

const tablaA = calcularPlanAbierto({ potreros: potrerosA, tr_min: 60, tr_max: 120 })
const baseA = { potreros: tablaA.filas, fecha_inicio: ABIERTO.inicio, fecha_fin: ABIERTO.fin }
const tablaC = calcularPlanCerrado({ potreros: potrerosC, dias_plan: CERRADO.dias })
const baseC = { potreros: tablaC.filas, fecha_inicio: CERRADO.inicio, fecha_fin: CERRADO.fin, selecciones: 1 }
const bloqueo = (potrero_ids: string[], desde: string, hasta: string): EventoEntrada => ({
  id: 'ev-1',
  fecha_desde: desde,
  fecha_hasta: hasta,
  potrero_ids,
  bloquea_pastoreo: true,
})

describe('Reglas sin caso en la sección 7', () => {
  it('CM-03 superficie declarada reemplaza a la calculada; área geodésica en ha', () => {
    expect(superficiePotrero({ superficie_declarada_ha: 7, superficie_calculada_ha: 6.8 })).toBe(7)
    expect(superficiePotrero({ superficie_declarada_ha: null, superficie_calculada_ha: 6.8 })).toBe(6.8)
    // Cuadrado de 0.01° × 0.01° en el ecuador: ~1113.2 m de lado ≈ 123.9 ha.
    const ha = superficieCalculadaHa({ type: 'Polygon', coordinates: [[[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]]] })
    expect(Math.abs(ha - 123.92)).toBeLessThan(0.1)
    expect(Number(ha.toFixed(2))).toBe(ha)
  })

  it('CM-06 mes sin composición usa el anterior; después del fin, el último mes', () => {
    const comp = [...R1.map((f) => ({ ...f, mes: '2027-05' })), ...R2.map((f) => ({ ...f, mes: '2027-09' }))]
    expect(evRodeoEnFecha(comp, '2027-07-15', '2027-10-27').mes_usado).toBe('2027-05')
    expect(evRodeoEnFecha(comp, '2027-07-15', '2027-10-27').cabezas).toBe(190)
    expect(evRodeoEnFecha(comp, '2027-11-05', '2027-10-27').mes_usado).toBe('2027-09')
  })

  it('CA-02 el último período se recorta en fecha_fin + 1', () => {
    const { periodos } = generarCalendarioAbierto(baseA)
    const ultimo = periodos[periodos.length - 1]
    expect(salidaPeriodo(ultimo)).toEqual({ fecha: '2027-04-30', turno: 'AM' })
    expect(ultimo.recortado).toBe(true)
    expect(periodos.reduce((s, p) => s + p.duracion_dias, 0)).toBe(180)
  })

  it('CA-02, CA-04, AL-09 potrero bloqueado se saltea sin consumir tiempo', () => {
    const { periodos, alertas } = generarCalendarioAbierto({ ...baseA, eventos: [bloqueo(['pitranto'], '2026-11-05', '2026-11-12')] })
    expect(periodos.slice(0, 2).map((p) => [p.potrero_id, p.fecha_entrada])).toEqual([
      ['discordia', '2026-11-01'],
      ['chacrita', '2026-11-09'],
    ])
    expect(alertas.map((a) => [a.id, a.potrero_id])).toEqual([['AL-09', 'pitranto']])
  })

  it('CA-02 si todos están bloqueados se avanza de a medio día', () => {
    const { periodos } = generarCalendarioAbierto({ ...baseA, eventos: [bloqueo([], '2026-11-01', '2026-11-03')] })
    expect([periodos[0].potrero_id, periodos[0].fecha_entrada, periodos[0].turno_entrada, periodos[0].vuelta]).toEqual([
      'discordia', '2026-11-04', 'AM', 1,
    ])
  })

  it('CA-02, AL-08 tasa nula usa el TP máximo y avisa', () => {
    const { periodos, alertas } = generarCalendarioAbierto({ ...baseA, tramos: [{ fecha_desde: ABIERTO.inicio, tasa: 'nula' }] })
    expect([periodos[0].duracion_dias, periodos[0].tasa_aplicada]).toEqual([16, 'nula'])
    expect(alertas.filter((a) => a.id === 'AL-08')).toHaveLength(1)
  })

  it('CA-03 los redondeos exceden los días: recorta el final y lista los potreros en AL-05', () => {
    const cal = generarCalendarioCerrado(baseC)
    expect(cal.periodos).toHaveLength(17)
    expect(cal.periodos.every((p) => p.numero_seleccion === 1)).toBe(true)
    const ultimo = cal.periodos[cal.periodos.length - 1]
    // 188 días redondeados contra 180: "16" (10 días) entra el día 178 y se recorta a 2.
    expect([ultimo.potrero_id, ultimo.duracion_dias, ultimo.recortado]).toEqual(['16', 2, true])
    expect(salidaPeriodo(ultimo)).toEqual({ fecha: '2027-10-28', turno: 'AM' })
    expect(cal.recortados).toEqual(['16'])
    expect(cal.alertas.map((a) => a.id)).toEqual(['AL-05'])
  })

  it('CA-03 dos selecciones y reserva: lo que no entra queda en AL-05', () => {
    const tabla = calcularPlanCerrado({ potreros: potrerosC, dias_plan: CERRADO.dias, dias_reserva: 15, selecciones: 2 })
    const cal = generarCalendarioCerrado({ ...baseC, potreros: tabla.filas, selecciones: 2, dias_reserva: 15 })
    expect(cal.periodos.filter((p) => p.numero_seleccion === 1)).toHaveLength(17)
    expect(cal.periodos.reduce((s, p) => s + p.duracion_dias, 0)).toBe(195)
    // 108 × 2 = 216 > 195: la selección 2 llega al día 189 tras "7"; "13" (7 días) se recorta y el resto no entra.
    expect(cal.recortados).toEqual(['13', '14', '15', '16'])
    expect(tabla.alertas.find((a) => a.id === 'AL-05')?.datos.recortados).toEqual(['13', '14', '15', '16'])
  })

  it('CA-03, CA-04, AL-09 potrero bloqueado va al final de la selección; si sigue bloqueado se omite', () => {
    const alFinal = generarCalendarioCerrado({ ...baseC, eventos: [bloqueo(['2'], '2027-05-01', '2027-05-10')] })
    expect(alFinal.periodos[0].potrero_id).toBe('1')
    expect(alFinal.periodos[alFinal.periodos.length - 1].potrero_id).toBe('2')
    expect(alFinal.alertas.some((a) => a.id === 'AL-09')).toBe(false)

    const omitido = generarCalendarioCerrado({ ...baseC, eventos: [bloqueo(['2'], '2027-05-01', '2027-12-31')] })
    expect(omitido.periodos.some((p) => p.potrero_id === '2')).toBe(false)
    expect(omitido.alertas.filter((a) => a.id === 'AL-09').map((a) => a.potrero_id)).toEqual(['2'])
  })

  it('CA-05 editar una duración marca el período y encadena los siguientes', () => {
    const { periodos } = generarCalendarioAbierto(baseA)
    const editados = editarDuracion(periodos.slice(0, 4), 1, 6.5)
    expect([editados[1].duracion_dias, editados[1].editado_manual]).toEqual([6.5, true])
    expect([editados[2].fecha_entrada, editados[2].turno_entrada]).toEqual(['2026-11-15', 'PM'])
    expect([editados[3].fecha_entrada, editados[3].turno_entrada]).toEqual(['2026-11-23', 'PM'])
    expect(() => editarDuracion(periodos, 1, 6.3)).toThrow('múltiplo de 0.5')
  })

  it('CA-06 cambiar la tasa replanifica desde esa fecha y conserva el período en curso', () => {
    const original = generarCalendarioAbierto(baseA).periodos
    const tramos = [{ fecha_desde: '2026-11-20', tasa: 'lenta' as const }]
    const r = replanificarAbierto({ ...baseA, tramos, periodos: original, desde: { fecha: '2026-11-20', turno: 'AM' }, version_calendario: 1 })
    expect(r.version_calendario).toBe(2)
    const vigentes = r.periodos.filter((p) => p.vigente)
    // Igual que generar de cero con el tramo (TC-29): chacrita conserva sus 8 días.
    const directo = generarCalendarioAbierto({ ...baseA, tramos }).periodos
    expect(vigentes.map((p) => [p.potrero_id, p.fecha_entrada, p.duracion_dias, p.vuelta])).toEqual(
      directo.map((p) => [p.potrero_id, p.fecha_entrada, p.duracion_dias, p.vuelta]),
    )
    expect(vigentes.slice(0, 3).every((p) => p.version === 1)).toBe(true)
    expect(r.nuevos.every((p) => p.version === 2)).toBe(true)
    expect(r.nuevos[0].potrero_id).toBe('R.Ovejas 1')
    // Los períodos reemplazados se conservan como no vigentes.
    expect(r.periodos.filter((p) => !p.vigente)).toHaveLength(original.length - 3)
  })

  it('CA-06 con un movimiento real abierto, sigue desde el potrero siguiente al ocupado', () => {
    const original = generarCalendarioAbierto(baseA).periodos
    const r = replanificarAbierto({
      ...baseA,
      periodos: original,
      desde: { fecha: '2026-11-20', turno: 'AM' },
      version_calendario: 1,
      potrero_movimiento_abierto: 'P. Mosquetas',
    })
    expect([r.nuevos[0].potrero_id, r.nuevos[0].fecha_entrada]).toEqual(['P. Pasto (Tio)', '2026-11-22'])
  })

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

  it('RG-05, RG-07 cosecha acumulada y utilización real', () => {
    const movimientos = [mov('2', '2027-05-01', '2027-05-13'), mov('1', '2027-05-13', '2027-05-30'), mov('2', '2027-05-30', null)]
    const c = cosechaPotrero(movimientos, '2', 14, { fecha: '2027-06-02', turno: 'AM' })
    expect(c.da_cosechados).toBeCloseTo(24.8 * 15, 6)
    expect(c.da_ha_real).toBeCloseTo((24.8 * 15) / 14, 6)
    expect(utilizacionReal(c.da_cosechados, 1610)).toBeCloseTo(23.11, 2)
    expect(utilizacionReal(100, 0)).toBeNull()
  })

  it('RG-06 ocupado, bloqueado, pendiente, fuera de plan y pastoreado', () => {
    const ahora = { fecha: '2026-11-12', turno: 'AM' as const }
    const plan = { tipo: 'abierto' as const, potrero_ids: potrerosA.map((p) => p.potrero_id), tr_min: 60, tr_max: 120 }
    const movimientos = [mov('discordia', '2026-11-01', '2026-11-09'), mov('pitranto', '2026-11-09', null)]
    const eventos = [bloqueo(['discordia', 'pitranto', 'chacrita'], '2026-11-10', '2026-11-15')]
    const estado = (potrero_id: string, ev: EventoEntrada[] = []) => estadoPotrero({ potrero_id, ahora, plan, movimientos, eventos: ev }).estado
    expect(estado('pitranto')).toBe('ocupado')
    expect(estado('pitranto', eventos)).toBe('ocupado')
    expect(estado('discordia', eventos)).toBe('bloqueado')
    expect(estado('chacrita')).toBe('pendiente')
    expect(estado('otro potrero')).toBe('fuera_de_plan')

    const cerrado = { tipo: 'cerrado' as const, potrero_ids: ['2', '1'], periodos: generarCalendarioCerrado(baseC).periodos }
    const movsC = [mov('2', '2027-05-01', '2027-05-13'), mov('1', '2027-05-13', null)]
    const estadoC = (potrero_id: string) =>
      estadoPotrero({ potrero_id, ahora: { fecha: '2027-05-20', turno: 'AM' }, plan: cerrado, movimientos: movsC }).estado
    expect(estadoC('2')).toBe('pastoreado')
    expect(estadoC('1')).toBe('ocupado')
  })

  it('MO-07 evolución ordenada por fecha de relevamiento', () => {
    const m = (c: number) => ({ filas: [{ tipo: 'especie' as const, nombre: 'a', cobertura_pct: c, grupo_funcional_id: 'g' }] })
    const serie = evolucion(
      [
        { fecha: '2027-03-01', muestras: [m(30), m(50)] },
        { fecha: '2026-03-01', muestras: [m(10), m(20)] },
        { fecha: '2026-09-01', muestras: [{ filas: [] }] },
      ],
      'g',
      'suelo',
    )
    expect(serie.map((p) => [p.fecha, p.promedio])).toEqual([
      ['2026-03-01', 15],
      ['2027-03-01', 40],
    ])
  })
})
