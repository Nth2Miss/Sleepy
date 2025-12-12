# Sleepy Worker 部署指南 🔧

## 📌 手动部署到 Cloudflare Workers

### 1. 准备文件

将 `worker.js` 文件准备好，确保包含以下核心部分：



### 2. 登录 Cloudflare

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 登录你的账户



### 3. 创建 Workers KV数据库

1. 在侧边栏选择 **存储与数据库 →  Workers KV**
2. 点击 **Create instance** 
3. 给 Worker KV 命名（如：`sleepy`）
4. 点击 **创建**



### 3. 创建 Worker

1. 在侧边栏选择 **计算与AI**

2. 点击 **Workers 和 Pages** → **创建应用程序**

3. 给 Worker 命名（如：`sleepy`）

4. 点击 **从Hello World! 开始**

5. 点击 **部署**

   

### 4. 上传代码

1. 进入创建的 Worker 详情页

2. 点击右上角 **编辑代码**

3. 删除默认代码

4. 粘贴你的 `worker.js` 内容

5. 点击 **部署**

   

### 5. 绑定KV数据库

1. 返回 Worker 概览页
2. 点击 **绑定** 标签
3. 在 **已连接绑定** 部分点击**添加绑定**，选择**KV命名空间→添加绑定**
4. 变量名称：**SLEEPY_KV**  ； **KV 命名空间**选择刚刚创建的KV数据库



### 6.绑定域名

1. 返回 Worker 概览页
2. 点击 **设置** 标签
3. 点击**域和路由**的**添加**按钮
4. 选择**自定义域**



### 7.配置环境变量

1. 返回 Worker 概览页
2. 点击 **设置** 标签
3. 点击**变量和机密**的**添加**按钮
4. 添加类型：**文本**，变量名称：**TOKEN**，值与客户端中一致

---



# CSS 背景图片配置 🎨

## 在worker.js 文件中修改：

```css
/* 查找以下代码并修改 */
body {
  background-image: url('https://example.com/default-bg.jpg');
  
  /* 替换为你的图片链接： */
  background-image: url('https://your-image-url.com/your-background.jpg');
}
```



---

# 🚨 常见问题解决

## Worker 部署问题

1. **错误：Invalid JavaScript**  
   - 检查 `worker.js` 语法
   - 使用 [JavaScript Validator](https://esprima.org/demo/validate.html) 验证

2. **CORS 错误**  
   - 确保 Worker 返回正确的 CORS 头
   - 客户端使用正确的 Worker URL

3. **域名绑定失败**  
   - 确保域名已在 Cloudflare 管理
   - 检查 DNS 记录是否正确

## 背景图片问题

1. **图片不显示**  
   - 检查图片 URL 是否可公开访问
   - 使用浏览器开发者工具查看网络请求

2. **加载缓慢**  
   - 压缩图片大小（使用 [TinyPNG](https://tinypng.com/)）
   - 使用 CDN 加速

3. **响应式问题**  
   - 测试不同屏幕尺寸
   - 添加媒体查询适配

