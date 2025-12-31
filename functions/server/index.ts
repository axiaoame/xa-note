import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import type { MiddlewareHandler } from 'hono'
import db from '../../server/index.js'
import { nanoid } from 'nanoid'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import {
  getSetting,
  getSettings,
  setSetting
} from './services/settings.js'
import { backupScheduler } from './services/backup-scheduler.js'
import { requireAuth } from './middleware/auth.js'
import svgCaptcha from 'svg-captcha'
import { generateToken, verifyToken, generateSessionId } from './utils/jwt.js'
import { LogService, LOG_ACTIONS } from './services/log-service.js'

const app = new Hono()

/* Installation */

// 检查是否已安装
function isInstalled(): boolean {
  const installed = getSetting('system.installed') === '1'
  return installed
}

// 安装检查中间件
const requireInstallation: MiddlewareHandler = async (c, next) => {
  // 跳过安装相关的API
  if (c.req.path.startsWith('/api/install') || c.req.path === '/api/settings/public') {
    await next()
    return
  }
  
  if (!isInstalled()) {
    return c.json({ error: 'NOT_INSTALLED', redirect: '/install' }, 503)
  }
  await next()
}

// 防止重复安装中间件
const preventReinstall: MiddlewareHandler = async (c, next) => {
  if (isInstalled()) {
    return c.json({ error: 'ALREADY_INSTALLED' }, 400)
  }
  await next()
}

app.post('/api/install', preventReinstall, async c => {
  const { siteTitle, adminEmail, adminPassword } = await c.req.json()

  // 验证输入
  if (!siteTitle?.trim()) {
    return c.json({ error: 'Site title is required' }, 400)
  }

  if (!adminEmail?.trim() || !adminEmail.includes('@')) {
    return c.json({ error: 'Valid admin email is required' }, 400)
  }

  if (!adminPassword || adminPassword.length < 6) {
    return c.json({ error: 'Admin password must be at least 6 characters' }, 400)
  }

  try {
    // 生成密码哈希
    const passwordHash = await bcrypt.hash(adminPassword, 10)

    // 设置基本配置
    setSetting('site.title', siteTitle.trim())
    setSetting('site.logo', '/logo.png')
    setSetting('site.favicon', '/favicon.png')
    setSetting('site.avatar_prefix', 'https://www.gravatar.com/avatar/')
    
    setSetting('admin.email', adminEmail.trim())
    setSetting('admin.password_hash', passwordHash)
    
    // 设置默认的登录配置
    setSetting('login.enable_captcha', '0')
    setSetting('login.enable_turnstile', '0')
    setSetting('login.turnstile_site_key', '')
    setSetting('login.turnstile_secret_key', '')
    setSetting('login.enable_github', '0')
    setSetting('github.client_id', '')
    setSetting('github.client_secret', '')
    
    // 设置默认的锁屏配置
    setSetting('lockscreen.enabled', '0')
    setSetting('lockscreen.password', '')
    
    // 设置默认的WebDAV配置
    setSetting('webdav.url', '')
    setSetting('webdav.user', '')
    setSetting('webdav.password', '')
    
    // 设置默认的上传配置
    setSetting('upload.max_file_size', '10') // 默认10MB
    
    // 标记为已安装
    setSetting('system.installed', '1')

    return c.json({ success: true, message: 'Installation completed' })
  } catch (error) {
    return c.json({ error: 'Installation failed' }, 500)
  }
})

// 获取安装状态
app.get('/api/install/status', c => {
  const installed = isInstalled()
  return c.json({ installed })
})

/* Captcha */
app.get('/api/captcha', c => {
  const captcha = svgCaptcha.create({
    size: 4,
    noise: 2,
    background: '#f4f4f5'
  })

  // 保存到 Cookie（5 分钟）
  setCookie(c, 'captcha', captcha.text.toLowerCase(), {
    httpOnly: true,
    maxAge: 300,
    path: '/'
  })

  return c.json({
    svg: captcha.data
  })
})

// ... (server/index.ts 内容已归档到 functions/server/index.ts)

export default app
