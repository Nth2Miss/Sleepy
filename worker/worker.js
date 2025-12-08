// worker.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    console.log(`[${new Date().toISOString()}] ${request.method} ${path}`);
    
    try {
      // 处理预检请求
      if (request.method === 'OPTIONS') {
        return handleOptions();
      }
      
      // 路由分发
      if (path === '/' || path === '/index.html') {
        return serveHtml();
      } else if (path === '/api/save-name' && request.method === 'POST') {
        return await handleSaveName(request, env.SLEEPY_KV);
      } else if (path === '/api/get-name' && request.method === 'GET') {
        return await handleGetName(env.SLEEPY_KV);
      } else {
        return new Response('Not Found', { 
          status: 404,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    } catch (error) {
      console.error('Worker处理错误:', error);
      return new Response(
        JSON.stringify({ 
          error: '服务器内部错误',
          details: error.message 
        }),
        { 
          status: 500,
          headers: getCorsHeaders()
        }
      );
    }
  }
}

// CORS 预检请求处理
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

// 公共头部设置
function getCorsHeaders() {
  return {
    'Content-Type': 'application/json;charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// HTML 页面
async function serveHtml() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>正在干嘛呢？</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-image: url('https://r2.nth2miss.cn/bg.jpg');
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            background-attachment: fixed;
            min-height: 100vh;
            padding: 20px;
            margin: 0;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        header {
            text-align: center;
            margin-bottom: 30px;
            color: white;
            padding: 20px;
        }
        
        h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        
        .subtitle {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .status-card {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            padding: 30px;
            margin-bottom: 25px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .status-item {
            text-align: center;
            padding: 20px;
            border-radius: 10px;
            transition: transform 0.3s ease;
        }
        
        .status-item:hover {
            transform: translateY(-5px);
        }
        
        .status-running {
            background: linear-gradient(135deg, #56ab2f, #a8e6cf);
            color: white;
        }
        
        .status-suspended {
            background: linear-gradient(120deg, #ff9a9e, #fad0c4);
            color: white;
        }
        
        .status-offline {
            background: linear-gradient(120deg, #a18cd1, #fbc2eb);
            color: white;
        }
        
        .status-unknown {
            background: linear-gradient(120deg, #f6d365, #fda085);
            color: white;
        }
        
        .status-label {
            font-size: 1rem;
            margin-bottom: 10px;
            font-weight: 600;
        }
        
        .status-value {
            font-size: 1.8rem;
            font-weight: 700;
            word-break: break-word;
        }
        
        .controls {
            text-align: center;
            margin: 20px 0;
        }
        
        .refresh-btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 50px;
            font-size: 1rem;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            transition: all 0.3s ease;
        }
        
        .refresh-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }
        
        .refresh-btn:disabled {
            background: linear-gradient(135deg, #667eea, #764ba2);
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .countdown {
            margin-top: 10px;
            font-size: 0.9rem;
            color: #666;
        }
        
        .last-update {
            text-align: center;
            color: #666;
            font-size: 0.9rem;
            margin-top: 20px;
        }
        
        .device-info {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 10px;
            padding: 20px;
            margin-top: 20px;
        }
        
        .info-title {
            font-size: 1.2rem;
            margin-bottom: 15px;
            color: #333;
            text-align: center;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .info-item {
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        
        .info-label {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 5px;
        }
        
        .info-value {
            font-size: 1.1rem;
            font-weight: 600;
            color: #333;
            word-break: break-word;
        }
        
        footer {
            text-align: center;
            color: rgba(255, 255, 255, 0.7);
            margin-top: 30px;
            font-size: 0.9rem;
        }
        
        @media (max-width: 768px) {
            .status-grid {
                grid-template-columns: 1fr;
            }
            
            h1 {
                font-size: 2rem;
            }
            
            .status-value {
                font-size: 1.5rem;
            }
        }
        
        .pulse {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% {
                box-shadow: 0 0 0 0 rgba(86, 171, 47, 0.4);
            }
            70% {
                box-shadow: 0 0 0 10px rgba(86, 171, 47, 0);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(86, 171, 47, 0);
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🖥️ 正在干嘛呢？</h1>
        </header>
        
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

        // 页面加载时获取数据
        window.addEventListener('DOMContentLoaded', function() {
            document.getElementById('loadTime').textContent = new Date().toLocaleString();
            getCurrentName();
        });

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
            const now = Date.now();
            const refreshBtn = document.getElementById('refreshBtn');
            
            // 检查是否在冷却时间内
            if (now - lastRefreshTime < refreshInterval) {
                return;
            }
            
            // 更新上次刷新时间
            lastRefreshTime = now;
            
            // 禁用按钮并显示倒计时
            refreshBtn.disabled = true;
            updateCountdown();
            
            // 启动倒计时更新
            if (!countdownInterval) {
                countdownInterval = setInterval(updateCountdown, 1000);
            }
            
            try {
                const response = await fetch('/api/get-name');
                const lastCheckElement = document.getElementById('lastCheck');
                lastCheckElement.innerHTML = \`页面加载于: <span id="loadTime"></span> | 最后检查: \${new Date().toLocaleString()}\`;
                document.getElementById('loadTime').textContent = document.getElementById('loadTime').textContent || new Date().toLocaleString();
                
                if (response.ok) {
                    const data = await response.json();
                    updateStatusDisplay(data);
                } else {
                    console.log('获取状态信息失败:', response.status);
                }
            } catch (error) {
                const lastCheckElement = document.getElementById('lastCheck');
                lastCheckElement.textContent = '获取数据失败，请检查网络连接';
                console.log('获取状态信息失败:', error);
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
            
            // 更新运行应用显示
            document.getElementById('runningApp').textContent = data.name || '-';
            
            // 如果运行应用显示为"监听程序已停止"，则将背景更改为红色
            if (data.name === '监听程序已停止') {
                document.getElementById('runningContainer').style.background = 'linear-gradient(120deg, #fad0c4, #ff9a9e)';
            } else {
                // 恢复默认样式
                document.getElementById('runningContainer').style.background = '';
            }
            
            // 更新最后更新时间
            if (data.timestamp) {
                const updateTime = new Date(data.timestamp);
                document.getElementById('lastUpdate').textContent = updateTime.toLocaleString();
            } else {
                document.getElementById('lastUpdate').textContent = '-';
            }
            
            // 更新当前状态显示
            const statusElement = document.getElementById('currentStatus');
            if (data.running === false) {
                statusElement.textContent = '似了喵';
                updateStatusContainer('suspended');
            } else if (data.running === true) {
                statusElement.textContent = '运行中';
                updateStatusContainer('running');
            } else {
                // 默认情况或历史数据
                const now = Date.now();
                const savedAt = data.savedAt || now;
                const fiveMinutes = 5 * 60 * 1000; // 5分钟
                
                if (now - savedAt > fiveMinuTtes) {
                    statusElement.textContent = '似了喵';
                    updateStatusContainer('offline');
                } else {
                    statusElement.textContent = '运行中';
                    updateStatusContainer('running');
                }
            }
            
            // 更新离线时间显示
            const offlineElement = document.getElementById('offlineDuration');
            if (data.savedAt) {
                const savedTime = new Date(data.savedAt);
                const now = Date.now();
                const diffMs = now - data.savedAt;
                
                // 如果超过5分钟认为是离线
                if (diffMs > 5 * 60 * 1000) {
                    const minutes = Math.floor(diffMs / 60000);
                    const hours = Math.floor(minutes / 60);
                    const days = Math.floor(hours / 24);
                    
                    if (days > 0) {
                        offlineElement.textContent = \`\${days}天\`;
                    } else if (hours > 0) {
                        offlineElement.textContent = \`\${hours}小时\`;
                    } else {
                        offlineElement.textContent = \`\${minutes}分钟\`;
                    }
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
                case 'running':
                    container.classList.add('status-running');
                    container.classList.add('pulse');
                    break;
                case 'suspended':
                    container.classList.add('status-suspended');
                    break;
                case 'offline':
                    container.classList.add('status-offline');
                    break;
                default:
                    container.classList.add('status-unknown');
            }
        }
    </script>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'no-cache'
    }
  });
}

// 保存名字到 KV
async function handleSaveName(request, kv) {
  try {
    // 检查是否有请求体
    if (!request.body) {
      return new Response(
        JSON.stringify({ error: '缺少请求数据' }),
        { 
          status: 400,
          headers: getCorsHeaders()
        }
      );
    }
    
    // 解析 JSON
    let data;
    try {
      data = await request.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: '无效的 JSON 数据' }),
        { 
          status: 400,
          headers: getCorsHeaders()
        }
      );
    }
    
    const name = data.name ? data.name.trim() : '';
    
    if (!name) {
      return new Response(
        JSON.stringify({ error: '名字不能为空' }),
        { 
          status: 400,
          headers: getCorsHeaders()
        }
      );
    }
    
    if (name.length > 100) {
      return new Response(
        JSON.stringify({ error: '名字过长' }),
        { 
          status: 400,
          headers: getCorsHeaders()
        }
      );
    }
    
    // 准备存储的数据
    const userData = {
      name: name,
      timestamp: new Date().toISOString(),
      savedAt: Date.now(),
      running: data.running !== undefined ? Boolean(data.running) : undefined
    };
    
    console.log('保存数据到 KV:', userData);
    
    // 保存到 KV
    await kv.put('user_name', JSON.stringify(userData));
    
    // 构建响应数据（过滤掉undefined字段）
    const responseData = {
      success: true,
      message: '保存成功',
      name: userData.name,
      timestamp: userData.timestamp,
      savedAt: userData.savedAt
    };
    
    // 只有当running字段存在时才添加到响应中
    if (userData.running !== undefined) {
      responseData.running = userData.running;
    }
    
    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: getCorsHeaders()
      }
    );
    
  } catch (error) {
    console.error('保存数据错误:', error);
    return new Response(
      JSON.stringify({ 
        error: '保存数据失败',
        message: error.message
      }),
      { 
        status: 500,
        headers: getCorsHeaders()
      }
    );
  }
}

// 从 KV 获取名字
async function handleGetName(kv) {
  try {
    console.log('从 KV 获取数据...');
    
    // 从 KV 获取数据
    const data = await kv.get('user_name', 'json');
    
    if (!data) {
      return new Response(
        JSON.stringify({ 
          exists: false,
          message: '暂无数据'
        }),
        {
          status: 200,
          headers: getCorsHeaders()
        }
      );
    }
    
    console.log('获取到的数据:', data);
    
    // 构建响应数据（过滤掉undefined字段）
    const responseData = {
      exists: true,
      name: data.name,
      timestamp: data.timestamp,
      savedAt: data.savedAt
    };
    
    // 只有当running字段存在时才添加到响应中
    if (data.running !== undefined) {
      responseData.running = data.running;
    }
    
    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: getCorsHeaders()
      }
    );
    
  } catch (error) {
    console.error('获取数据错误:', error);
    return new Response(
      JSON.stringify({ 
        error: '获取数据失败',
        message: error.message
      }),
      { 
        status: 500,
        headers: getCorsHeaders()
      }
    );
  }
}