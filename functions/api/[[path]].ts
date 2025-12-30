// Cloudflare Pages API 路由处理
import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { nanoid } from 'nanoid'
import bcrypt from 'bcryptjs'
import { D1Adapter } from '../../server/db/d1.js'
import { generateToken, verifyToken, generateSessionId } from '../../server/utils/jwt.js'

// Define the environment and variables types for Hono
type Bindings = {
  DB?: any // D1Database type
  CLOUDFLARE_ENV?: string
}

type Variables = {
  db: D1Adapter
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 初始化D1数据库适配器
let dbAdapter: D1Adapter | null = null

function getDatabase(env: Bindings): D1Adapter {
  if (!dbAdapter) {
    dbAdapter = new D1Adapter()
    if (env?.DB) {
      dbAdapter.setDatabase(env.DB)
    }
  }
  return dbAdapter
}

// 获取当前环境的基础URL
function getBaseUrl(c: any): { apiUrl: string, frontendUrl: string } {
  const host = c.req.header('host') || 'localhost:9915'
  const protocol = c.req.header('x-forwarded-proto') || 
                   c.req.header('cf-visitor') ? 'https' : 
                   (host.includes('localhost') ? 'http' : 'https')
  
  // 检查是否是Cloudflare Pages环境
  const isCloudflarePages = c.env?.CLOUDFLARE_ENV === 'pages' || 
                           c.req.header('cf-ray') || 
                           host.includes('.pages.dev')
  
  if (isCloudflarePages) {
    // Cloudflare Pages环境
    const baseUrl = `${protocol}://${host}`
    return {
      apiUrl: baseUrl,
      frontendUrl: baseUrl
    }
  } else if (process.env.NODE_ENV === 'development') {
    // 开发环境
    return {
      apiUrl: 'http://localhost:9915',
      frontendUrl: 'http://localhost:5173'
    }
  } else {
    // 生产环境（Docker等）
    const baseUrl = `${protocol}://${host}`
    return {
      apiUrl: baseUrl,
      frontendUrl: baseUrl
    }
  }
}

// 中间件：初始化数据库
app.use('*', async (c, next) => {
  const db = getDatabase(c.env)
  try {
    await db.initialize()
  } catch (error) {
    console.error('Database initialization failed:', error)
  }
  c.set('db', db)
  await next()
})

// 健康检查
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    platform: 'cloudflare-pages',
    timestamp: new Date().toISOString()
  })
})

// 安装状态检查
app.get('/api/install/status', async (c) => {
  const db = c.get('db') as D1Adapter
  try {
    const isInstalled = await db.isInstalled()
    return c.json({ installed: isInstalled })
  } catch (error) {
    return c.json({ installed: false, error: 'Database check failed' })
  }
})

// 安装接口
app.post('/api/install', async (c) => {
  const db = c.get('db') as D1Adapter
  
  try {
    // 检查是否已安装
    const isInstalled = await db.isInstalled()
    if (isInstalled) {
      return c.json({ error: 'Already installed' }, 400)
    }

    const { siteName, adminEmail, adminPassword } = await c.req.json()

    if (!siteName || !adminEmail || !adminPassword) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    // 设置基本配置
    const settings = [
      ['site.name', siteName],
      ['admin.email', adminEmail],
      ['admin.password', hashedPassword],
      ['system.installed', '1'],
      ['language', 'zh']
    ]

    for (const [key, value] of settings) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(key, value, Date.now())
    }

    return c.json({ success: true, message: 'Installation completed' })
  } catch (error) {
    console.error('Installation error:', error)
    return c.json({ error: 'Installation failed' }, 500)
  }
})

// 登录接口
app.post('/api/login', async (c) => {
  const db = c.get('db') as D1Adapter
  
  try {
    const { email, password } = await c.req.json()

    if (!email || !password) {
      return c.json({ ok: false, reason: 'missing_credentials' }, 400)
    }

    // 获取管理员信息
    const adminEmail = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin.email') as any
    const adminPassword = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin.password') as any

    if (!adminEmail || !adminPassword) {
      return c.json({ ok: false, reason: 'admin_not_configured' }, 500)
    }

    // 验证邮箱
    if (email !== adminEmail.value) {
      return c.json({ ok: false, error: 'email_incorrect' }, 401)
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, adminPassword.value)
    if (!isValidPassword) {
      return c.json({ ok: false, error: 'invalid_credentials' }, 401)
    }

    // 生成JWT token和session ID
    const token = generateToken({
      userId: 'admin',
      email: adminEmail.value,
      role: 'admin'
    })
    const sessionId = generateSessionId()

    // 设置cookies - Cloudflare Pages 使用 HTTPS
    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7天
      domain: undefined
    })
    setCookie(c, 'session_id', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7天
      domain: undefined
    })

    return c.json({ ok: true, email: adminEmail.value })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ ok: false, reason: 'server_error' }, 500)
  }
})

/* GitHub OAuth */

