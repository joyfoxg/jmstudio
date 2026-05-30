import os
import sys
import json
import urllib.parse
from bottle import Bottle, request, response, static_file, HTTPResponse
from app_config import get_config, PORT, BIND_IP
import api_bridge

app = Bottle()

def get_asset_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    if hasattr(sys, '_MEIPASS'):
        # PyInstaller 임시 폴더에서 로드
        return os.path.join(sys._MEIPASS, relative_path)
    # 로컬 개발 소스 디렉터리에서 로드
    return os.path.join(os.path.abspath("."), relative_path)

@app.route('/')
def index():
    # frontend/index.html 정적 파일 서빙
    response.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
    response.set_header("Pragma", "no-cache")
    response.set_header("Expires", "0")
    return static_file("index.html", root=get_asset_path("frontend"))

@app.route('/katex_support')
def katex_support():
    # frontend/katex_support.html 정적 파일 서빙
    response.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
    response.set_header("Pragma", "no-cache")
    response.set_header("Expires", "0")
    return static_file("katex_support.html", root=get_asset_path("frontend"))


@app.route('/static/<filepath:path>')
def serve_static(filepath):
    # frontend/static/ 내의 css, js 등 에셋 서빙
    response.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
    response.set_header("Pragma", "no-cache")
    response.set_header("Expires", "0")
    return static_file(filepath, root=get_asset_path("frontend/static"))

@app.route('/workspace/<filepath:path>')
def serve_workspace_file(filepath):
    # active_workspace 내의 상대 파일 경로 이미지 및 자산 서빙
    if api_bridge.window is None:
        return HTTPResponse(status=500, body="API instance not initialized")
        
    api_instance = api_bridge.window.js_api
    active_workspace = api_instance.workspace
    
    decoded_path = urllib.parse.unquote(filepath)
    full_path = os.path.abspath(os.path.join(active_workspace, decoded_path))
    
    # 보안 검사: workspace 외부 파일 접근 차단 (Directory Traversal 방어)
    if not full_path.startswith(os.path.abspath(active_workspace)):
        return HTTPResponse(status=403, body="Access denied")
        
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return static_file(os.path.basename(full_path), root=os.path.dirname(full_path))
    else:
        return HTTPResponse(status=404, body="File not found")

@app.post('/api/<action>')
def api_endpoint(action):
    # HTTP API 브릿지 (브라우저 직접 접속 원격 환경 지원)
    api_instance = api_bridge.api_instance
    if api_instance is None:
        return HTTPResponse(status=500, body="API instance not initialized")
    
    cfg = get_config()
    configured_password = cfg.get("access_password", "")
    if configured_password:
        provided_password = request.headers.get('X-Access-Password', '')
        if provided_password != configured_password:
            response.status = 401
            response.content_type = 'application/json'
            return json.dumps({"status": "auth_failed", "message": "인증번호가 잘못되었습니다."}, ensure_ascii=False)
            
    try:
        data = request.json or {}
    except:
        data = {}
        
    if hasattr(api_instance, action):
        method = getattr(api_instance, action)
        import inspect
        sig = inspect.signature(method)
        kwargs = {}
        for param in sig.parameters.values():
            if param.name in data:
                kwargs[param.name] = data[param.name]
        try:
            res = method(**kwargs)
            response.content_type = 'application/json'
            return json.dumps(res, ensure_ascii=False)
        except Exception as e:
            response.status = 500
            return json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False)
    else:
        response.status = 404
        return json.dumps({"status": "error", "message": f"Method {action} not found"}, ensure_ascii=False)

def run_server():
    local_ip = api_bridge.get_local_ip()
    print("=======================================================================")
    print("  Joy Markdown Studio Local Server is running!")
    print(f"  - Local Access:    http://127.0.0.1:{PORT}")
    if BIND_IP == "0.0.0.0":
        print(f"  - Network Access:  http://{local_ip}:{PORT}  (For external PCs!)")
    print("=======================================================================")
    try:
        app.run(host=BIND_IP, port=PORT, quiet=True)
    except Exception as e:
        print(f"Server error: {e}")
