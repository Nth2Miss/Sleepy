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
3. 在 **已连接绑定** 部分点击**添加绑定**，选择**D1 database→添加绑定**
4. 变量名称**必须**填写为：**SLEEPY_D1**  ； **Database (数据库)**选择刚刚创建的`sleepy-db`。
   
   

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
   
   

### 8. 自动初始化数据库

1. 访问你的 Worker 提供的外网域名（例如 `https://sleepy.你的用户名.workers.dev`）。
2. **首次访问时，代码会自动在 D1 数据库中创建所需的数据表。** 页面加载出仪表盘即代表部署成功！

---

## 🛠️ 管理面板使用

1. 在浏览器中访问 `https://你的worker域名/admin`。
2. 在页面中输入你配置的 `TOKEN`。
3. 你可以在这里：
   - 📝 **修改备注**：为设备添加个性化备注（例如“家里的游戏本”），这不会覆盖客户端真实上报的主机名。
   - 🗑️ **删除设备**：永久从数据库中清除设备的记录。
     
     

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
