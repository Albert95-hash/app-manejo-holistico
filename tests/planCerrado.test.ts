// SPEC 7.4 — Plan cerrado: TC-40 a TC-48.
import { describe, expect, it } from 'vitest'
import {
  alertasAL06,
  balanceForrajero,
  calcularPlanCerrado,
  demandaPlaneadaPotrero,
  demandaPlan,
  estadoBalance,
  evRodeoEnFecha,
  generarCalendarioCerrado,
} from '../src/motor'
import { CERRADO, R1, R2, cerca, composicion, potrerosC } from './datos'

const plan = (dias_reserva: number, selecciones = 1) =>
  calcularPlanCerrado({ potreros: potrerosC, asignacion: CERRADO.asignacion, selecciones, dias_plan: CERRADO.dias, dias_reserva })
const fila = (r: ReturnType<typeof plan>, nombre: string) => {
  const f = r.filas.find((x) => x.nombre === nombre)
  if (!f) throw new Error(`no existe ${nombre}`)
  return f
}
const balance = (rodeo: ReturnType<typeof composicion>) => {
  const p = plan(15)
  const d = demandaPlan(CERRADO.inicio, CERRADO.fin, rodeo, 15)
  return { d, b: balanceForrajero({ oferta: p.oferta, demanda: d.demanda, dias_requeridos: p.dias_requeridos }) }
}

