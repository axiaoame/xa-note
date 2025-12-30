import jwt from 'jsonwebtoken'
import crypto from 'crypto'

// 使用固定的JWT密钥，优先从环境变量读取
const getJWTSecret = () => {
  // 在Cloudflare Pages中，环境变量通过不同方式访问
  if (typeof globalThis !== 'undefined' && (globalThis as any).JWT_SECRET) {
    return (globalThis as any).JWT_SECRET
  }
  if (typeof process !== 'undefined' && process.env?.JWT_SECRET) {
    return process.env.JWT_SECRET
  }
  // 默认密钥（生产环境应该设置环境变量）
  return 'c390ea6f-8888-4cc2-b34e-a33ef10a313d'
}

export interface JWTPayload {
  userId: string
  email: string
  role: string
  iat?: number
  exp?: number
}

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret?: string): string {
  const JWT_SECRET = secret || getJWTSecret()
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d', // 7天过期
    issuer: 'xa-note',
    audience: 'xa-note-users'
  })
}

export function verifyToken(token: string, secret?: string): JWTPayload | null {
  try {
    const JWT_SECRET = secret || getJWTSecret()
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'xa-note',
      audience: 'xa-note-users'
    }) as JWTPayload
    return decoded
  } catch (error) {
    // 只在开发环境输出详细错误信息
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.error('JWT verification failed:', error)
    }
    return null
  }
}

export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex')
}