// worker.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    console.log(`[${new Date().toISOString()}] ${request.method} ${path}`);
    
    try {
      if (request.method === 'OPTIONS') {
        return handleOptions();
      }
      
      if (path === '/' || path === '/index.html') {
        return serveHtml();
      } else if (path === '/api/save-name' && request.method === 'POST') {
        return await handleSaveName(request, env.SLEEPY_KV, env.TOKEN);
      } else if (path === '/api/get-name' && request.method === 'GET') {
        return await handleGetName(request, env.SLEEPY_KV);
      } else if (path === '/api/get-devices' && request.method === 'GET') {
        // 新增：获取设备列表路由
        return await handleGetDevices(env.SLEEPY_KV);
      } else {
        return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' }});
      }
    } catch (error) {
      console.error('Worker处理错误:', error);
      return new Response(JSON.stringify({ error: '服务器内部错误', details: error.message }),
        { status: 500, headers: getCorsHeaders() }
      );
    }
  }
}

function handleOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  });
}

function getCorsHeaders() {
  return {
    'Content-Type': 'application/json;charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function serveHtml() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>正在干嘛呢？</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-image: url('https://r2.nth2miss.cn/bg.jpg');
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            background-attachment: fixed;
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 800px; margin: 0 auto; }
        header { text-align: center; margin-bottom: 20px; color: white; padding: 20px; }
        h1 { font-size: 2.5rem; margin-bottom: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        
        /* 针对设备选择器新增的样式 */
        .device-selector { text-align: center; margin-bottom: 20px; }
        .device-selector select {
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            color: white;
            border: 1px solid rgba(255,255,255,0.4);
            padding: 10px 20px;
            font-size: 1.1rem;
            border-radius: 25px;
            outline: none;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }
        .device-selector select option { color: #333; }

        .status-card {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            padding: 30px;
            margin-bottom: 25px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .status-item { text-align: center; padding: 20px; border-radius: 10px; transition: transform 0.3s ease; }
        .status-item:hover { transform: translateY(-5px); }
        .status-running { background: linear-gradient(135deg, #56ab2f, #a8e6cf); color: white; }
        .status-suspended { background: linear-gradient(120deg, #ff9a9e, #fad0c4); color: white; }
        .status-offline { background: linear-gradient(120deg, #a18cd1, #fbc2eb); color: white; }
        .status-unknown { background: linear-gradient(120deg, #f6d365, #fda085); color: white; }
        .status-label { font-size: 1rem; margin-bottom: 10px; font-weight: 600; }
        .status-value { font-size: 1.8rem; font-weight: 700; word-break: break-word; }
        .controls { text-align: center; margin: 20px 0; }
        .refresh-btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white; border: none; padding: 12px 30px; border-radius: 50px;
            font-size: 1rem; cursor: pointer; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            transition: all 0.3s ease;
        }
        .refresh-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3); }
        .refresh-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
        .countdown { margin-top: 10px; font-size: 0.9rem; color: #666; }
        .device-info { background: rgba(255, 255, 255, 0.3); border-radius: 10px; padding: 20px; margin-top: 20px; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .info-item { padding: 15px; border-radius: 8px; text-align: center; }
        .info-label { font-size: 0.9rem; color: #666; margin-bottom: 5px; }
        .info-value { font-size: 1.1rem; font-weight: 600; color: #333; word-break: break-word; }
        .last-update { text-align: center; color: #666; font-size: 0.9rem; margin-top: 20px; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(86, 171, 47, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(86, 171, 47, 0); }
            100% { box-shadow: 0 0 0 0 rgba(86, 171, 47, 0); }
        }
        @media (max-width: 768px) { .status-grid { grid-template-columns: 1fr; } h1 { font-size: 2rem; } .status-value { font-size: 1.5rem; } }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🖥️ 正在干嘛呢？</h1>
        </header>

        <div class="device-selector">
            <select id="deviceSelect" onchange="onDeviceChange()">
                <option value="">加载设备中...</option>
            </select>
        </div>
        
        <main>
            <div class="status-card">
                <div class="status-grid">
                    <div class="status-item status-unknown" id="statusContainer">
                        <div class="status-label">当前状态</div>
                        <div class="status-value" id="currentStatus">未知</div>
                    </div>
                    
                    <div class="status-item status-unknown" id="runningContainer">
                        <div class="status-label">运行应用</div>
                        <div class="status-value" id="runningApp">-</div>
                    </div>
                </div>
                
                <div class="controls">
                    <button class="refresh-btn" id="refreshBtn" onclick="getCurrentName()">🔄 刷新状态</button>
                    <div class="countdown" id="countdown"></div>
                </div>
                
                <div class="device-info">
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">最后更新</div>
                            <div class="info-value" id="lastUpdate">-</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">离线时长</div>
                            <div class="info-value" id="offlineDuration">-</div>
                        </div>
                    </div>
                </div>
                
                <div class="last-update" id="lastCheck">
                    页面加载于: <span id="loadTime"></span>
                </div>
            </div>
        </main>
    </div>

    <script>
        let lastRefreshTime = 0;
        const refreshInterval = 60000; // 60秒
        let countdownInterval = null;
        let currentMachineId = ''; // 当前选中的机器ID

        window.addEventListener('DOMContentLoaded', async function() {
            document.getElementById('loadTime').textContent = new Date().toLocaleString();
            await loadDevices(); // 先加载设备列表
        });

        // 获取设备列表
        async function loadDevices() {
            try {
                const response = await fetch('/api/get-devices');
                if (response.ok) {
                    const devices = await response.json();
                    const select = document.getElementById('deviceSelect');
                    select.innerHTML = '';
                    
                    const ids = Object.keys(devices);
                    if (ids.length === 0) {
                        select.innerHTML = '<option value="">暂无设备接入</option>';
                        return;
                    }
                    
                    for (const id of ids) {
                        const option = document.createElement('option');
                        option.value = id;
                        option.textContent = devices[id] + " (" + id.substring(0,6) + ")";
                        select.appendChild(option);
                    }
                    
                    // 默认选择第一个设备，并获取状态
                    currentMachineId = ids[0];
                    getCurrentName();
                }
            } catch (error) {
                console.error('获取设备列表失败:', error);
                document.getElementById('deviceSelect').innerHTML = '<option value="">网络错误</option>';
            }
        }

        // 切换设备触发
        function onDeviceChange() {
            currentMachineId = document.getElementById('deviceSelect').value;
            lastRefreshTime = 0; // 重置冷却时间
            document.getElementById('refreshBtn').disabled = false;
            clearInterval(countdownInterval);
            countdownInterval = null;
            document.getElementById('countdown').textContent = '';
            getCurrentName();
        }

        function updateCountdown() {
            const now = Date.now();
            const timeLeft = refreshInterval - (now - lastRefreshTime);
            
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                document.getElementById('countdown').textContent = '';
                document.getElementById('refreshBtn').disabled = false;
                return;
            }
            const seconds = Math.ceil(timeLeft / 1000);
            document.getElementById('countdown').textContent = \`\${seconds}秒后可再次刷新\`;
        }

        async function getCurrentName() {
            if (!currentMachineId) return;

            const now = Date.now();
            const refreshBtn = document.getElementById('refreshBtn');
            
            if (now - lastRefreshTime < refreshInterval && lastRefreshTime !== 0) {
                return;
            }
            
            lastRefreshTime = now;
            refreshBtn.disabled = true;
            updateCountdown();
            
            if (!countdownInterval) { countdownInterval = setInterval(updateCountdown, 1000); }
            
            try {
                // 请求加上设备id参数
                const response = await fetch('/api/get-name?id=' + currentMachineId);
                const lastCheckElement = document.getElementById('lastCheck');
                lastCheckElement.innerHTML = \`页面加载于: <span id="loadTime">\${document.getElementById('loadTime').textContent}</span> | 最后检查: \${new Date().toLocaleString()}\`;
                
                if (response.ok) {
                    const data = await response.json();
                    updateStatusDisplay(data);
                }
            } catch (error) {
                document.getElementById('lastCheck').textContent = '获取数据失败，请检查网络连接';
            }
        }
        
        function updateStatusDisplay(data) {
            if (!data.exists) {
                document.getElementById('currentStatus').textContent = '未知';
                document.getElementById('runningApp').textContent = '-';
                document.getElementById('lastUpdate').textContent = '-';
                document.getElementById('offlineDuration').textContent = '-';
                updateStatusContainer('unknown');
                return;
            }
            
            document.getElementById('runningApp').textContent = data.name || '-';
            const stoppedStatusNames = ['监听程序被中断', '监听程序已停止'];
            if (stoppedStatusNames.includes(data.name)) {
                document.getElementById('runningContainer').style.background = 'linear-gradient(120deg, #fad0c4, #ff9a9e)';
            } else {
                document.getElementById('runningContainer').style.background = '';
            }
            
            if (data.timestamp) {
                const updateTime = new Date(data.timestamp);
                document.getElementById('lastUpdate').textContent = updateTime.toLocaleString();
            } else {
                document.getElementById('lastUpdate').textContent = '-';
            }
            
            const statusElement = document.getElementById('currentStatus');
            const now = Date.now();
            const savedAt = data.savedAt || now;
            const offlineThreshold = 5 * 60 * 1000; // 5分钟
            
            if (data.running === false || (now - savedAt > offlineThreshold)) {
                statusElement.textContent = '似了喵';
                updateStatusContainer(data.running === false ? 'suspended' : 'offline');
            } else {
                statusElement.textContent = '运行中';
                updateStatusContainer('running');
            }
            
            const offlineElement = document.getElementById('offlineDuration');
            if (data.savedAt) {
                const diffMs = now - data.savedAt;
                if (diffMs > offlineThreshold) {
                    document.getElementById('currentStatus').textContent = '似了喵';
                    document.getElementById('runningApp').textContent = '无';
                    updateStatusContainer('offline');

                    const minutes = Math.floor(diffMs / 60000);
                    const hours = Math.floor(minutes / 60);
                    const days = Math.floor(hours / 24);
                    
                    if (days > 0) offlineElement.textContent = \`\${days}天\`;
                    else if (hours > 0) offlineElement.textContent = \`\${hours}小时\`;
                    else offlineElement.textContent = \`\${minutes}分钟\`;
                } else {
                    offlineElement.textContent = '在线';
                }
            } else {
                offlineElement.textContent = '-';
            }
        }
        
        function updateStatusContainer(statusType) {
            const container = document.getElementById('statusContainer');
            container.className = 'status-item';
            switch(statusType) {
                case 'running': container.classList.add('status-running', 'pulse'); break;
                case 'suspended': container.classList.add('status-suspended'); break;
                case 'offline': container.classList.add('status-offline'); break;
                default: container.classList.add('status-unknown');
            }
        }
    </script>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-cache' }
  });
}

// ----------------------------------------------------
// 获取设备列表
// ----------------------------------------------------
async function handleGetDevices(kv) {
  try {
    // 从 KV 中读取名为 'device_list' 的字典
    const data = await kv.get('device_list', 'json');
    return new Response(JSON.stringify(data || {}), { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    return new Response(JSON.stringify({ error: '获取设备列表失败' }), { status: 500, headers: getCorsHeaders() });
  }
}


// ----------------------------------------------------
// 保存名字到 KV
// ----------------------------------------------------
async function handleSaveName(request, kv, TOKEN) {
  try {
    let data;
    try { data = await request.json(); } 
    catch (e) { return new Response(JSON.stringify({ error: '无效的 JSON 数据' }), { status: 400, headers: getCorsHeaders() }); }
    
    const expectedToken = typeof TOKEN !== 'undefined' ? TOKEN : null;
    if (!expectedToken) return new Response(JSON.stringify({ error: '服务器未配置TOKEN' }), { status: 500, headers: getCorsHeaders() });
    if (!data.token || data.token !== expectedToken) return new Response(JSON.stringify({ error: '无效的访问令牌' }), { status: 401, headers: getCorsHeaders() });
    
    const name = data.name ? data.name.trim() : '';
    const machineId = data.machineId ? data.machineId.trim() : 'default_device';
    const machineName = data.machineName ? data.machineName.trim() : '未知设备';

    if (!name) return new Response(JSON.stringify({ error: '名字不能为空' }), { status: 400, headers: getCorsHeaders() });
    if (!data.timestamp || !data.savedAt) return new Response(JSON.stringify({ error: '缺少时间戳数据' }), { status: 400, headers: getCorsHeaders() });
    
    // 1. 更新设备列表
    let deviceList = await kv.get('device_list', 'json') || {};
    // 如果是新设备，或设备名称变更，则更新列表
    if (deviceList[machineId] !== machineName) {
      deviceList[machineId] = machineName;
      await kv.put('device_list', JSON.stringify(deviceList));
    }

    // 2. 准备存储的数据
    const userData = {
      name: name,
      timestamp: data.timestamp,
      savedAt: data.savedAt,
      running: data.running !== undefined ? Boolean(data.running) : undefined
    };
    
    // 根据 machineId 动态生成 key
    const userKey = `user_name_${machineId}`;
    await kv.put(userKey, JSON.stringify(userData));
    
    const responseData = { success: true, message: '保存成功', name: userData.name, timestamp: userData.timestamp, savedAt: userData.savedAt };
    if (userData.running !== undefined) responseData.running = userData.running;
    
    return new Response(JSON.stringify(responseData), { status: 200, headers: getCorsHeaders() });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: '保存数据失败', message: error.message }), { status: 500, headers: getCorsHeaders() });
  }
}

// ----------------------------------------------------
// 从 KV 获取对应机器的名字
// ----------------------------------------------------
async function handleGetName(request, kv) {
  try {
    const url = new URL(request.url);
    // 提取 id 参数
    const machineId = url.searchParams.get('id');
    
    if (!machineId) {
      return new Response(JSON.stringify({ exists: false, message: '未提供设备ID' }), { status: 200, headers: getCorsHeaders() });
    }

    const userKey = `user_name_${machineId}`;
    const data = await kv.get(userKey, 'json');
    
    if (!data) {
      return new Response(JSON.stringify({ exists: false, message: '暂无数据' }), { status: 200, headers: getCorsHeaders() });
    }
    
    const responseData = { exists: true, name: data.name, timestamp: data.timestamp, savedAt: data.savedAt };
    if (data.running !== undefined) responseData.running = data.running;
    
    return new Response(JSON.stringify(responseData), { status: 200, headers: getCorsHeaders() });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: '获取数据失败', message: error.message }), { status: 500, headers: getCorsHeaders() });
  }
}