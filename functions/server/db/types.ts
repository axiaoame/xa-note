// D1 Database interfaces for Cloudflare Pages
export interface D1DatabaseAdapter {
  initialize(): Promise<void>
  exec(sql: string): Promise<void>
  prepare(sql: string): D1PreparedStatement
  isInstalled(): Promise<boolean>
  close(): Promise<void>
}

export interface D1PreparedStatement {
  get(...params: any[]): Promise<any>
  all(...params: any[]): Promise<any[]>
  run(...params: any[]): Promise<{ changes: number; lastInsertRowid?: number }>
}
