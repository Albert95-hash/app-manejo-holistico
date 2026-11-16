// SPEC 7.6 — Monitoreo: TC-60 a TC-65.
import { describe, expect, it } from 'vitest'
import {
  claveNormalizada,
  coberturaGrupo,
  filaValida,
  muestrasConDatos,
  resumenGrupo,
  resumenPotrero,
  sumaMuestra,
  type FilaEntrada,
  type MuestraEntrada,
} from '../src/motor'
import { cerca } from './datos'

const FI = 'Forrajeras de invierno'
const FV = 'Forrajeras de verano'
const LEG = 'Leguminosas'
const MI = 'Maleza de invierno'
const MV = 'Maleza de verano'
const SD = 'Suelo desnudo'
const GRUPOS = [FI, FV, LEG, SD, MI, MV]

const esp = (nombre: string, cobertura_pct: number | null, grupo_funcional_id: string): FilaEntrada => ({
  tipo: 'especie',
  nombre,
  cobertura_pct,
  grupo_funcional_id,
})
const suelo = (cobertura_pct: number): FilaEntrada => ({ tipo: 'suelo_desnudo', cobertura_pct })
const muestra = (...filas: FilaEntrada[]): MuestraEntrada => ({ filas })

const sector1 = [
  muestra(esp('trébol', 25, LEG), esp('xxxx', 85, MI), suelo(2), esp('ray gras', 25, FI)),
  muestra(esp('a', 25, FV), esp('b', 32, LEG), esp('c', 50, MI)),
  muestra(esp('g', 15, FV), esp('h', 15, LEG), esp('i', 15, FI)),
]
const filaL = esp('l', null, FV)
const sector2 = [
  muestra(esp('a', 15, FI), esp('b', 15, FI), esp('d', 14, FI), esp('c', 15, FV)),
  muestra(esp('g', 14, FI), esp('j', 4, LEG), esp('h', 5, FV), esp('gh', 5, FV)),
  muestra(esp('g', 14, FV), esp('h', 4, FV), esp('j', 5, FV), esp('k', 6, FV), filaL),
]
const sector3 = [muestra(), muestra(), muestra()]

function verificar(muestras: MuestraEntrada[], grupo: string, cob: number[], promedio: number, desvio: number) {
  const r = resumenGrupo(muestras, grupo, SD)!
  expect.soft(r.n, `${grupo} N`).toBe(3)
  expect.soft(r.coberturas, `${grupo} cob por muestra`).toEqual(cob)
  cerca(r.promedio, promedio, `${grupo} promedio`)
  cerca(r.desvio, desvio, `${grupo} desvío`)
}

describe('7.6 Monitoreo', () => {
  it('TC-60 (MO-03 a MO-05) Sector_1, N = 3', () => {
    expect(muestrasConDatos(sector1)).toHaveLength(3)
    verificar(sector1, FI, [25, 0, 15], 13.33, 12.58)
    verificar(sector1, FV, [0, 25, 15], 13.33, 12.58)
    verificar(sector1, LEG, [25, 32, 15], 24.0, 8.54)
    verificar(sector1, SD, [2, 0, 0], 0.67, 1.15)
    verificar(sector1, MI, [85, 50, 0], 45.0, 42.72)
    verificar(sector1, MV, [0, 0, 0], 0.0, 0.0)
    expect(resumenPotrero(sector1, GRUPOS, SD)!.map((r) => r.grupo_id)).toEqual(GRUPOS)
  })

  it('TC-61 (MO-03 a MO-05) Sector_2, N = 3', () => {
    verificar(sector2, FI, [44, 14, 0], 19.33, 22.48)
    verificar(sector2, FV, [15, 10, 29], 18.0, 9.85)
    verificar(sector2, LEG, [0, 4, 0], 1.33, 2.31)
  })

  it('TC-62 (MO-01) la fila "l" sin cobertura no es válida y no se guarda', () => {
    expect(filaValida(filaL)).toBe(false)
    const validas = sector2[2].filas.filter(filaValida)
    expect(validas).toHaveLength(4)
    expect(validas).not.toContain(filaL)
    expect(coberturaGrupo(sector2[2], FV, SD)).toBe(29)
  })

  it('TC-63 (MO-04, MO-05) N = 0 sin resumen; N = 1 con desvío nulo', () => {
    expect(muestrasConDatos(sector3)).toHaveLength(0)
    expect(resumenPotrero(sector3, GRUPOS, SD)).toBeNull()
    expect(resumenGrupo(sector3, FI, SD)).toBeNull()

    const unaConDatos = [muestra(esp('a', 40, FI)), muestra(), muestra()]
    const r = resumenGrupo(unaConDatos, FI, SD)!
    expect([r.n, r.promedio, r.desvio]).toEqual([1, 40, null])
  })

  it('TC-64 (MO-06, AL-10) sumas de Sector_1', () => {
    const sumas = sector1.map((m) => sumaMuestra(m))
    expect(sumas.map((s) => s.suma)).toEqual([137, 107, 45])
    expect(sumas.map((s) => s.alerta?.id)).toEqual(['AL-10', 'AL-10', 'AL-10'])
    const m96 = sumaMuestra(muestra(esp('a', 60, FI), esp('b', 36, LEG)))
    expect([m96.suma, m96.alerta]).toEqual([96, null])
  })

  it('TC-65 (MO-02) clave normalizada', () => {
    expect(claveNormalizada('  Ray  Gras ')).toBe('ray gras')
    expect(claveNormalizada('ray gras')).toBe('ray gras')
    expect(claveNormalizada('Trébol')).toBe('trebol')
  })
})
