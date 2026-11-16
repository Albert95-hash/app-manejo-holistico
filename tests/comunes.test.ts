// SPEC 7.2 — Comunes: TC-01 a TC-13.
import { describe, expect, it } from 'vitest'
import { cargaAnimal, densidad, diasEntre, diasPlan, evRodeo, evUnitario, mesesPlan, redondearTP } from '../src/motor'
import { EQUIVALENCIAS_INICIALES, R1, R2, cerca, potrerosA } from './datos'

describe('7.2 Comunes', () => {
  it('TC-01 (CM-01) 2026-11-01 a 2027-04-30 → 181 días', () => {
    expect(diasPlan('2026-11-01', '2027-04-30')).toBe(181)
  })

  it('TC-02 (CM-01) 2027-05-01 a 2027-10-31 → 184 días', () => {
    expect(diasPlan('2027-05-01', '2027-10-31')).toBe(184)
  })

  it('TC-03 (CM-01) 2026-11-01 a 2027-04-29 → 180 días', () => {
    expect(diasPlan('2026-11-01', '2027-04-29')).toBe(180)
  })

  it('TC-04 (CM-02) meses 31, 30, 31, 31, 30, 27; total 180', () => {
    const meses = mesesPlan('2027-05-01', '2027-10-27')
    expect(meses.map((m) => m.dias)).toEqual([31, 30, 31, 31, 30, 27])
    expect(meses.map((m) => m.mes)).toEqual(['2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10'])
    expect(meses.reduce((s, m) => s + m.dias, 0)).toBe(180)
  })

  it('TC-05 (CM-05) Rodeo R1 → 24.8 EV; 190 cabezas', () => {
    const r = evRodeo(R1)
    cerca(r.ev_categorias[0], 19.2, 'OV madre')
    cerca(r.ev_categorias[1], 5.6, 'Cordero')
    cerca(r.ev, 24.8, 'ev_mes')
    expect(r.cabezas).toBe(190)
  })

  it('TC-06 (CM-05) Rodeo R2 → 139.97 EV', () => {
    const r = evRodeo(R2)
    ;[97.6, 17.64, 21.28, 3.45].forEach((esp, i) => cerca(r.ev_categorias[i], esp, `categoría ${i + 1}`))
    cerca(r.ev, 139.97, 'ev_mes')
  })

  it('TC-07 (CM-07) R1, Potreros A → 144.54 ha; 0.1716 EV/ha; 5.83 ha/EV', () => {
    const c = cargaAnimal(evRodeo(R1).ev, potrerosA.map((p) => p.superficie_ha))
    cerca(c.sup_celula, 144.54, 'sup_celula')
    cerca(c.carga, 0.1716, 'carga')
    cerca(c.ha_por_ev, 5.83, 'ha/EV')
  })

  it('TC-08 (CM-08) R1 en discordia (7 ha) → 3.54 EV/ha; 27.1 cabezas/ha', () => {
    const r = evRodeo(R1)
    const d = densidad(r.ev, r.cabezas, 7)
    cerca(d.ev_ha, 3.54, 'EV/ha')
    cerca(d.cabezas_ha, 27.1, 'cabezas/ha')
  })

  it('TC-09 (CM-09) redondeo del tiempo de pastoreo', () => {
    expect([14.4, 0.4, 0.81, 12.0, 0, 0.5, 1.0, 1.02].map(redondearTP)).toEqual([15, 0.5, 1, 12, 0, 0.5, 1, 2])
  })

  it('TC-10 (CM-10) (2026-11-08, AM) a (2027-01-02, AM) → 55 días', () => {
    expect(diasEntre({ fecha: '2026-11-08', turno: 'AM' }, { fecha: '2027-01-02', turno: 'AM' })).toBe(55)
  })

  it('TC-11 (CM-10) (2026-12-14, AM) a (2026-12-14, PM) → 0.5 días', () => {
    expect(diasEntre({ fecha: '2026-12-14', turno: 'AM' }, { fecha: '2026-12-14', turno: 'PM' })).toBe(0.5)
  })

  it('TC-12 (CM-04) OV madre, mantenimiento, 40 kg → 0.16', () => {
    expect(evUnitario(EQUIVALENCIAS_INICIALES, 'OV madre', 'mantenimiento', 40)).toEqual({ ev_unitario: 0.16, ev_manual: false })
  })

  it('TC-13 (CM-04) OV madre, mantenimiento, 60 kg → sin valor; ev_manual = true', () => {
    expect(evUnitario(EQUIVALENCIAS_INICIALES, 'OV madre', 'mantenimiento', 60)).toEqual({ ev_unitario: null, ev_manual: true })
  })
})
