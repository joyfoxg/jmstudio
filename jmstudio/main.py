import threading
import webview
from .app_config import APP_NAME, PORT
from .routes import run_server
from .custom_templates import ExtendedMdViewerApi
from . import api_bridge

def main():
    # 1. API 인스턴스 초기 생성
    api = ExtendedMdViewerApi()
    api_bridge.api_instance = api
    
    # 2. Bottle 로컬 서버 백그라운드 구동 (상대 경로 리소스/이미지 서빙용)
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    
    # 3. Bottle 로컬 서버가 포트를 열고 수신 대기할 때까지 대기 (레이스 컨디션 방지)
    import socket
    import time
    
    start_time = time.time()
    while time.time() - start_time < 10.0:
        try:
            with socket.create_connection(("127.0.0.1", PORT), timeout=0.1):
                break
        except (OSError, ConnectionRefusedError):
            time.sleep(0.05)
            
    # 4. PyWebView 데스크톱 윈도우 생성
    # 윈도우 인스턴스를 생성하여 api_bridge 모듈에 바인딩(의존성 주입)
    api_bridge.window = webview.create_window(
        title=APP_NAME,
        url=f"http://127.0.0.1:{PORT}",
        js_api=api,
        width=1400,
        height=900,
        min_size=(1000, 650)
    )
    
    # 5. PyWebView 루프 시작 (디버그 비활성화 및 개발자 도구 숨김)
    webview.start()

if __name__ == "__main__":
    main()
