## 🔧 修改 `report_status` 函数中的 URL

在 `Sleepy.py` 中找到 `report_status` 函数，将其中调用 Worker 的 URL 替换为你自己的域名：

```python
def report_status(name, running):
    # ⚠️ 1. 将此处的 URL 替换为你 Cloudflare Worker 的真实域名
    url = "https://sleepy.你的域名.workers.dev/api/save-name" 
    
    # ⚠️ 2. 将此处的 token 替换为你在 Worker 环境变量中设置的 TOKEN
    token = "mysleepyApp"
```

**注意：**

1. 将 `your-worker-domain` 替换为你的实际 Worker 域名
2. 确保 Worker 已正确部署并配置了 `/save-name` 端点
3. 检查依赖是否安装 pip install -r requirements.txt
4. 测试连接是否正常

---

## 📦 基础打包命令（无控制台窗口）

1.使用nuitka（推荐）

```bash
nuitka --standalone --onefile --disable-console --windows-icon-from-ico="logo.ico" --output-dir=output Sleepy.py
```

2.使用pyinstaller

```bash
pyinstaller -F -w -i "logo.ico" Sleepy.py
```


