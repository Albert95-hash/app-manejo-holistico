// SPEC 7.5 — Registro: TC-50 a TC-53.
import { describe, expect, it } from 'vitest'
import {
  calcularPlanAbierto,
  cosechaReal,
  desvio,
  diasReales,
  estadoPotrero,
  evRodeo,
  generarCalendarioAbierto,
  registrarEntrada,
  sumarDias,
  type Instante,
  type MovimientoCalculado,
} from '../src/motor'
import { ABIERTO, R1, cerca, potrerosA } from './datos'

// Plan de TC-28, con un id por período para poder vincular los movimientos.
const tabla = calcularPlanAbierto({ potreros: potrerosA, tr_min: ABIERTO.tr_min, tr_max: ABIERTO.tr_max })
const periodos = generarCalendarioAbierto({ potreros: tabla.filas, fecha_inicio: ABIERTO.inicio, fecha_fin: ABIERTO.fin }).periodos.map(
  (p, i) => ({ ...p, id: `periodo-${i + 1}` }),
)
const r1 = evRodeo(R1)
const entrar = (movs: MovimientoCalculado[], potrero_id: string, fecha: string) =>
  registrarEntrada(movs, periodos, { potrero_id, instante: { fecha, turno: 'AM' }, ev_rodeo: r1.ev, cabezas: r1.cabezas })

describe('7.5 Registro', () => {
  it('TC-50 (RG-01, RG-02, RG-03) discordia y después pitranto', () => {
    const paso1 = entrar([], 'discordia', '2026-11-01')
    expect(paso1.nuevo.periodo_pastoreo_id).toBe('periodo-1')
    const paso2 = entrar(paso1.movimientos, 'pitranto', '2026-11-10')
    const [discordia, pitranto] = paso2.movimientos
    expect([discordia.fecha_salida, discordia.turno_salida]).toEqual(['2026-11-10', 'AM'])
    expect(diasReales(discordia)).toBe(9)
    expect(desvio(discordia, periodos[0]).desvio_dias).toBe(1)
    expect(pitranto.periodo_pastoreo_id).toBe('periodo-2')
    expect(pitranto.fecha_salida).toBeNull()
    expect(desvio(pitranto, periodos[1], { fecha: '2026-11-12', turno: 'AM' }).desvio_entrada).toBe(1)
    expect(paso2.movimientos.filter((m) => m.fecha_salida === null)).toHaveLength(1)
    cerca(pitranto.ev_rodeo, 24.8, 'ev_rodeo copiado')
    expect(pitranto.cabezas).toBe(190)
  })

  it('TC-51 (RG-01) chacrita en vez de pitranto → no planificado', () => {
    const paso1 = entrar([], 'discordia', '2026-11-01')
    const paso2 = entrar(paso1.movimientos, 'chacrita', '2026-11-09')
    expect(paso2.nuevo.potrero_id).toBe('chacrita')
    expect(paso2.nuevo.periodo_pastoreo_id).toBeNull()
  })

  it('TC-52 (RG-05) R1, discordia (7 ha), 8 días reales', () => {
    const c = cosechaReal(r1.ev, 8, 7)
    cerca(c.da_cosechados, 198.4, 'DA_cosechados')
    cerca(c.da_ha_real, 28.34, 'DAha_real')
  })

  it('TC-53 (RG-06) discordia en recuperación y recuperado', () => {
    const salida: Instante = { fecha: '2026-11-09', turno: 'AM' }
    const movimientos: MovimientoCalculado[] = [
      { potrero_id: 'discordia', periodo_pastoreo_id: null, fecha_entrada: '2026-11-01', turno_entrada: 'AM', fecha_salida: salida.fecha, turno_salida: salida.turno, ev_rodeo: r1.ev, cabezas: r1.cabezas },
      { potrero_id: 'pitranto', periodo_pastoreo_id: null, fecha_entrada: salida.fecha, turno_entrada: salida.turno, fecha_salida: null, turno_salida: null, ev_rodeo: r1.ev, cabezas: r1.cabezas },
    ]
    const estado = (dias: number) =>
      estadoPotrero({
        potrero_id: 'discordia',
        ahora: sumarDias(salida, dias),
        plan: { tipo: 'abierto', potrero_ids: potrerosA.map((p) => p.potrero_id), tr_min: 60, tr_max: 120 },
        movimientos,
      })
    const a30 = estado(30)
    expect([a30.estado, a30.avance, a30.tr_vigente]).toEqual(['en_recuperacion', 0.5, 60])
    expect(estado(61).estado).toBe('recuperado')
  })
})
