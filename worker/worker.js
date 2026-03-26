let isDbInitialized = false;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (request.method === 'OPTIONS') return handleOptions();
    
    try {
      // 自动初始化 D1 数据库表结构
      if (!isDbInitialized && env.SLEEPY_D1) {
        await initDb(env.SLEEPY_D1);
        isDbInitialized = true;
      }

      if (path === '/' || path === '/index.html') {
        return serveHtml();
      } else if (path === '/admin') {
        return serveAdminHtml();
      } else if (path === '/api/save-name' && request.method === 'POST') {
        return await handleSaveName(request, env.SLEEPY_D1, env.TOKEN);
      } else if (path === '/api/get-name' && request.method === 'GET') {
        return await handleGetName(request, env.SLEEPY_D1);
      } else if (path === '/api/get-devices' && request.method === 'GET') {
        return await handleGetDevices(env.SLEEPY_D1);
      } else if (path === '/api/delete-device' && request.method === 'POST') {
        return await handleDeleteDevice(request, env.SLEEPY_D1, env.TOKEN);
      } else if (path === '/api/set-remark' && request.method === 'POST') {
        return await handleSetRemark(request, env.SLEEPY_D1, env.TOKEN);
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  });
}

function getCorsHeaders() {
  return {
    'Content-Type': 'application/json;charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// 自动建表
async function initDb(d1) {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS devices (
        machine_id TEXT PRIMARY KEY,
        machine_name TEXT NOT NULL,
        remark TEXT DEFAULT '',
        app_name TEXT,
        is_running INTEGER,
        timestamp TEXT,
        saved_at INTEGER
    );
  `;
  await d1.prepare(createTableQuery).run();
}

// ==========================================
// 核心 API 逻辑
// ==========================================

async function handleSaveName(request, d1, TOKEN) {
  try {
    const data = await request.json();
    const expectedToken = typeof TOKEN !== 'undefined' ? TOKEN : null;
    
    if (!expectedToken) return new Response(JSON.stringify({ error: '服务端未配置TOKEN' }), { status: 500, headers: getCorsHeaders() });
    if (!data.token || data.token !== expectedToken) return new Response(JSON.stringify({ error: '无效的访问令牌' }), { status: 401, headers: getCorsHeaders() });
    
    const machineId = data.machineId ? data.machineId.trim() : 'default_device';
    const machineName = data.machineName ? data.machineName.trim() : '未知设备';
    const appName = data.name ? data.name.trim() : '';
    const isRunning = data.running !== undefined ? (data.running ? 1 : 0) : null;

    if (!appName || !data.timestamp || !data.savedAt) {
      return new Response(JSON.stringify({ error: '数据格式不完整' }), { status: 400, headers: getCorsHeaders() });
    }

    // --- 节流逻辑 ---
    // 先消耗的 Read 额度，查询当前库里存的状态
    const existingRow = await d1.prepare("SELECT app_name, is_running, saved_at FROM devices WHERE machine_id = ?").bind(machineId).first();
    
    let shouldWrite = true;
    if (existingRow) {
      const nameUnchanged = existingRow.app_name === appName;
      const statusUnchanged = existingRow.is_running === isRunning;
      const timeDiff = data.savedAt - existingRow.saved_at;

      // 容错拦截：170000 毫秒（2分50秒）。客户端每1分钟发一次，前2次会拦截，第3次心跳放行
      if (nameUnchanged && statusUnchanged && timeDiff < 170000) {
        shouldWrite = false;
      }
    }
    
    // 如果判定需要写入，才执行 D1 的 Write 操作
    if (shouldWrite) {
      const query = `
        INSERT INTO devices (machine_id, machine_name, remark, app_name, is_running, timestamp, saved_at)
        VALUES (?1, ?2, '', ?3, ?4, ?5, ?6)
        ON CONFLICT(machine_id) DO UPDATE SET
          machine_name = excluded.machine_name,
          app_name = excluded.app_name,
          is_running = excluded.is_running,
          timestamp = excluded.timestamp,
          saved_at = excluded.saved_at
      `;
      
      await d1.prepare(query).bind(
        machineId, machineName, appName, isRunning, data.timestamp, data.savedAt
      ).run();
    }
    
    return new Response(JSON.stringify({ 
        success: true, 
        message: shouldWrite ? 'D1更新成功' : '状态无变化，节流跳过', 
        name: appName 
    }), { status: 200, headers: getCorsHeaders() });

  } catch (error) {
    return new Response(JSON.stringify({ error: '保存失败', message: error.message }), { status: 500, headers: getCorsHeaders() });
  }
}

async function handleGetDevices(d1) {
  try {
    const { results } = await d1.prepare("SELECT machine_id, machine_name, remark FROM devices ORDER BY saved_at DESC").all();
    let formattedResult = {};
    
    results.forEach(row => {
      formattedResult[row.machine_id] = {
        name: row.machine_name,
        remark: row.remark || "",
        displayName: row.remark ? row.remark : row.machine_name
      };
    });
    
    return new Response(JSON.stringify(formattedResult), { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    return new Response(JSON.stringify({ error: '获取设备列表失败', details: error.message }), { status: 500, headers: getCorsHeaders() });
  }
}

async function handleGetName(request, d1) {
  try {
    const url = new URL(request.url);
    const machineId = url.searchParams.get('id');
    if (!machineId) return new Response(JSON.stringify({ exists: false, message: '未提供设备ID' }), { status: 200, headers: getCorsHeaders() });

    const row = await d1.prepare("SELECT * FROM devices WHERE machine_id = ?").bind(machineId).first();
    
    if (!row) return new Response(JSON.stringify({ exists: false, message: '暂无数据' }), { status: 200, headers: getCorsHeaders() });
    
    const responseData = { 
      exists: true, 
      name: row.app_name, 
      timestamp: row.timestamp, 
      savedAt: row.saved_at,
      running: row.is_running === 1
    };
    
    return new Response(JSON.stringify(responseData), { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    return new Response(JSON.stringify({ error: '获取数据失败', message: error.message }), { status: 500, headers: getCorsHeaders() });
  }
}

async function handleSetRemark(request, d1, TOKEN) {
  try {
    const data = await request.json();
    const expectedToken = typeof TOKEN !== 'undefined' ? TOKEN : null;
    
    if (!expectedToken) return new Response(JSON.stringify({ error: '服务端未配置TOKEN' }), { status: 500, headers: getCorsHeaders() });
    if (!data.token || data.token !== expectedToken) return new Response(JSON.stringify({ error: 'Token错误' }), { status: 401, headers: getCorsHeaders() });
    if (!data.machineId) return new Response(JSON.stringify({ error: '缺少设备ID' }), { status: 400, headers: getCorsHeaders() });

    await d1.prepare("UPDATE devices SET remark = ? WHERE machine_id = ?").bind(data.remark || '', data.machineId).run();
    return new Response(JSON.stringify({ success: true, message: '备注设置成功' }), { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    return new Response(JSON.stringify({ error: '执行设置失败', details: error.message }), { status: 500, headers: getCorsHeaders() });
  }
}

async function handleDeleteDevice(request, d1, TOKEN) {
  try {
    const data = await request.json();
    const expectedToken = typeof TOKEN !== 'undefined' ? TOKEN : null;
    
    if (!expectedToken) return new Response(JSON.stringify({ error: '服务端未配置TOKEN' }), { status: 500, headers: getCorsHeaders() });
    if (!data.token || data.token !== expectedToken) return new Response(JSON.stringify({ error: 'Token错误' }), { status: 401, headers: getCorsHeaders() });
    if (!data.machineId) return new Response(JSON.stringify({ error: '缺少设备ID' }), { status: 400, headers: getCorsHeaders() });

    await d1.prepare("DELETE FROM devices WHERE machine_id = ?").bind(data.machineId).run();
    return new Response(JSON.stringify({ success: true, message: '设备已成功删除' }), { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    return new Response(JSON.stringify({ error: '执行删除失败', details: error.message }), { status: 500, headers: getCorsHeaders() });
  }
}

// ==========================================
// 前端 HTML 页面 
// ==========================================
async function serveHtml() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>正在干嘛呢？</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-image: url('https://r2.nth2miss.cn/bg.jpg'); background-size: cover; background-position: center; background-repeat: no-repeat; background-attachment: fixed; min-height: 100vh; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        header { text-align: center; margin-bottom: 20px; color: white; padding: 20px; }
        h1 { font-size: 2.5rem; margin-bottom: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .device-selector { text-align: center; margin-bottom: 20px; }
        .device-selector select { background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); color: white; border: 1px solid rgba(255,255,255,0.4); padding: 10px 20px; font-size: 1.1rem; border-radius: 25px; outline: none; cursor: pointer; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); }
        .device-selector select option { color: #333; }
        .status-card { background: rgba(255, 255, 255, 0.3); border-radius: 15px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2); padding: 30px; margin-bottom: 25px; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); }
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
        .refresh-btn { background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; padding: 12px 30px; border-radius: 50px; font-size: 1rem; cursor: pointer; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); transition: all 0.3s ease; }
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
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(86, 171, 47, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(86, 171, 47, 0); } 100% { box-shadow: 0 0 0 0 rgba(86, 171, 47, 0); } }
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
        const refreshInterval = 10000; // 网页端可以每10秒刷新一次，响应迅速
        let countdownInterval = null;
        let currentMachineId = '';

        window.addEventListener('DOMContentLoaded', async function() {
            document.getElementById('loadTime').textContent = new Date().toLocaleString();
            await loadDevices();
        });

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
                        const dev = devices[id];
                        const option = document.createElement('option');
                        option.value = id;
                        option.textContent = dev.displayName + " (" + id.substring(0,6) + ")";
                        select.appendChild(option);
                    }
                    currentMachineId = ids[0];
                    getCurrentName();
                }
            } catch (error) {
                console.error('获取设备列表失败:', error);
                document.getElementById('deviceSelect').innerHTML = '<option value="">网络错误</option>';
            }
        }

        function onDeviceChange() {
            currentMachineId = document.getElementById('deviceSelect').value;
            lastRefreshTime = 0;
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
            if (now - lastRefreshTime < refreshInterval && lastRefreshTime !== 0) return;
            
            lastRefreshTime = now;
            refreshBtn.disabled = true;
            updateCountdown();
            if (!countdownInterval) { countdownInterval = setInterval(updateCountdown, 1000); }
            
            try {
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
            
            // 判定离线设定为 3 分钟
            const offlineThreshold = 3 * 60 * 1000;
            
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
  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-cache' } });
}

// ==========================================
// 管理员面板 HTML
// ==========================================
async function serveAdminHtml() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sleepy 设备管理面板</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-image: url('https://r2.nth2miss.cn/bg.jpg'); background-size: cover; background-attachment: fixed; margin: 0; padding: 20px; color: #333; }
        .admin-container { max-width: 800px; margin: 40px auto; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(15px); border-radius: 15px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        h2 { text-align: center; margin-bottom: 20px; color: #2c3e50; }
        .auth-box { text-align: center; margin-bottom: 30px; }
        .auth-box input { padding: 10px 15px; width: 60%; max-width: 300px; border-radius: 5px; border: 1px solid #ccc; font-size: 1rem; }
        .device-list { list-style: none; padding: 0; }
        .device-item { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; margin-bottom: 10px; background: #fff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid #eee; flex-wrap: wrap; gap: 10px;}
        .device-info { flex: 1; }
        .device-info strong { font-size: 1.1rem; color: #2980b9; }
        .device-info span.did { font-size: 0.85rem; color: #7f8c8d; margin-top: 5px; display: block; }
        .device-actions { display: flex; gap: 10px; }
        .remark-btn { background: #f39c12; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; transition: background 0.3s; }
        .remark-btn:hover { background: #e67e22; }
        .delete-btn { background: #e74c3c; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; transition: background 0.3s; }
        .delete-btn:hover { background: #c0392b; }
        .header-links { text-align: center; margin-bottom: 20px; }
        .header-links a { color: #2980b9; text-decoration: none; font-weight: bold; }
    </style>
</head>
<body>
    <div class="admin-container">
        <h2>🛠️ 设备管理面板</h2>
        <div class="header-links"><a href="/">← 返回主页查看状态</a></div>
        <div class="auth-box"><input type="password" id="adminToken" placeholder="请输入你的 TOKEN"></div>
        <ul class="device-list" id="deviceList">
            <div style="text-align:center; padding: 20px;">加载设备中...</div>
        </ul>
    </div>
    <script>
        window.onload = loadAdminDevices;
        
        async function loadAdminDevices() {
            try {
                const response = await fetch('/api/get-devices');
                const list = document.getElementById('deviceList');
                if (response.ok) {
                    const devices = await response.json();
                    list.innerHTML = '';
                    const ids = Object.keys(devices);
                    if (ids.length === 0) { list.innerHTML = '<div style="text-align:center; padding: 20px; color:#7f8c8d;">暂无设备接入系统</div>'; return; }
                    
                    ids.forEach(id => {
                        const dev = devices[id];
                        const displayHtml = dev.remark 
                            ? \`<strong style="color:#e67e22;">📝 \${dev.remark}</strong> <span style="font-size:0.9rem;color:#95a5a6;">(原机名: \${dev.name})</span>\`
                            : \`<strong>\${dev.name}</strong>\`;

                        const li = document.createElement('li');
                        li.className = 'device-item';
                        li.innerHTML = \`
                            <div class="device-info">
                                \${displayHtml}
                                <span class="did">ID: \${id}</span>
                            </div>
                            <div class="device-actions">
                                <button class="remark-btn" onclick="setRemark('\${id}', '\${dev.remark || ''}')">修改备注</button>
                                <button class="delete-btn" onclick="deleteDevice('\${id}', '\${dev.name}')">删除设备</button>
                            </div>
                        \`;
                        list.appendChild(li);
                    });
                }
            } catch (err) {
                document.getElementById('deviceList').innerHTML = '<div style="text-align:center; color:red;">加载设备失败，请刷新重试</div>';
            }
        }

        async function setRemark(machineId, currentRemark) {
            const token = document.getElementById('adminToken').value.trim();
            if (!token) { alert('请在上方输入管理员 TOKEN 进行验证！'); document.getElementById('adminToken').focus(); return; }
            
            let newRemark = prompt("请输入此设备的备注名称\\n(留空并保存则清除备注，恢复原机器名):", currentRemark || "");
            if (newRemark === null) return;
            
            try {
                const res = await fetch('/api/set-remark', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ machineId, token, remark: newRemark.trim() })
                });
                const data = await res.json();
                if (res.ok) { alert('✅ 备注设置成功！'); loadAdminDevices(); }
                else { alert('❌ 设置失败: ' + (data.error || '未知错误')); }
            } catch (err) { alert('网络错误'); }
        }

        async function deleteDevice(machineId, machineName) {
            const token = document.getElementById('adminToken').value.trim();
            if (!token) { alert('请在上方输入管理员 TOKEN 进行验证！'); document.getElementById('adminToken').focus(); return; }
            
            if (!confirm(\`确定要永久删除设备 "\${machineName}" 吗？\\n删除后如果客户端仍在运行，可能会再次注册接入。\`)) return;
            try {
                const res = await fetch('/api/delete-device', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ machineId, token }) });
                const data = await res.json();
                if (res.ok) { alert('✅ 删除成功！'); loadAdminDevices(); }
                else { alert('❌ 删除失败: ' + (data.error || '未知错误')); }
            } catch (err) { alert('网络错误，删除失败'); }
        }
    </script>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-cache' } });
}