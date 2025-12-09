import ctypes
import requests
import time
import logging
import os
import sys
from datetime import datetime
# import configparser
# import uuid

# ------------------------------------------------------
# 日志配置
# ------------------------------------------------------
def setup_logging():
    # 获取程序运行目录
    if getattr(sys, 'frozen', False):
        # 如果是打包后的exe文件，则使用exe所在目录
        application_path = os.path.dirname(sys.executable)
    else:
        # 如果是python脚本，则使用脚本所在目录
        application_path = os.path.dirname(os.path.abspath(__file__))
    
    # 创建logs目录（如果不存在）
    log_dir = os.path.join(application_path, "logs")
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    # 清理多余的日志文件，只保留最近的10个
    cleanup_old_logs(log_dir)
    
    # 配置日志格式和文件路径
    log_filename = os.path.join(log_dir, f"sleepy_{datetime.now().strftime('%Y%m%d')}.log")
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_filename, encoding='utf-8'),
            logging.StreamHandler()  # 同时输出到控制台
        ]
    )
    
    return logging.getLogger(__name__)

def cleanup_old_logs(log_dir):
    """清理旧的日志文件，只保留最近的10个"""
    try:
        # 获取所有以sleepy_开头的日志文件
        log_files = [f for f in os.listdir(log_dir) if f.startswith("sleepy_") and f.endswith(".log")]
        
        # 如果日志文件数量超过10个，则删除最旧的
        if len(log_files) > 10:
            # 按文件名排序（按日期）
            log_files.sort()
            
            # 删除最旧的文件直到只剩10个
            files_to_delete = log_files[:len(log_files) - 10]
            for file_to_delete in files_to_delete:
                os.remove(os.path.join(log_dir, file_to_delete))
                print(f"已删除旧日志文件: {file_to_delete}")
    except Exception as e:
        print(f"清理旧日志文件时出错: {e}")

logger = setup_logging()

# ------------------------------------------------------
# 上报函数
# ------------------------------------------------------
def report_status(name, running):
    url = "https://sleepy.nth2miss.cn/api/save-name"
    
    token = "mysleepyApp"
    
    headers = {"content-type": "application/json"}
    
    # 生成时间戳数据
    current_time = datetime.now()
    timestamp_iso = current_time.isoformat()
    saved_at_ms = int(current_time.timestamp() * 1000)
    
    # 生成固定Token（基于机器标识）
    # computer_name = os.environ.get('COMPUTERNAME', '')
    # token = str(uuid.uuid5(uuid.NAMESPACE_DNS, computer_name)).replace('-', '')



    data = {
        "name": name, 
        "running": running,
        "timestamp": timestamp_iso,
        "savedAt": saved_at_ms,
        "token": token
    }

    try:
        requests.post(url, headers=headers, json=data, timeout=2)
        logger.info(f"[上报] {name} -> {running}")
    except Exception as e:
        logger.error(f"[上报失败] {e}")


# ------------------------------------------------------
# Windows 控制台关机事件处理
# ------------------------------------------------------

CTRL_C_EVENT = 0
CTRL_BREAK_EVENT = 1
CTRL_CLOSE_EVENT = 2
CTRL_LOGOFF_EVENT = 5
CTRL_SHUTDOWN_EVENT = 6

# 添加一个全局变量来控制主循环是否继续运行
should_continue = True

HandlerRoutine = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_uint)

def console_handler(event):
    global should_continue
    logger.info(f"[系统事件] 捕获控制事件: {event}")

    if event == CTRL_C_EVENT:
        logger.info("[系统事件] → 用户按下 Ctrl+C")
        report_status("监听程序被中断", False)
        should_continue = False
        return True

    elif event in (CTRL_LOGOFF_EVENT, CTRL_SHUTDOWN_EVENT):
        logger.info("[系统事件] → 系统正在关机/注销")
        report_status("系统关机", False)
        time.sleep(1) 

    elif event == CTRL_CLOSE_EVENT:
        logger.info("[系统事件] → 程序窗口被关闭")
        report_status("监听程序已停止", False)

    return True


handler = HandlerRoutine(console_handler)
ctypes.windll.kernel32.SetConsoleCtrlHandler(handler, True)

# ------------------------------------------------------
# 前台窗口标题
# ------------------------------------------------------
import ctypes
from ctypes import wintypes

user32 = ctypes.windll.user32

def get_foreground_window_title():
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return ""

    length = user32.GetWindowTextLengthW(hwnd)
    if length == 0:
        return ""

    buf = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buf, length + 1)
    return buf.value

# ------------------------------------------------------
# 主循环
# ------------------------------------------------------
def main():
    # config = configparser.ConfigParser()
    # config.read("config.ini", encoding="utf-8")
    # wait_time = int(config["config"].get("wait_time", 60))
    wait_time = 60

    logger.info("程序启动")
    report_status("系统启动", True)

    while should_continue:
        title = get_foreground_window_title()

        if title.strip():
            report_status(title, True)
        else:
            report_status("空闲", True)

        # 记录当前活动窗口标题
        logger.info(f"当前窗口: {title if title.strip() else '空闲'}")
        
        # 分段睡眠以便能够及时响应 should_continue 变化
        for _ in range(wait_time):
            if not should_continue:
                break
            time.sleep(1)


if __name__ == "__main__":
    try:
        main()
        logger.info("程序正常退出")
    except KeyboardInterrupt:
        logger.info("程序被用户中断")
    except Exception as e:
        logger.error(f"程序发生未捕获的异常: {e}")