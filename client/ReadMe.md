## 🔧 修改 `report_status` 函数中的 URL

在 `Sleepy.py` 中找到 `report_status` 函数，将其中调用 Worker 的 URL 替换为你自己的域名：

```python
def report_status():
    """
    向监测服务器报告当前系统状态
    """
    def report_status(name, running):
        # 替换这里的 URL 为你的 Worker 域名
        # ⬇️ 修改这一行 ⬇️
        url = "https://your-worker-domain/api/save-name"
        headers = {"content-type": "application/json"}
        data = {"name": name, "running": running}

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

或者

2.使用pyinstaller
```bash
pyinstaller -F -w -i "logo.ico" Sleepy.py
```


