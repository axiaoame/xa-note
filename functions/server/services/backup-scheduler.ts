import { getDatabase } from '../../server/db/index.js'
import { CronJob } from 'cron'

interface BackupConfig {
  frequency: 'manual' | 'daily' | 'weekly' | 'monthly'
  webdavUrl: string
  webdavUser: string
  webdavPassword: string
}

class BackupScheduler {
  private jobs: Map<string, CronJob> = new Map()
  private db = getDatabase()

  constructor() {
    this.initializeScheduler()
  }

  private async initializeScheduler() {
    await this.updateSchedule()
  }

  async updateSchedule() {
    try {
      this.jobs.forEach(job => job.stop())
      this.jobs.clear()

      const config = await this.getBackupConfig()
      if (!config || config.frequency === 'manual') return

      let cronPattern = ''
      switch (config.frequency) {
        case 'daily': cronPattern = '0 0 * * *'; break
        case 'weekly': cronPattern = '0 0 * * 1'; break
        case 'monthly': cronPattern = '0 0 1 * *'; break
      }

      if (cronPattern) {
        const job = new CronJob(cronPattern, async () => { await this.performAutoBackup(config) }, null, true, 'Asia/Shanghai')
        this.jobs.set('auto-backup', job)
        console.log(`Auto backup scheduled: ${config.frequency}`)
      }
    } catch (error) {
      console.error('Failed to update backup schedule:', error)
    }
  }

  private async getBackupConfig(): Promise<BackupConfig | null> {
    try {
      const frequency = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('backup.frequency') as any
      const webdavUrl = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('webdav.url') as any
      const webdavUser = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('webdav.user') as any
      const webdavPassword = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('webdav.password') as any

      if (!frequency?.value || !webdavUrl?.value || !webdavUser?.value || !webdavPassword?.value) return null

      return { frequency: frequency.value, webdavUrl: webdavUrl.value, webdavUser: webdavUser.value, webdavPassword: webdavPassword.value }
    } catch (error) {
      console.error('Failed to get backup config:', error)
      return null
    }
  }

  private async performAutoBackup(config: BackupConfig) {
    try {
      await this.backupNotes(config)
      await this.backupDatabase(config)
      await this.updateLastBackupTime()
      console.log('Auto backup completed successfully')
    } catch (error) {
      console.error('Auto backup failed:', error)
    }
  }

  private async backupNotes(config: BackupConfig) {
    const notes = this.db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all() as any[]
    const categories = this.db.prepare('SELECT * FROM categories').all() as any[]
    const backupData = { notes, categories, exportTime: new Date().toISOString() }
    const content = JSON.stringify(backupData, null, 2)
    const fileName = `notes-backup-${new Date().toISOString().split('T')[0]}.json`
    await this.uploadToWebDAV(config, fileName, content)
  }

  private async backupDatabase(config: BackupConfig) {
    const tables = ['settings', 'categories', 'notes', 'shares', 'trash']
    const backupData: any = {}
    for (const table of tables) {
      try { backupData[table] = this.db.prepare(`SELECT * FROM ${table}`).all() } catch (e) { backupData[table] = [] }
    }
    const content = JSON.stringify(backupData, null, 2)
    const fileName = `database-backup-${new Date().toISOString().split('T')[0]}.json`
    await this.uploadToWebDAV(config, fileName, content)
  }

  private async uploadToWebDAV(config: BackupConfig, fileName: string, content: string) {
    const url = config.webdavUrl.endsWith('/') ? config.webdavUrl : config.webdavUrl + '/'
    const fileUrl = url + fileName
    const auth = Buffer.from(`${config.webdavUser}:${config.webdavPassword}`).toString('base64')
    const response = await fetch(fileUrl, { method: 'PUT', headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }, body: content })
    if (!response.ok) throw new Error(`WebDAV upload failed: ${response.status} ${response.statusText}`)
  }

  private async updateLastBackupTime() {
    try { this.db.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`).run('backup.last_backup', new Date().toISOString(), Date.now()) } catch (error) { console.error('Failed to update last backup time:', error) }
  }

  stop() { this.jobs.forEach(job => job.stop()); this.jobs.clear() }
}

export const backupScheduler = new BackupScheduler()