app.get('/api/auth/github', async (c) => {
  const db = c.get('db') as D1Adapter
  
  try {
    const enableGithub = db.prepare('SELECT value FROM settings WHERE key = ?').get('login.enable_github') as any
    if (!enableGithub || enableGithub.value !== '1') {
      return c.json({ error: 'GitHub login not enabled' }, 400)
    }

    const clientIdRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('github.client_id') as any
    if (!clientIdRow || !clientIdRow.value) {
      return c.json({ error: 'GitHub client ID not configured' }, 500)
    }

    const { apiUrl, frontendUrl } = getBaseUrl(c)
    const redirectUri = `${apiUrl}/api/auth/github/callback`
    const state = nanoid(32)
    
    // 保存 state 和前端URL 到 cookie 用于验证和重定向
    setCookie(c, 'github_oauth_state', state, {
      httpOnly: true,
      maxAge: 600, // 10 分钟
      path: '/'
    })
    
    setCookie(c, 'github_oauth_frontend', frontendUrl, {
      httpOnly: true,
      maxAge: 600, // 10 分钟
      path: '/'
    })

    const authUrl = new URL('https://github.com/login/oauth/authorize')
    authUrl.searchParams.set('client_id', clientIdRow.value)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', 'user:email')
    authUrl.searchParams.set('state', state)

    return c.redirect(authUrl.toString())
  } catch (error) {
    console.error('GitHub OAuth init error:', error)
    return c.json({ error: 'OAuth initialization failed' }, 500)
  }
})

app.get('/api/auth/github/callback', async (c) => {
  const db = c.get('db') as D1Adapter
  
  try {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const savedState = getCookie(c, 'github_oauth_state')
    const frontendUrl = getCookie(c, 'github_oauth_frontend') || getBaseUrl(c).frontendUrl

    if (!code || !state || state !== savedState) {
      return c.redirect(`${frontendUrl}/login?error=oauth_failed`)
    }

    // 清除 state 和 frontend URL cookies
    deleteCookie(c, 'github_oauth_state')
    deleteCookie(c, 'github_oauth_frontend')

    const clientIdRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('github.client_id') as any
    const clientSecretRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('github.client_secret') as any

    if (!clientIdRow?.value || !clientSecretRow?.value) {
      return c.redirect(`${frontendUrl}/login?error=oauth_config`)
    }

    // 交换 access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientIdRow.value,
        client_secret: clientSecretRow.value,
        code: code,
      })
    })

    const tokenData = await tokenResponse.json()
    
    if (!tokenData.access_token) {
      return c.redirect(`${frontendUrl}/login?error=oauth_token`)
    }

    // 获取用户信息
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      }
    })

    const userData = await userResponse.json()

    // 获取用户邮箱
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      }
    })

    const emailData = await emailResponse.json()
    const primaryEmail = emailData.find((email: any) => email.primary)?.email || userData.email

    // 检查是否是管理员邮箱
    const adminEmailRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin.email') as any
    if (!adminEmailRow || primaryEmail !== adminEmailRow.value) {
      return c.redirect(`${frontendUrl}/login?error=email_incorrect`)
    }

    // 生成JWT token
    const token = generateToken({
      userId: 'admin',
      email: adminEmailRow.value,
      role: 'admin'
    })

    // 生成session ID
    const sessionId = generateSessionId()

    // Cloudflare Pages 使用 HTTPS
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      domain: undefined
    }

    // 设置认证cookies
    setCookie(c, 'auth_token', token, cookieOptions)
    setCookie(c, 'session_id', sessionId, cookieOptions)

    // 重定向回前端
    return c.redirect(`${frontendUrl}/`)

  } catch (error) {
    console.error('GitHub OAuth callback error:', error)
    const frontendUrl = getCookie(c, 'github_oauth_frontend') || getBaseUrl(c).frontendUrl
    return c.redirect(`${frontendUrl}/login?error=oauth_error`)
  }
})

// 认证检查
app.get('/api/me', async (c) => {
  const token = getCookie(c, 'auth_token')
  const sessionId = getCookie(c, 'session_id')

  if (!token || !sessionId) {
    return c.json({ loggedIn: false, reason: 'missing_cookies' }, 401)
  }

  const payload = verifyToken(token)
  if (!payload) {
    return c.json({ loggedIn: false, reason: 'invalid_token' }, 401)
  }

  return c.json({ 
    loggedIn: true, 
    email: payload.email,
    role: payload.role
  })
})

// 退出登录
app.post('/api/logout', (c) => {
  deleteCookie(c, 'auth_token', { path: '/' })
  deleteCookie(c, 'session_id', { path: '/' })
  return c.json({ ok: true })
})

// 获取系统信息
app.get('/api/system/info', async (c) => {
  return c.json({
    name: 'XA Note',
    version: '1.0.0',
    platform: 'Cloudflare Pages',
    database: 'D1',
    timestamp: new Date().toISOString()
  })
})

export const onRequest = handle(app)