describe('7.4 Plan cerrado', () => {
  it('TC-40 (PC-01 a PC-04) forraje, raciones y oferta', () => {
    const p = plan(0)
    const p2 = fila(p, '2')
    cerca(p2.forraje, 32200, '2 F')
    cerca(p2.da_ha, 115, '2 DAha')
    cerca(p2.dat, 1610, '2 DAT')
    const p7 = fila(p, '7')
    cerca(p7.forraje, 64000, '7 F')
    cerca(p7.da_ha, 400, '7 DAha')
    cerca(p7.dat, 3200, '7 DAT')
    cerca(p.suma_forraje, 501400, 'Σ F')
    cerca(p.oferta, 25070, 'oferta')
    cerca(p.suma_superficie, 264.5, 'Σ sup')
    expect(p.n).toBe(17)
    cerca(p.da_ha_campo, 94.78, 'DAha_campo')
    cerca(p.disp_campo, 1895.7, 'disp_campo')
  })

  it('TC-41 (PC-05, PC-06, PC-09) s = 1, reserva 0 y 15', () => {
    // nombre, DAT, [TP reserva 0], [TP reserva 15]
    const tabla: [string, number, number[], number[]][] = [
      ['2', 1610, [11.56, 12], [12.52, 13]],
      ['1', 2325, [16.69, 17], [18.08, 19]],
      ['6', 1190, [8.54, 9], [9.26, 10]],
      ['5', 1035, [7.43, 8], [8.05, 9]],
      ['8', 800, [5.74, 6], [6.22, 7]],
      ['12', 180, [1.29, 2], [1.4, 2]],
      ['11', 175, [1.26, 2], [1.36, 2]],
      ['discordia', 700, [5.03, 6], [5.44, 6]],
      ['mallin', 0, [0, 0], [0, 0]],
      ['puesto palma', 0, [0, 0], [0, 0]],
      ['3', 1040, [7.47, 8], [8.09, 9]],
      ['18', 2400, [17.23, 18], [18.67, 19]],
      ['17', 1705, [12.24, 13], [13.26, 14]],
      ['19', 2475, [17.77, 18], [19.25, 20]],
      ['7', 3200, [22.98, 23], [24.89, 25]],
      ['13', 1620, [11.63, 12], [12.6, 13]],
      ['14', 1170, [8.4, 9], [9.1, 10]],
      ['15', 2070, [14.86, 15], [16.1, 17]],
      ['16', 1375, [9.87, 10], [10.7, 11]],
    ]
    const r0 = plan(0)
    const r15 = plan(15)
    expect([r0.dias_requeridos, r15.dias_requeridos]).toEqual([180, 195])
    expect(r0.filas.map((f) => f.nombre)).toEqual(tabla.map((t) => t[0]))
    for (const [nombre, dat, tp0, tp15] of tabla) {
      const f0 = fila(r0, nombre)
      const f15 = fila(r15, nombre)
      cerca(f0.dat, dat, `${nombre} DAT`)
      cerca(f0.tp_sel_calculado, tp0[0], `${nombre} TP reserva 0`)
      cerca(f15.tp_sel_calculado, tp15[0], `${nombre} TP reserva 15`)
      expect.soft([f0.tp_sel, f15.tp_sel], `${nombre} redondeados`).toEqual([tp0[1], tp15[1]])
    }
    cerca(r0.suma_tp_total, 180, 'suma sin redondear, reserva 0')
    cerca(r15.suma_tp_total, 195, 'suma sin redondear, reserva 15')
    expect([r0.suma_tp_sel_redondeado, r15.suma_tp_sel_redondeado]).toEqual([188, 206])
    expect(r0.alertas.filter((a) => a.id === 'AL-05')).toHaveLength(1)
    expect(r15.alertas.filter((a) => a.id === 'AL-05')).toHaveLength(1)
    cerca(r0.receptividad, 139.28, 'receptividad reserva 0')
    cerca(r15.receptividad, 128.56, 'receptividad reserva 15')
    // Mallin y puesto palma quedan fuera de la secuencia.
    for (const nombre of ['mallin', 'puesto palma']) {
      expect([fila(r0, nombre).en_secuencia, fila(r0, nombre).aviso]).toEqual([false, 'sin pasto cargado'])
    }
    expect(r0.filas.filter((f) => !f.en_secuencia).map((f) => f.nombre)).toEqual(['mallin', 'puesto palma'])
    const cal = generarCalendarioCerrado({ potreros: r0.filas, fecha_inicio: CERRADO.inicio, fecha_fin: CERRADO.fin, selecciones: 1 })
    expect(cal.periodos.some((p) => p.potrero_id === 'mallin' || p.potrero_id === 'puesto palma')).toBe(false)
  })

  it('TC-42 (PC-06) s = 2, reserva 15', () => {
    const r = plan(15, 2)
    const esperado: [string, number, number][] = [
      ['2', 6.26, 7],
      ['7', 12.45, 13],
      ['12', 0.7, 1],
      ['11', 0.68, 1],
    ]
    for (const [nombre, calc, red] of esperado) {
      cerca(fila(r, nombre).tp_sel_calculado, calc, `${nombre} TPsel`)
      expect.soft(fila(r, nombre).tp_sel, `${nombre} redondeado`).toBe(red)
    }
    cerca(r.suma_tp_sel_calculado, 97.5, 'suma TPsel sin redondear')
    expect(r.suma_tp_sel_redondeado).toBe(108)
  })

  it('TC-43 (PC-07, PC-08, PC-10) R1 todos los meses, reserva 15', () => {
    const { d, b } = balance(composicion(CERRADO.inicio, CERRADO.fin, R1))
    cerca(d.demanda, 4836, 'demanda')
    cerca(b.balance, 20234, 'balance')
    cerca(b.utilizacion_pct, 19.29, 'utilizacion_pct')
    expect(b.estado).toBe('excedente')
    expect(b.alertas.map((a) => a.id)).toEqual(['AL-04'])
    cerca(b.dias_cubiertos, 1010.9, 'dias_cubiertos')
  })

  it('TC-44 (PC-07, PC-08, PC-10) R2 todos los meses, reserva 15', () => {
    const { d, b } = balance(composicion(CERRADO.inicio, CERRADO.fin, R2))
    cerca(d.demanda, 27294.15, 'demanda')
    cerca(b.balance, -2224.15, 'balance')
    cerca(b.utilizacion_pct, 108.87, 'utilizacion_pct')
    expect(b.estado).toBe('deficit')
    expect(b.alertas.map((a) => a.id)).toEqual(['AL-03'])
    cerca(b.dias_cubiertos, 179.11, 'dias_cubiertos')
  })

  it('TC-45 (PC-07, CM-02, CM-06) R1 salvo junio con R2, reserva 15', () => {
    const { d, b } = balance(composicion(CERRADO.inicio, CERRADO.fin, R1, { '2027-06': R2 }))
    ;[768.8, 4199.1, 768.8, 768.8, 744.0, 669.6].forEach((esp, i) => cerca(d.meses[i].demanda, esp, `demanda ${d.meses[i].mes}`))
    cerca(d.meses.reduce((s, m) => s + m.demanda, 0), 7919.1, 'demanda de los meses')
    cerca(d.demanda_reserva, 372, 'demanda de la reserva')
    cerca(d.demanda, 8291.1, 'demanda')
    cerca(b.balance, 16778.9, 'balance')
    cerca(b.utilizacion_pct, 33.07, 'utilizacion_pct')
    expect(b.estado).toBe('excedente')
  })

  it('TC-46 (PC-11) R1, reserva 0, s = 1, potrero "2"', () => {
    const r = plan(0)
    const comp = composicion(CERRADO.inicio, CERRADO.fin, R1)
    const cal = generarCalendarioCerrado({ potreros: r.filas, fecha_inicio: CERRADO.inicio, fecha_fin: CERRADO.fin, selecciones: 1 })
    const periodos = cal.periodos.filter((p) => p.potrero_id === '2')
    expect(periodos.map((p) => p.duracion_dias)).toEqual([12])
    const f = fila(r, '2')
    const dem = demandaPlaneadaPotrero({
      periodos,
      ev_en_fecha: (fecha) => evRodeoEnFecha(comp, fecha, CERRADO.fin).ev,
      superficie_ha: f.superficie_ha,
      dat: f.dat,
    })
    cerca(dem.periodos[0].demanda, 297.6, 'demanda')
    cerca(dem.periodos[0].demanda_da_ha, 21.26, 'demanda_DAha')
    cerca(dem.utilizacion_pct, 18.48, 'utilizacion')
  })

  it('TC-47 (AL-06) disponibilidad atípica', () => {
    const r = alertasAL06(potrerosC)
    expect([r.mediana, r.umbral]).toEqual([2300, 6900])
    expect(r.alertas.map((a) => a.potrero_id)).toEqual(['7'])
    expect(plan(0).alertas.filter((a) => a.id === 'AL-06').map((a) => a.potrero_id)).toEqual(['7'])
  })

  it('TC-48 (PC-08) estados con demanda 1000 y tolerancia 5', () => {
    expect([1040, 1060, 940, 960].map((oferta) => estadoBalance(oferta, 1000, 5))).toEqual([
      'equilibrado', 'excedente', 'deficit', 'equilibrado',
    ])
  })
})
