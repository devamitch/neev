/**
 * BlinkQuest Web In-Memory / IndexedDB Database Adapter
 * Web fallback for expo-sqlite to enable seamless Web bundling
 */

export interface DatabaseResult {
  success: boolean
  data?: any
  error?: string
}

export interface WebDatabase {
  execAsync: (sql: string) => Promise<void>
  runAsync: (sql: string, params?: any[]) => Promise<{ lastInsertRowId: number; changes: number }>
  getAllAsync: <T = any>(sql: string, params?: any[]) => Promise<T[]>
  getFirstAsync: <T = any>(sql: string, params?: any[]) => Promise<T | null>
  closeAsync: () => Promise<void>
}

// In-memory web tables
const metricsStore: any[] = []
let idCounter = 1

class MockWebDatabase implements WebDatabase {
  async execAsync(_sql: string): Promise<void> {
    // No-op for CREATE TABLE etc on Web mock
  }

  async runAsync(
    sql: string,
    params: any[] = [],
  ): Promise<{ lastInsertRowId: number; changes: number }> {
    if (sql.includes("INSERT INTO eye_tracking_metrics")) {
      const id = idCounter++
      metricsStore.push({
        id,
        timestamp: params[0] || new Date().toISOString(),
        blinkRate: params[1] || 0,
        perClose: params[2] || 0,
        attentionFrac: params[3] || 0,
        strainLevelIdx: params[4] || 0,
        strainText: params[5] || "Low",
        tiredText: params[6] || "Low",
        attBinary: params[7] || 1,
        eyeAspectRatio: params[8] || 0.28,
        pupilDilation: params[9] || 0.5,
        squintIntensity: params[10] || 0,
        eyeAge: params[11] || 25,
        faceAge: params[12] || 25,
        meanIBI: params[13],
        darkCircleScore: params[14],
        incompleteBlinkFrac: params[15],
        drynessScore: params[16],
        rednessMean: params[17],
        rednessStd: params[18],
        rednessNorm: params[19],
        rednessIndex: params[20],
        rednessScore: params[21],
        rednessZ: params[22],
        distanceCm: params[23],
        distanceVar: params[24],
        proximityScore: params[25],
        overallHealthScore: params[26],
        batteryLevel: params[27],
        user_id: params[28],
        level: params[29] || "raw",
        synced: 0,
      })
      return { lastInsertRowId: id, changes: 1 }
    }
    return { lastInsertRowId: 1, changes: 1 }
  }

  async getAllAsync<T = any>(sql: string, _params: any[] = []): Promise<T[]> {
    if (sql.includes("FROM eye_tracking_metrics")) {
      return [...metricsStore] as unknown as T[]
    }
    return []
  }

  async getFirstAsync<T = any>(sql: string, _params: any[] = []): Promise<T | null> {
    if (sql.includes("MIN(timestamp)")) {
      if (metricsStore.length > 0) {
        return { minTime: metricsStore[0].timestamp } as unknown as T
      }
      return null
    }
    return null
  }

  async closeAsync(): Promise<void> {
    // No-op
  }
}

const instance = new MockWebDatabase()

export const initDatabase = async (): Promise<WebDatabase> => {
  return instance
}

export const getDatabase = async (): Promise<WebDatabase> => {
  return instance
}

export const closeDatabase = async (): Promise<void> => {
  await instance.closeAsync()
}
