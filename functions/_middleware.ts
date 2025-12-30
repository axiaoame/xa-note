// Cloudflare Pages Functions 中间件
export async function onRequest(context: any) {
  const { request, env, next } = context

  // 设置全局环境变量，供D1适配器使用
  if (env.DB) {
    globalThis.DB = env.DB
    globalThis.CF_PAGES = true
    globalThis.JWT_SECRET = env.JWT_SECRET || 'c390ea6f-8888-4cc2-b34e-a33ef10a313d'
  }

  return next()
}