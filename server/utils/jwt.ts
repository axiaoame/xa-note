import jwt from 'jsonwebtoken'
import crypto from 'crypto'

// 使用固定的JWT密钥，优先从环境变量读取
const JWT_SECRET = process.env.JWT_SECRET || 
                  (typeof globalThis !== 'undefined' && (globalThis as any).JWT_SECRET) || 
                  'c390ea6f-8888-4cc2-b34e-a33ef10a313d'

export interface JWTPayload {
  userId: string
  email: string
  role: string
  iat?: number
  exp?: number
}

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d', // 7天过期
    issuer: 'xa-note',
    audience: 'xa-note-users'
  })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'xa-note',
      audience: 'xa-note-users'
    }) as JWTPayload
    return decoded
  } catch (error) {
    // 只在开发环境输出详细错误信息
    if (process.env.NODE_ENV === 'development') {
      console.error('JWT verification failed:', error)
    }
    return null
  }
}

export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex')
}