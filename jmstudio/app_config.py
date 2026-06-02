import os
import json

CONFIG_FILE = "md_viewer_config.json"

def get_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            pass
    return {}

def save_config(config):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=4)
        return True
    except:
        return False

# 설정 로드 및 전역 환경변수 관리
config = get_config()
VERSION = "3.9.25"
APP_NAME = f"Joy Markdown Studio v{VERSION}"
PORT = int(config.get("port", 58220))
BIND_IP = config.get("bind_ip", "0.0.0.0")

DEFAULT_UI_FONT = "Inter"
DEFAULT_EDITOR_FONT = "Fira Code"
DEFAULT_EDITOR_FONT_SIZE = 14
