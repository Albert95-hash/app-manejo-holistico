// Tipos del modelo de datos de HOLOS (SPEC sección 5) y tipos auxiliares del motor.
// El motor es puro: estos tipos describen datos, no acceso a base de datos.

// ---------- Tipos básicos ----------

export type UUID = string
/** Fecha ISO `YYYY-MM-DD`. */
export type Fecha = string
/** Mes ISO `YYYY-MM`. */
export type Mes = string
/** Fecha y hora ISO. */
export type FechaHora = string
export type Turno = 'AM' | 'PM'

/** Instante = (fecha, turno). AM es el inicio del día y PM la mitad (SPEC, convenciones). */
export interface Instante {
  fecha: Fecha
  turno: Turno
}

/** Campos comunes a todos los registros (SPEC 5). */
export interface RegistroBase {
  id: UUID
  created_at: FechaHora
  updated_at: FechaHora
  /** Nulo si el registro está vigente (borrado lógico). */
  deleted_at: FechaHora | null
}

// ---------- 5.1 Territorio ----------

export interface Campo extends RegistroBase {
  nombre: string
  centro_lat: number | null
  centro_lon: number | null
  notas: string | null
}

export interface Celula extends RegistroBase {
  campo_id: UUID
  nombre: string
  color: string
}

/** Polígono GeoJSON en WGS84: anillos de pares [lon, lat]. */
export interface GeometriaPoligono {
  type: 'Polygon'
  coordinates: number[][][]
}

export interface Potrero extends RegistroBase {
  campo_id: UUID
  celula_id: UUID | null
  nombre: string
  geometria: GeometriaPoligono | null
  superficie_calculada_ha: number | null
  superficie_declarada_ha: number | null
  activo: boolean
  notas: string | null
}

export type TipoPuntoInteres = 'aguada' | 'tranquera' | 'corral' | 'otro'

export interface PuntoInteres extends RegistroBase {
  campo_id: UUID
  tipo: TipoPuntoInteres
  nombre: string
  lat: number
  lon: number
}

// ---------- 5.2 Animales ----------

export interface Rodeo extends RegistroBase {
  celula_id: UUID
  nombre: string
}

export type EspecieAnimal = 'ovino' | 'bovino' | 'equino' | 'porcino' | 'ave' | 'otro'

export interface CategoriaAnimal extends RegistroBase {
  nombre: string
  especie: EspecieAnimal
  orden: number
}

export interface EquivalenciaEV extends RegistroBase {
  categoria_id: UUID
  estado_fisiologico: string
  /** Incluido. */
  peso_min_kg: number
  /** Excluido. */
  peso_max_kg: number
  ev: number
  fuente: string | null
}

// ---------- 5.3 Planificación ----------

export type TipoPlan = 'abierto' | 'cerrado'
export type EstadoPlan = 'borrador' | 'activo' | 'finalizado'
export type ModoRecuperacion = 'garantizada' | 'curso'
export type TasaCrecimiento = 'rapida' | 'lenta' | 'nula'

export interface Plan extends RegistroBase {
  celula_id: UUID
  tipo: TipoPlan
  nombre: string
  fecha_inicio: Fecha
  fecha_fin: Fecha
  estado: EstadoPlan
  version_calendario: number
  /** Solo plan abierto. */
  tr_min_dias: number | null
  tr_max_dias: number | null
  modo_recuperacion: ModoRecuperacion | null
  /** Solo plan cerrado. */
  asignacion_kg_ms_por_da: number | null
  selecciones: number | null
  dias_reserva_sequia: number | null
  tolerancia_balance_pct: number | null
  notas: string | null
}

export interface PlanPotrero extends RegistroBase {
  plan_id: UUID
  potrero_id: UUID
  incluido: boolean
  orden: number
  superficie_ha: number
  /** Solo plan abierto, 1 a 10. */
  calidad: number | null
  /** Solo plan cerrado. */
  disponibilidad_kg_ms_ha: number | null
  tp_min_manual: number | null
  tp_max_manual: number | null
  tp_manual: number | null
}

export interface ComposicionRodeo extends RegistroBase {
  plan_id: UUID
  mes: Mes
  categoria_id: UUID
  estado_fisiologico: string
  cantidad: number
  peso_promedio_kg: number
  ev_unitario: number | null
  ev_manual: boolean
}

export interface TramoCrecimiento extends RegistroBase {
  plan_id: UUID
  fecha_desde: Fecha
  tasa: TasaCrecimiento
}

export interface PeriodoPastoreo extends RegistroBase {
  plan_id: UUID
  plan_potrero_id: UUID
  version: number
  vigente: boolean
  /** Plan abierto. */
  vuelta: number | null
  /** Plan cerrado. */
  numero_seleccion: number | null
  fecha_entrada: Fecha
  turno_entrada: Turno
  /** Múltiplo de 0.5. La salida no se guarda: es entrada + duracion_dias. */
  duracion_dias: number
  /** Plan abierto. */
  tasa_aplicada: TasaCrecimiento | null
  editado_manual: boolean
  recortado: boolean
}

export type OrigenRecuperacion = 'plan' | 'real'
export type EstadoRecuperacion = 'cumple' | 'no_cumple' | 'en_curso'

