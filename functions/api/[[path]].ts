// Cloudflare Pages API 路由处理
import { handle } from 'hono/cloudflare-pages'
import app from '../server/app.js'

export const onRequest = handle(app)