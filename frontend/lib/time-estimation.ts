import { compareByPriorityDescAndDateAsc, normalizePriorityLevel } from "@/lib/priority"

export interface HistoricalData {
  serviceId: number
  averageServiceTime: number
  completedTickets: number
  hourlyPattern: Record<number, number> // hora -> tiempo promedio
  dayOfWeekPattern: Record<number, number> // día de semana -> tiempo promedio
  operatorPattern: Record<number, number> // operatorId -> tiempo promedio
  complexityFactors: Record<string, number> // factores de complejidad
  lastUpdated: Date
}

export interface OptimizationFactors {
  availableOperators: number
  queueLength: number
  timeOfDay: number
  dayOfWeek: number
  operatorEfficiency: number
  serviceComplexity: number
  clientType: "regular" | "vip" | "new"
}

export class TimeEstimationService {
  private static readonly STORAGE_KEY = "queue_historical_data"
  private static readonly MIN_SAMPLES = 5 // mínimo de tickets para usar histórico
  private static readonly OPTIMIZATION_WEIGHTS = {
    historical: 0.4,
    realTime: 0.3,
    operatorEfficiency: 0.2,
    queueDynamics: 0.1,
  }

  static getHistoricalData(): Record<number, HistoricalData> {
    if (typeof window === "undefined") return {}

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return {}

      const data = JSON.parse(stored)
      // Convertir fechas de string a Date
      Object.values(data).forEach((item: any) => {
        if (item.lastUpdated) {
          item.lastUpdated = new Date(item.lastUpdated)
        }
      })
      return data
    } catch {
      return {}
    }
  }

  static saveHistoricalData(data: Record<number, HistoricalData>) {
    if (typeof window === "undefined") return

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error("Error saving historical data:", error)
    }
  }

  static updateHistoricalData(serviceId: number, actualServiceTime: number, operatorId?: number) {
    const historicalData = this.getHistoricalData()
    const now = new Date()
    const hour = now.getHours()
    const dayOfWeek = now.getDay()

    if (!historicalData[serviceId]) {
      historicalData[serviceId] = {
        serviceId,
        averageServiceTime: actualServiceTime,
        completedTickets: 1,
        hourlyPattern: { [hour]: actualServiceTime },
        dayOfWeekPattern: { [dayOfWeek]: actualServiceTime },
        operatorPattern: operatorId ? { [operatorId]: actualServiceTime } : {},
        complexityFactors: {},
        lastUpdated: now,
      }
    } else {
      const data = historicalData[serviceId]

      // Actualizar promedio general con peso decreciente para datos antiguos
      const weight = Math.min(data.completedTickets, 100) // máximo peso de 100 tickets
      data.averageServiceTime = (data.averageServiceTime * weight + actualServiceTime) / (weight + 1)
      data.completedTickets += 1

      // Actualizar patrón por hora con peso adaptativo
      const hourSamples = Object.keys(data.hourlyPattern).length
      const hourWeight = Math.min(10, hourSamples)
      if (data.hourlyPattern[hour]) {
        data.hourlyPattern[hour] = (data.hourlyPattern[hour] * hourWeight + actualServiceTime) / (hourWeight + 1)
      } else {
        data.hourlyPattern[hour] = actualServiceTime
      }

      // Actualizar patrón por día de semana
      const dayWeight = Math.min(5, Object.keys(data.dayOfWeekPattern).length)
      if (data.dayOfWeekPattern[dayOfWeek]) {
        data.dayOfWeekPattern[dayOfWeek] =
          (data.dayOfWeekPattern[dayOfWeek] * dayWeight + actualServiceTime) / (dayWeight + 1)
      } else {
        data.dayOfWeekPattern[dayOfWeek] = actualServiceTime
      }

      if (operatorId) {
        const operatorWeight = Math.min(20, Object.keys(data.operatorPattern).length)
        if (data.operatorPattern[operatorId]) {
          data.operatorPattern[operatorId] =
            (data.operatorPattern[operatorId] * operatorWeight + actualServiceTime) / (operatorWeight + 1)
        } else {
          data.operatorPattern[operatorId] = actualServiceTime
        }
      }

      data.lastUpdated = now
    }

    this.saveHistoricalData(historicalData)
  }

  static getOptimizedServiceTime(serviceId: number, defaultTime: number, factors: OptimizationFactors): number {
    const historicalData = this.getHistoricalData()
    const data = historicalData[serviceId]

    if (!data || data.completedTickets < this.MIN_SAMPLES) {
      return this.applyOptimizationFactors(defaultTime, factors)
    }

    let estimatedTime = defaultTime

    // Factor histórico (40%)
    const historicalTime = this.getHistoricalEstimate(data, factors)

    // Factor de tiempo real (30%)
    const realTimeTime = this.getRealTimeEstimate(factors)

    // Factor de eficiencia del operador (20%)
    const operatorTime = this.getOperatorEfficiencyEstimate(data, factors)

    // Factor de dinámicas de cola (10%)
    const queueTime = this.getQueueDynamicsEstimate(factors)

    estimatedTime =
      historicalTime * this.OPTIMIZATION_WEIGHTS.historical +
      realTimeTime * this.OPTIMIZATION_WEIGHTS.realTime +
      operatorTime * this.OPTIMIZATION_WEIGHTS.operatorEfficiency +
      queueTime * this.OPTIMIZATION_WEIGHTS.queueDynamics

    return Math.round(Math.max(estimatedTime, defaultTime * 0.5)) // mínimo 50% del tiempo base
  }

  private static getHistoricalEstimate(data: HistoricalData, factors: OptimizationFactors): number {
    const { timeOfDay, dayOfWeek } = factors

    // Priorizar patrón por hora si existe
    if (data.hourlyPattern[timeOfDay]) {
      return data.hourlyPattern[timeOfDay]
    }

    // Luego patrón por día de semana
    if (data.dayOfWeekPattern[dayOfWeek]) {
      return data.dayOfWeekPattern[dayOfWeek]
    }

    // Finalmente promedio general
    return data.averageServiceTime
  }

  private static getRealTimeEstimate(factors: OptimizationFactors): number {
    const { queueLength, availableOperators } = factors

    // Ajustar según carga actual del sistema
    const loadFactor = queueLength / Math.max(availableOperators, 1)

    // Si hay mucha carga, los tiempos tienden a aumentar
    if (loadFactor > 5) return factors.serviceComplexity * 1.3
    if (loadFactor > 3) return factors.serviceComplexity * 1.1
    if (loadFactor < 1) return factors.serviceComplexity * 0.9

    return factors.serviceComplexity
  }

  private static getOperatorEfficiencyEstimate(data: HistoricalData, factors: OptimizationFactors): number {
    const baseTime = data.averageServiceTime

    // Aplicar factor de eficiencia del operador
    return baseTime * (2 - factors.operatorEfficiency) // eficiencia 1.0 = tiempo normal, 1.5 = 50% más rápido
  }

  private static getQueueDynamicsEstimate(factors: OptimizationFactors): number {
    const { queueLength, clientType } = factors

    let dynamicTime = factors.serviceComplexity

    // Clientes VIP tienden a recibir atención más rápida
    if (clientType === "vip") {
      dynamicTime *= 0.8
    } else if (clientType === "new") {
      dynamicTime *= 1.2 // clientes nuevos pueden tomar más tiempo
    }

    // Colas muy largas pueden generar presión para ser más eficientes
    if (queueLength > 10) {
      dynamicTime *= 0.95
    }

    return dynamicTime
  }

  private static applyOptimizationFactors(baseTime: number, factors: OptimizationFactors): number {
    let optimizedTime = baseTime

    // Aplicar factor de eficiencia del operador
    optimizedTime *= 2 - factors.operatorEfficiency

    // Aplicar factor de tipo de cliente
    if (factors.clientType === "vip") {
      optimizedTime *= 0.8
    } else if (factors.clientType === "new") {
      optimizedTime *= 1.2
    }

    // Aplicar factor de carga del sistema
    const loadFactor = factors.queueLength / Math.max(factors.availableOperators, 1)
    if (loadFactor > 5) {
      optimizedTime *= 1.2
    } else if (loadFactor < 1) {
      optimizedTime *= 0.9
    }

    return Math.round(optimizedTime)
  }

  static getEstimatedServiceTime(serviceId: number, defaultTime: number, operatorId?: number): number {
    const historicalData = this.getHistoricalData()
    const data = historicalData[serviceId]

    if (!data || data.completedTickets < this.MIN_SAMPLES) {
      return defaultTime
    }

    const now = new Date()
    const hour = now.getHours()
    const dayOfWeek = now.getDay()

    if (operatorId && data.operatorPattern[operatorId]) {
      return Math.round(data.operatorPattern[operatorId])
    }

    // Priorizar patrón por hora si existe
    if (data.hourlyPattern[hour]) {
      return Math.round(data.hourlyPattern[hour])
    }

    // Luego patrón por día de semana
    if (data.dayOfWeekPattern[dayOfWeek]) {
      return Math.round(data.dayOfWeekPattern[dayOfWeek])
    }

    // Finalmente promedio general
    return Math.round(data.averageServiceTime)
  }

  static getEstimatedWaitTime(
    serviceId: number,
    queuePosition: number,
    defaultServiceTime: number,
    factors?: Partial<OptimizationFactors>,
  ): number {
    const optimizationFactors: OptimizationFactors = {
      availableOperators: 1,
      queueLength: queuePosition,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      operatorEfficiency: 1.0,
      serviceComplexity: defaultServiceTime,
      clientType: "regular",
      ...factors,
    }

    const estimatedServiceTime = this.getOptimizedServiceTime(serviceId, defaultServiceTime, optimizationFactors)

    const effectiveServiceTime = estimatedServiceTime / Math.max(optimizationFactors.availableOperators, 1)

    const historicalData = this.getHistoricalData()
    const data = historicalData[serviceId]

    let variabilityFactor = 1.0
    if (data && data.completedTickets >= this.MIN_SAMPLES) {
      // Calcular variabilidad basada en desviación histórica
      const variance = this.calculateVariance(data)
      variabilityFactor = 1 + variance * 0.1 // máximo 10% de variabilidad adicional
    } else {
      // Variabilidad estándar para servicios sin histórico
      variabilityFactor = 1 + (Math.random() - 0.5) * 0.3 // ±15%
    }

    const adjustedServiceTime = effectiveServiceTime * variabilityFactor
    const waitTime = queuePosition * adjustedServiceTime

    const minWaitTime = Math.max(1, defaultServiceTime * 0.3)
    const maxWaitTime = defaultServiceTime * queuePosition * 2 // máximo 2x el tiempo teórico

    return Math.round(Math.max(minWaitTime, Math.min(waitTime, maxWaitTime)))
  }

  private static calculateVariance(data: HistoricalData): number {
    const times = [
      ...Object.values(data.hourlyPattern),
      ...Object.values(data.dayOfWeekPattern),
      ...Object.values(data.operatorPattern),
    ]

    if (times.length < 2) return 0.1 // varianza mínima

    const mean = times.reduce((sum, time) => sum + time, 0) / times.length
    const variance = times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / times.length

    return Math.min(variance / mean, 0.5) // normalizar y limitar varianza
  }

  static getQueuePosition(tickets: any[], serviceId: number, ticketId?: number): number {
    const waitingTickets = tickets
      .filter(
        (t) =>
          t.serviceId === serviceId &&
          (t.status === "WAITING" || t.status === "CALLED") &&
          (!ticketId || t.id !== ticketId),
      )
      .sort((a, b) =>
        compareByPriorityDescAndDateAsc(
          a,
          b,
          (ticket) => normalizePriorityLevel(ticket.priority),
          (ticket) => ticket.createdAt,
        ),
      )

    return waitingTickets.length
  }

  static recalculateAllWaitTimes(tickets: any[], services: any[], operators: any[]): any[] {
    const activeOperators = operators.filter((op) => op.active)

    return tickets.map((ticket) => {
      if (ticket.status !== "WAITING") return ticket

      const service = services.find((s) => s.id === ticket.serviceId)
      if (!service) return ticket

      const queuePosition = this.getQueuePosition(tickets, ticket.serviceId, ticket.id)
      const availableOperatorsForService = activeOperators.length // simplificado

      const factors: OptimizationFactors = {
        availableOperators: availableOperatorsForService,
        queueLength: queuePosition,
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        operatorEfficiency: 1.0, // promedio
        serviceComplexity: service.estimatedTime,
        clientType: ticket.clientId ? "regular" : "regular", // simplificado
      }

      const newEstimatedWaitTime = this.getEstimatedWaitTime(
        ticket.serviceId,
        queuePosition,
        service.estimatedTime,
        factors,
      )

      return {
        ...ticket,
        estimatedWaitTime: newEstimatedWaitTime,
      }
    })
  }

  static getPrecisionMetrics(serviceId: number): {
    accuracy: number
    totalPredictions: number
    averageError: number
  } {
    const historicalData = this.getHistoricalData()
    const data = historicalData[serviceId]

    if (!data || data.completedTickets < this.MIN_SAMPLES) {
      return {
        accuracy: 0,
        totalPredictions: 0,
        averageError: 0,
      }
    }

    // Calcular precisión basada en varianza histórica
    const variance = this.calculateVariance(data)
    const accuracy = Math.max(0, Math.min(100, (1 - variance) * 100))

    return {
      accuracy: Math.round(accuracy),
      totalPredictions: data.completedTickets,
      averageError: Math.round(variance * data.averageServiceTime),
    }
  }
}
