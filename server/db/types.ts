export interface DatabaseAdapter {
  // 初始化数据库
  initialize(): Promise<void>
  
  // 执行SQL语句
  exec(sql: string): void
  
  // 准备语句
  prepare(sql: string): PreparedStatement
  
  // 检查是否已安装
  isInstalled(): boolean
  
  // 关闭连接
  close(): Promise<void>
}

export interface PreparedStatement {
  // 执行查询并返回单行
  get(...params: any[]): any
  
  // 执行查询并返回所有行
  all(...params: any[]): any[]
  
  // 执行语句（INSERT, UPDATE, DELETE）
  run(...params: any[]): { changes: number; lastInsertRowid?: number }
}

// D1 specific interfaces (async)
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

export interface DatabaseConfig {
  type: 'sqlite' | 'd1'
  path?: string
  binding?: string
}