/** No se guarda: se calcula a partir de dos pastoreos consecutivos del mismo potrero. */
export interface PeriodoRecuperacion {
  potrero_id: UUID
  origen: OrigenRecuperacion
  desde: Instante
  /** Nulo si está en curso. */
  hasta: Instante | null
  dias: number
  /** PA-11. Nulo fuera de un plan abierto. */
  tr_exigido: number | null
  estado: EstadoRecuperacion
}

export type TipoEvento =
  | 'paricion'
  | 'esquila'
  | 'servicio'
  | 'destete'
  | 'sanidad'
  | 'potrero_no_disponible'
  | 'otro'

export interface Evento extends RegistroBase {
  campo_id: UUID
  tipo: TipoEvento
  titulo: string
  fecha_desde: Fecha
  fecha_hasta: Fecha
  /** Lista vacía = todo el campo. */
  potrero_ids: UUID[]
  bloquea_pastoreo: boolean
  notas: string | null
}

// ---------- 5.4 Registro ----------

export interface MovimientoReal extends RegistroBase {
  celula_id: UUID
  potrero_id: UUID
  plan_id: UUID | null
  periodo_pastoreo_id: UUID | null
  fecha_entrada: Fecha
  turno_entrada: Turno
  /** Nulos mientras está abierto. */
  fecha_salida: Fecha | null
  turno_salida: Turno | null
  ev_rodeo: number
  cabezas: number
  observaciones: string | null
}

export interface RegistroClima extends RegistroBase {
  campo_id: UUID
  fecha: Fecha
  lluvia_mm: number | null
  nieve_cm: number | null
  nota: string | null
}

// ---------- 5.5 Monitoreo ----------

export interface GrupoFuncional extends RegistroBase {
  nombre: string
  etiqueta_corta: string
  es_suelo_desnudo: boolean
  orden: number
  activo: boolean
}

export type Estacionalidad = 'perenne' | 'anual'

export interface Especie extends RegistroBase {
  nombre: string
  clave_normalizada: string
  grupo_funcional_id: UUID
  estacionalidad: Estacionalidad | null
}

export interface Relevamiento extends RegistroBase {
  campo_id: UUID
  fecha: Fecha
  nombre: string | null
  observaciones: string | null
}

export interface Muestra extends RegistroBase {
  relevamiento_id: UUID
  potrero_id: UUID
  numero: number
  lat: number | null
  lon: number | null
  foto: Blob | null
  observaciones: string | null
}

export type TipoFila = 'especie' | 'suelo_desnudo'

export interface FilaMuestra extends RegistroBase {
  muestra_id: UUID
  tipo: TipoFila
  especie_id: UUID | null
  cobertura_pct: number
  grupo_funcional_id: UUID
  estacionalidad: Estacionalidad | null
}

// ---------- 5.6 Configuración ----------

export interface Configuracion {
  url_teselas: string
  /** Por defecto 5. */
  tolerancia_suma_cobertura_pct: number
  /** Por defecto 3. */
  factor_disponibilidad_atipica: number
}

// ---------- Tipos auxiliares del motor (no son tablas) ----------

/** Tramo de crecimiento tal como lo consume el motor (PA-10). */
export type TramoEntrada = Pick<TramoCrecimiento, 'fecha_desde' | 'tasa'>

/** Evento tal como lo consume el motor (CA-04). */
export type EventoEntrada = Pick<Evento, 'fecha_desde' | 'fecha_hasta' | 'potrero_ids' | 'bloquea_pastoreo'> & {
  id?: UUID
  titulo?: string
}

/**
 * Período de pastoreo planificado tal como lo produce y consume el motor.
 * Igual a PeriodoPastoreo, pero identifica el potrero directamente y el `id` es opcional
 * (lo asigna quien persiste el período).
 */
export interface PeriodoCalculado {
  id?: UUID
  potrero_id: UUID
  version: number
  vigente: boolean
  vuelta: number | null
  numero_seleccion: number | null
  fecha_entrada: Fecha
  turno_entrada: Turno
  duracion_dias: number
  tasa_aplicada: TasaCrecimiento | null
  editado_manual: boolean
  recortado: boolean
}

/** Movimiento real tal como lo consume el motor (RG-01 a RG-07). */
export interface MovimientoCalculado {
  id?: UUID
  potrero_id: UUID
  periodo_pastoreo_id: UUID | null
  fecha_entrada: Fecha
  turno_entrada: Turno
  fecha_salida: Fecha | null
  turno_salida: Turno | null
  ev_rodeo: number
  cabezas: number
  observaciones?: string | null
}

export type IdAlerta =
  | 'AL-01'
  | 'AL-02'
  | 'AL-03'
  | 'AL-04'
  | 'AL-05'
  | 'AL-06'
  | 'AL-07'
  | 'AL-08'
  | 'AL-09'
  | 'AL-10'

/** Alerta calculada (SPEC 4.7). Las alertas se calculan, no se guardan. */
export interface Alerta {
  id: IdAlerta
  nombre: string
  /** Texto guía con los valores reemplazados (punto decimal; la interfaz lo localiza). */
  texto: string
  potrero_id?: UUID
  /** Valores usados, para que la interfaz pueda mostrarlos con su propio formato. */
  datos: Record<string, unknown>
}
