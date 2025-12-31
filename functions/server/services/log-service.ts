import db from '../../server/index.js'

export interface LogEntry {
  id: string
  user_id: string
  action: string
  target_type?: string
  target_id?: string
  details?: string
  ip_address?: string
  user_agent?: string
  created_at: number
}

export class LogService {
  static async log(params: {
    user_id: string
    action: string
    target_type?: string
    target_id?: string
    details?: any
    ip_address?: string
    user_agent?: string
  }): Promise<void> {
    try {
      const id = crypto.randomUUID()
      const created_at = Date.now()
      
      const logEntry: LogEntry = {
        id,
        created_at,
        user_id: params.user_id,
        action: params.action,
        target_type: params.target_type,
        target_id: params.target_id,
        details: params.details ? JSON.stringify(params.details) : undefined,
        ip_address: params.ip_address,
        user_agent: params.user_agent
      }

      await db.prepare(`
        INSERT INTO logs (id, user_id, action, target_type, target_id, details, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        logEntry.id,
        logEntry.user_id,
        logEntry.action,
        logEntry.target_type,
        logEntry.target_id,
        logEntry.details,
        logEntry.ip_address,
        logEntry.user_agent,
        logEntry.created_at
      )
    } catch (error) {
      console.error('Failed to log action:', error)
    }
  }

  static async getLogs(params: {
    user_id: string
    limit?: number
    offset?: number
    action?: string
    target_type?: string
    start_date?: number
    end_date?: number
  }): Promise<{ logs: LogEntry[], total: number }> {
    const { user_id, limit = 50, offset = 0, action, target_type, start_date, end_date } = params

    let whereClause = 'WHERE user_id = ?'
    const queryParams: any[] = [user_id]

    if (action) { whereClause += ' AND action = ?'; queryParams.push(action) }
    if (target_type) { whereClause += ' AND target_type = ?'; queryParams.push(target_type) }
    if (start_date) { whereClause += ' AND created_at >= ?'; queryParams.push(start_date) }
    if (end_date) { whereClause += ' AND created_at <= ?'; queryParams.push(end_date) }

    const totalResult = await db.prepare(`SELECT COUNT(*) as count FROM logs ${whereClause}`).get(...queryParams) as any
    const total = totalResult.count

    const logs = await db.prepare(`SELECT * FROM logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...queryParams, limit, offset) as LogEntry[]

    const parsedLogs = logs.map(log => ({ ...log, details: log.details ? JSON.parse(log.details) : undefined }))

    return { logs: parsedLogs, total }
  }

  static async cleanOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
    const result = await db.prepare('DELETE FROM logs WHERE created_at < ?').run(cutoffTime)
    return result.changes
  }
}

export const LOG_ACTIONS = {
  LOGIN: 'login', LOGOUT: 'logout',
  CREATE_NOTE: 'create_note', UPDATE_NOTE: 'update_note', DELETE_NOTE: 'delete_note', RESTORE_NOTE: 'restore_note', PERMANENT_DELETE_NOTE: 'permanent_delete_note',
  CREATE_SHARE: 'create_share', DELETE_SHARE: 'delete_share', VIEW_SHARE: 'view_share',
  CREATE_CATEGORY: 'create_category', UPDATE_CATEGORY: 'update_category', DELETE_CATEGORY: 'delete_category',
  UPDATE_SETTINGS: 'update_settings',
  EXPORT_DATA: 'export_data', IMPORT_DATA: 'import_data', BACKUP_DATA: 'backup_data'
} as const
