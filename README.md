# Sleepy 🌙

**基于 Cloudflare Workers 的轻量级实时系统状态监测平台**

---

## ✨ 特性
- ⚡ 基于 Cloudflare Workers，全球分布式部署，毫秒级响应
- 🔔 支持实时状态监测与异常通知
- 📱 简洁美观的 Web 客户端仪表盘
- 🔧 易于配置和部署，开箱即用

---

## 📁 项目结构

| 模块 | 说明 | 技术栈 |
|------|------|--------|
| **[🔗 Worker 服务端](./worker/ReadMe.md)** | 核心监测逻辑与 API 服务 | Cloudflare Workers, JavaScript |
| **[🔗 Python 客户端](./client/ReadMe.md)** | 获取应用名称与发送状态 | Python |

---

## 🚀 快速开始

1. **克隆仓库**
   ```bash
   git clone https://github.com/Nth2Miss/Sleepy.git
   cd Sleepy
   ```

2. **部署 Worker**
   - 进入 `worker` 目录，参考详细部署指南

3. **启动客户端**
   - 进入 `client` 目录，按说明配置并运行

---

## 📖 详细文档

- **[服务端部署与配置](./worker/ReadMe.md)** – Worker 开发、环境配置与部署指南  
- **[客户端使用说明](./client/ReadMe.md)** – Python 客户端使用与打包说明  

---

## 📄 开源协议

本项目基于 [MIT License](./LICENSE) 开源。
