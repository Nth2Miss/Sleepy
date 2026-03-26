import ctypes
import requests
import time
import logging
import os
import sys
from datetime import datetime
import socket
import uuid

# ------------------------------------------------------
# 日志配置
# ------------------------------------------------------
def setup_logging():
    if getattr(sys, 'frozen', False):
        application_path = os.path.dirname(sys.executable)
    else:
        application_path = os.path.dirname(os.path.abspath(__file__))
    
    log_dir = os.path.join(application_path, "logs")
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    log_filename = os.path.join(log_dir, f"sleepy_{datetime.now().strftime('%Y%m%d')}.log")
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[logging.FileHandler(log_filename, encoding='utf-8'), logging.StreamHandler()]
    )
    return logging.getLogger(__name__)

logger = setup_logging()

# ------------------------------------------------------
# 上报函数
# ------------------------------------------------------
def report_status(name, running):
    url = "https://sleepy.nth2miss.cn/api/save-name"  # 请确保这里是你的 Worker 域名
    token = "mysleepyApp"                             # 请确保与 Worker 环境变量 TOKEN 一致
    headers = {"content-type": "application/json"}
    
    current_time = datetime.now()
    timestamp_iso = current_time.isoformat()
    saved_at_ms = int(current_time.timestamp() * 1000)
    
    machine_name = socket.gethostname()
    machine_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, machine_name)).replace('-', '')

    data = {
        "name": name, 
        "running": running,
        "timestamp": timestamp_iso,
        "savedAt": saved_at_ms,
        "token": token,
        "machineId": machine_id,
        "machineName": machine_name
    }

    try:
        response = requests.post(url, headers=headers, json=data, timeout=5)
        res_json = response.json()
        logger.info(f"[上报] {machine_name} -> {name} | 服务端: {res_json.get('message', '未知')}")
    except Exception as e:
        logger.error(f"[上报失败] {e}")

# ------------------------------------------------------
# Windows 控制台关机事件处理
# ------------------------------------------------------
should_continue = True
HandlerRoutine = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_uint)

def console_handler(event):
    global should_continue
    if event == 0: 
        report_status("监听程序被中断", False)
        should_continue = False
    elif event in (5, 6): 
        report_status("系统关机", False)
        time.sleep(1) 
    elif event == 2: 
        report_status("监听程序已停止", False)
    return True

ctypes.windll.kernel32.SetConsoleCtrlHandler(HandlerRoutine(console_handler), True)

user32 = ctypes.windll.user32
def get_foreground_window_title():
    hwnd = user32.GetForegroundWindow()
    if not hwnd: return ""
    length = user32.GetWindowTextLengthW(hwnd)
    if length == 0: return ""
    buf = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buf, length + 1)
    return buf.value

# ------------------------------------------------------
# 主循环 (固定每 60 秒上报一次)
# ------------------------------------------------------
def main():
    logger.info("程序启动")
    report_status("系统启动", True)
    
    report_interval = 60  # 固定 60 秒上报一次

    while should_continue:
        title = get_foreground_window_title().strip() or "空闲"
        report_status(title, True)
        
        # 分段睡眠响应系统退出事件
        for _ in range(report_interval):
            if not should_continue:
                break
            time.sleep(1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass