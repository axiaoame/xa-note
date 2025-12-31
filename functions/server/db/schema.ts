/**
 * 数据库表结构定义
 * 统一管理所有数据库表的创建语句和默认数据
 */

export const DATABASE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    tags TEXT,
    category_id TEXT,
    created_at INTEGER,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    note_id TEXT,
    password TEXT,
    expires_at INTEGER,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS trash (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    tags TEXT,
    category_id TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL
  );
`;

export const DEFAULT_SETTINGS: Record<string, string> = {
  'language': 'zh'
};

export const DEFAULT_CATEGORIES = [
  {
    id: 'default',
    name: '默认',
    created_at: () => Date.now()
  }
];

export const DEFAULT_NOTES = [
  {
    id: 'xa-note-welcome',
    title: 'XA Note',
    content: `# XA Note

XA Note 是一款**轻量级、可完全自托管的个人笔记系统**，由您自行部署和管理，专为注重**隐私、安全与可控性**的用户设计。系统支持 Markdown 编辑、分类管理、标签系统和全文检索，提供流畅的写作体验与清晰的知识结构。

## 🌟 核心优势

### 🔐 完全的数据控制权
- **自托管部署**：所有数据仅存储在您自己的服务器中
- **无第三方依赖**：不依赖任何云服务，确保完全的数据所有权
- **隐私保护**：数据永远不会离开您的控制范围

### 📝 强大的笔记功能
- **Markdown 编辑**：实时预览的 Markdown 编辑器，支持丰富的语法
- **分类管理**：灵活的分类系统，构建清晰的知识结构
- **标签系统**：多维度标签管理，快速定位相关笔记
- **全文检索**：强大的搜索功能，快速找到所需内容
- **数据导出**：笔记可导出为 Markdown 文件，避免数据锁定

### 🛡️ 多层安全保护
- **多种登录方式**：账号密码登录、GitHub OAuth 登录
- **安全验证**：可选图片验证码或 Cloudflare Turnstile 防护
- **锁屏保护**：支持锁屏功能，防止未授权访问
- **访问控制**：适合在个人服务器或私有环境中长期使用
- **操作审计**：完整的日志系统记录所有用户操作，提供安全审计功能

### 🔗 安全分享与备份
- **只读分享**：支持笔记分享，可设置访问密码与过期时间控制
- **WebDAV 备份**：与云存储或私有 NAS 集成，实现数据自动同步
- **长期保存**：多种备份方式确保数据安全

### 🎨 优秀的用户体验
- **响应式设计**：在桌面和移动设备上均可获得良好体验
- **主题切换**：支持深色/浅色主题切换
- **多语言支持**：中英文界面无缝切换
- **键盘快捷键**：提高操作效率
- **系统监控**：内置日志管理系统，支持操作记录查看和过滤

## ⚙️ 配置说明

### 功能配置

系统提供了丰富的配置选项，包括：

- **站点设置**：站点标题、Logo、图标等
- **安全配置**：GitHub OAuth、验证码设置
- **备份配置**：WebDAV 自动备份
- **锁屏设置**：锁屏密码和超时时间
- **日志管理**：操作日志记录、查看和清理设置

所有配置都可以通过 Web 界面进行管理，无需修改配置文件。

## 🚀 部署

### 本地部署
支持 \`npm start\` 直接运行

### Docker部署
支持 \`docker\` 一键部署

### Cloudflare Pages部署
无成本安全高可用性 \`Cloudflare Pages\` 部署

## 🙏 致谢

感谢所有开源项目的贡献者，XA Note 使用了以下优秀的开源项目：

- React - 用户界面库
- TypeScript - 类型安全的 JavaScript
- Vite - 现代化的构建工具
- Hono - 轻量级 Web 框架
- Tailwind CSS - 实用优先的 CSS 框架
- D1 - Cloudflare 分布式数据库

---
**XA Note** - 轻量级自托管笔记系统，您的个人知识管理伙伴 🚀`,
    tags: '',
    category_id: 'default',
    created_at: () => Date.now(),
    updated_at: () => Date.now()
  }
];

export const DEFAULT_SHARES = [
  {
    id: 'xa-note',
    note_id: 'xa-note-welcome',
    password: null,
    expires_at: null,
    created_at: () => Date.now()
  }
];

export async function initializeDefaultData(
  adapter: any,
  isNewDatabase: boolean
): Promise<void> {
  if (isNewDatabase) {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await adapter.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, ?)
      `).run(key, value, Date.now())
    }

    for (const category of DEFAULT_CATEGORIES) {
      await adapter.prepare(`
        INSERT INTO categories (id, name, created_at)
        VALUES (?, ?, ?)
      `).run(category.id, category.name, category.created_at())
    }

    for (const note of DEFAULT_NOTES) {
      await adapter.prepare(`
        INSERT INTO notes (id, title, content, tags, category_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        note.id,
        note.title,
        note.content,
        note.tags,
        note.category_id,
        note.created_at(),
        note.updated_at()
      )
    }

    for (const share of DEFAULT_SHARES) {
      await adapter.prepare(`
        INSERT INTO shares (id, note_id, password, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        share.id,
        share.note_id,
        share.password,
        share.expires_at,
        share.created_at()
      )
    }
  } else {
    // 检查并补充缺失项（简化版）
  }
}
