import os
import sys
import json
import socket
import threading
import webview
import shutil
import tempfile
import urllib.parse
from bottle import Bottle, request, response, static_file, HTTPResponse

# 설정 파일 명칭 선언
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

# 설정 로드 및 환경변수 지정
config = get_config()
APP_NAME = "Joy Markdown Studio v3.61"
PORT = int(config.get("port", 58220))
BIND_IP = config.get("bind_ip", "0.0.0.0")

# Flask/Bottle 앱 초기화
app = Bottle()
active_workspace = os.path.abspath(os.getcwd())

if "last_workspace" in config and os.path.exists(config["last_workspace"]):
    active_workspace = os.path.abspath(config["last_workspace"])

# API 인스턴스 전역 바인딩
api = None

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

# Bottle 라우팅
@app.route('/')
def index():
    return HTML_CONTENT

@app.route('/workspace/<filepath:path>')
def serve_workspace_file(filepath):
    global active_workspace
    # URL 디코딩
    decoded_path = urllib.parse.unquote(filepath)
    full_path = os.path.abspath(os.path.join(active_workspace, decoded_path))
    
    # 보안 검사: workspace 외부 파일 접근 차단
    if not full_path.startswith(os.path.abspath(active_workspace)):
        return HTTPResponse(status=403, body="Access denied")
        
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return static_file(os.path.basename(full_path), root=os.path.dirname(full_path))
    else:
        return HTTPResponse(status=404, body="File not found")

# HTTP API 브릿지 (브라우저 직접 접속 환경 지원)
@app.post('/api/<action>')
def api_bridge(action):
    global api
    if api is None:
        api = MdViewerApi()
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
    if hasattr(api, action):
        method = getattr(api, action)
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
    local_ip = get_local_ip()
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

# API 클래스 (JS -> Python 호출용)
class MdViewerApi:
    def __init__(self):
        global active_workspace
        self.workspace = active_workspace

    def get_initial_state(self):
        cfg = get_config()
        return {
            "workspace": self.workspace,
            "theme": cfg.get("theme", "dark"),
            "last_file": cfg.get("last_file", ""),
            "files": self.list_files(),
            "port": cfg.get("port", PORT),
            "bind_ip": cfg.get("bind_ip", BIND_IP),
            "access_password": cfg.get("access_password", ""),
            "local_ip": get_local_ip()
        }

    def save_network_settings(self, bind_ip, port, access_password):
        try:
            cfg = get_config()
            cfg["bind_ip"] = bind_ip
            cfg["port"] = int(port)
            cfg["access_password"] = access_password.strip()
            save_config(cfg)
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def open_library_folder(self):
        try:
            # 윈도우 탐색기(Explorer)로 물리적 서재 폴더 열기
            os.startfile(self.workspace)
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def add_documents_to_library(self):
        global window
        try:
            file_paths = window.create_file_dialog(
                webview.OPEN_DIALOG,
                allow_multiple=True,
                file_types=('Markdown Documents (*.md;*.qmd;*.markdown;*.txt)', 'All files (*.*)')
            )
            if file_paths:
                added_count = 0
                new_paths = []
                for path in file_paths:
                    if os.path.exists(path) and os.path.isfile(path):
                        # 절대 경로 포맷 표준화 (백슬래시 -> 슬래시)
                        norm_path = os.path.abspath(path).replace('\\', '/')
                        new_paths.append(norm_path)
                        added_count += 1
                        
                if added_count > 0:
                    cfg = get_config()
                    added_docs = cfg.get("added_documents", [])
                    for p in new_paths:
                        if p not in added_docs:
                            added_docs.append(p)
                    cfg["added_documents"] = added_docs
                    save_config(cfg)
                    
                    return {
                        "status": "success",
                        "message": f"{added_count}개의 문서가 원래 위치 그대로 서재에 추가되었습니다.",
                        "files": self.list_files()
                    }
            return {"status": "cancel"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def list_files(self):
        cfg = get_config()
        if "added_documents" not in cfg:
            # 최초 업그레이드 기동 시
            initial_docs = []
            try:
                for item in sorted(os.listdir(self.workspace)):
                    if item.startswith('.') or os.path.isdir(os.path.join(self.workspace, item)):
                        continue
                    if item.lower().endswith(('.md', '.qmd', '.markdown', '.txt')):
                        initial_docs.append(item)
            except:
                pass
            cfg["added_documents"] = initial_docs
            save_config(cfg)
            
        added_docs = cfg.get("added_documents", [])
        
        # 실제 물리 디스크에 존재하는지 검사 및 누락 파일 자동 제거 (상대/절대 경로 통합)
        valid_docs = []
        changed = False
        for path in added_docs:
            if os.path.isabs(path):
                full_path = path
            else:
                full_path = os.path.join(self.workspace, path)
                
            if os.path.exists(full_path) and os.path.isfile(full_path):
                valid_docs.append(path)
            else:
                changed = True
                
        if changed:
            cfg["added_documents"] = valid_docs
            save_config(cfg)
            
        # 상대 경로 트리와 절대 경로 외부 파일 트리 분할 빌드 후 병합
        relative_paths = [p for p in valid_docs if not os.path.isabs(p)]
        tree = self._build_tree_from_paths(relative_paths)
        
        # 외부 파일 추가
        for p in sorted(valid_docs):
            if os.path.isabs(p):
                filename = os.path.basename(p)
                size = os.path.getsize(p) if os.path.exists(p) else 0
                tree.append({
                    "name": f"📄 {filename}",
                    "type": "file",
                    "path": p,
                    "size": size,
                    "is_external": True
                })
        return tree

    def _build_tree_from_paths(self, paths):
        root = {}
        for path in sorted(paths):
            parts = path.split('/')
            current = root
            current_path_parts = []
            for i, part in enumerate(parts):
                current_path_parts.append(part)
                current_path = "/".join(current_path_parts)
                
                is_file = (i == len(parts) - 1)
                
                if part not in current:
                    if is_file:
                        full_path = os.path.join(self.workspace, path)
                        size = os.path.getsize(full_path) if os.path.exists(full_path) else 0
                        current[part] = {
                            "_data": {
                                "name": part,
                                "type": "file",
                                "path": path,
                                "size": size
                            }
                        }
                    else:
                        current[part] = {
                            "_data": {
                                "name": part,
                                "type": "folder",
                                "path": current_path,
                                "children": []
                            }
                        }
                current = current[part]
                
        def convert(node):
            res = []
            for key, val in sorted(node.items()):
                if key == "_data":
                    continue
                data = val["_data"].copy()
                if data["type"] == "folder":
                    data["children"] = convert(val)
                res.append(data)
            return res
            
        return convert(root)

    def read_file(self, rel_path):
        if os.path.isabs(rel_path):
            full_path = os.path.abspath(rel_path)
        else:
            full_path = os.path.abspath(os.path.join(self.workspace, rel_path))
            if not full_path.startswith(self.workspace):
                return {"status": "error", "message": "Access denied"}
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # 마지막 파일 기록
            cfg = get_config()
            cfg["last_file"] = rel_path
            save_config(cfg)
            
            return {"status": "success", "content": content, "path": rel_path}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def save_file(self, rel_path, content):
        if os.path.isabs(rel_path):
            full_path = os.path.abspath(rel_path)
        else:
            full_path = os.path.abspath(os.path.join(self.workspace, rel_path))
            if not full_path.startswith(self.workspace):
                return {"status": "error", "message": "Access denied"}
        try:
            # 부모 디렉토리가 없으면 생성
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def create_item(self, rel_path, item_type):
        full_path = os.path.abspath(os.path.join(self.workspace, rel_path))
        if not full_path.startswith(self.workspace):
            return {"status": "error", "message": "Access denied"}
        try:
            if item_type == "folder":
                os.makedirs(full_path, exist_ok=True)
            else:
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                with open(full_path, "w", encoding="utf-8") as f:
                    f.write("")
                # 서재 목록에 추가
                cfg = get_config()
                added_docs = cfg.get("added_documents", [])
                if rel_path not in added_docs:
                    added_docs.append(rel_path)
                    cfg["added_documents"] = added_docs
                    save_config(cfg)
            return {"status": "success", "files": self.list_files()}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def delete_item(self, rel_path):
        try:
            # 사용자의 소중한 원본 파일 보호를 위해 디스크 파일은 영구 삭제하지 않고,
            # 오직 '내 서재' 목록 데이터베이스에서만 제외(Unregister)합니다.
            cfg = get_config()
            added_docs = cfg.get("added_documents", [])
            added_docs = [p for p in added_docs if p != rel_path and not p.startswith(rel_path + "/")]
            cfg["added_documents"] = added_docs
            save_config(cfg)
            return {"status": "success", "files": self.list_files()}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def rename_item(self, old_rel_path, new_rel_path):
        old_full = os.path.abspath(os.path.join(self.workspace, old_rel_path))
        new_full = os.path.abspath(os.path.join(self.workspace, new_rel_path))
        if not old_full.startswith(self.workspace) or not new_full.startswith(self.workspace):
            return {"status": "error", "message": "Access denied"}
        try:
            os.rename(old_full, new_full)
            # 서재 목록 경로 동기화 업데이트
            cfg = get_config()
            added_docs = cfg.get("added_documents", [])
            new_added_docs = []
            for p in added_docs:
                if p == old_rel_path:
                    new_added_docs.append(new_rel_path)
                elif p.startswith(old_rel_path + "/"):
                    suffix = p[len(old_rel_path):]
                    new_added_docs.append(new_rel_path + suffix)
                else:
                    new_added_docs.append(p)
            cfg["added_documents"] = new_added_docs
            save_config(cfg)
            return {"status": "success", "files": self.list_files()}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def search_pubchem_smiles(self, compound_name):
        import urllib.request
        import urllib.parse
        try:
            # 1. 공백 제거 및 URL 인코딩
            encoded_name = urllib.parse.quote(compound_name.strip())
            
            # PubChem PUG REST API 호출 (CanonicalSMILES와 SMILES 모두 요청하여 호환성 확보)
            url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{encoded_name}/property/CanonicalSMILES,SMILES/JSON"
            
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode('utf-8'))
                
            properties = data.get("PropertyTable", {}).get("Properties", [])
            if properties:
                cid = properties[0].get("CID")
                # PubChem API 키 이름 변경에 유연하게 대응하기 위해 여러 후보 키 검사
                smiles = properties[0].get("CanonicalSMILES") or properties[0].get("SMILES") or properties[0].get("ConnectivitySMILES")
                
                if smiles:
                    return {
                        "status": "success",
                        "cid": cid,
                        "smiles": smiles,
                        "name": compound_name
                    }
            return {"status": "error", "message": "화합물은 발견되었으나 분자식을 찾을 수 없습니다."}
        except Exception as e:
            # 한글 검색어 실패 대비 주요 한글-영어 화합물 로컬 매핑 테이블 운영
            korean_mapping = {
                "아스피린": "aspirin",
                "타이레놀": "acetaminophen",
                "아세트아미노펜": "acetaminophen",
                "카페인": "caffeine",
                "니코틴": "nicotine",
                "포도당": "glucose",
                "설탕": "sucrose",
                "물": "water",
                "이산화탄소": "carbon dioxide",
                "암모니아": "ammonia",
                "황산": "sulfuric acid",
                "염산": "hydrochloric acid",
                "메탄": "methane",
                "에탄올": "ethanol",
                "아세톤": "acetone",
                "벤젠": "benzene",
                "톨루엔": "toluene",
                "페놀": "phenol",
                "아닐린": "aniline",
                "글리신": "glycine",
                "알라닌": "alanine",
                "이부프로펜": "ibuprofen",
                "페니실린": "penicillin G",
                "멘톨": "menthol",
                "비타민c": "ascorbic acid",
                "비타민 c": "ascorbic acid",
                "구연산": "citric acid",
                "시트르산": "citric acid",
                "캡사이신": "capsaicin",
                "도파민": "dopamine",
                "세로토닌": "serotonin",
                "아드레날린": "epinephrine",
                "멜라토닌": "melatonin"
            }
            clean_name = compound_name.strip().lower()
            if clean_name in korean_mapping:
                return self.search_pubchem_smiles(korean_mapping[clean_name])
            return {"status": "error", "message": f"PubChem 검색 실패: {str(e)}"}

    def save_theme(self, theme_name):
        cfg = get_config()
        cfg["theme"] = theme_name
        save_config(cfg)
        return {"status": "success"}

    def export_html(self, rel_path, html_body, title):
        # 마크다운 파일과 동일한 경로에 확장자만 html로 바꾸어 저장
        base_no_ext, _ = os.path.splitext(rel_path)
        dest_rel = base_no_ext + ".html"
        dest_full = os.path.abspath(os.path.join(self.workspace, dest_rel))
        
        # 완전한 독립형 HTML 템플릿 제작
        standalone_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{title}</title>
    <!-- 구글 폰트 및 라이브러리 CDN 로드 -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css">
    
    <style>
        :root {{
            --bg-primary: #0d0e12;
            --bg-secondary: #14161e;
            --text-main: #e2e8f0;
            --text-muted: #94a3b8;
            --accent: #45f3ff;
            --accent-glow: rgba(69, 243, 255, 0.15);
            --border-color: rgba(255, 255, 255, 0.08);
            --callout-note: #3b82f6;
            --callout-tip: #10b981;
            --callout-warning: #f59e0b;
            --callout-important: #ef4444;
        }}
        body {{
            background-color: var(--bg-primary);
            color: var(--text-main);
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 40px 20px;
            display: flex;
            justify-content: center;
        }}
        .container {{
            max-width: 860px;
            width: 100%;
        }}
        /* 마크다운 렌더링 스타일 */
        h1, h2, h3, h4, h5, h6 {{
            font-family: 'Outfit', sans-serif;
            color: #ffffff;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
        }}
        h1 {{ border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; font-size: 2.2em; }}
        h2 {{ border-bottom: 1px solid var(--border-color); padding-bottom: 0.2em; font-size: 1.6em; }}
        p {{ line-height: 1.7; font-size: 1.05em; color: #cbd5e1; }}
        a {{ color: var(--accent); text-decoration: none; border-bottom: 1px dashed var(--accent); }}
        a:hover {{ filter: brightness(1.2); }}
        
        pre {{
            background: var(--bg-secondary) !important;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 16px;
            overflow-x: auto;
        }}
        code {{
            font-family: 'Fira Code', monospace;
            font-size: 0.95em;
        }}
        :not(pre) > code {{
            background: rgba(255, 255, 255, 0.06);
            color: var(--accent);
            padding: 2px 6px;
            border-radius: 4px;
        }}
        
        /* 콜아웃 상자 */
        .callout {{
            border-left: 4px solid var(--callout-note);
            background: rgba(59, 130, 246, 0.05);
            border-radius: 6px;
            padding: 16px;
            margin: 20px 0;
        }}
        .callout-header {{
            font-weight: 600;
            margin-bottom: 8px;
            color: #ffffff;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .callout-note {{ border-left-color: var(--callout-note); background: rgba(59, 130, 246, 0.06); }}
        .callout-tip {{ border-left-color: var(--callout-tip); background: rgba(16, 185, 129, 0.06); }}
        .callout-warning {{ border-left-color: var(--callout-warning); background: rgba(245, 158, 11, 0.06); }}
        .callout-important, .callout-caution {{ border-left-color: var(--callout-important); background: rgba(239, 68, 68, 0.06); }}
        
        /* Mermaid & LaTeX */
        .mermaid-container {{
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            display: flex;
            justify-content: center;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        th, td {{
            border: 1px solid var(--border-color);
            padding: 12px;
            text-align: left;
        }}
        th {{
            background: rgba(255, 255, 255, 0.03);
            font-weight: 600;
        }}
    </style>
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs';
        mermaid.initialize({{ startOnLoad: true, theme: 'dark' }});
    </script>
</head>
<body>
    <div class="container">
        {html_body}
    </div>
</body>
</html>
"""
        try:
            with open(dest_full, "w", encoding="utf-8") as f:
                f.write(standalone_html)
            return {"status": "success", "dest": dest_rel}
        except Exception as e:
            return {"status": "error", "message": str(e)}

# 내장 프론트엔드 HTML
HTML_CONTENT = """<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Joy Markdown Studio v3.51</title>
    <!-- 외부 라이브러리 CDN 로드 -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css">
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
    <script src="https://unpkg.com/smiles-drawer@2.0.1/dist/smiles-drawer.min.js"></script>
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs';
        window.mermaid = mermaid;
        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'loose',
            flowchart: { useMaxWidth: false, htmlLabels: true }
        });
    </script>
    <script src="https://cdn.jsdelivr.net/npm/lucide@0.263.0/dist/umd/lucide.min.js"></script>
    
    <style>
        :root {
            /* 테마 변수 (Dark가 기본) */
            --bg-app: #090a0f;
            --bg-sidebar: rgba(15, 17, 26, 0.75);
            --bg-card: #121420;
            --border: rgba(255, 255, 255, 0.08);
            --text-main: #e2e8f0;
            --text-muted: #64748b;
            --accent: #45f3ff;
            --accent-glow: rgba(69, 243, 255, 0.12);
            --accent-hover: #3be0eb;
            --editor-bg: #0e1017;
            --editor-gutter: #161a24;
            --editor-text: #e2e8f0;
            
            --callout-note: #3b82f6;
            --callout-tip: #10b981;
            --callout-warning: #f59e0b;
            --callout-important: #ef4444;
            
            --panel-width-explorer: 290px;
            --panel-width-toc: 240px;
        }

        .theme-light {
            --bg-app: #f8fafc;
            --bg-sidebar: rgba(241, 245, 249, 0.85);
            --bg-card: #ffffff;
            --border: rgba(0, 0, 0, 0.08);
            --text-main: #1e293b;
            --text-muted: #64748b;
            --accent: #0284c7;
            --accent-glow: rgba(2, 132, 199, 0.1);
            --accent-hover: #0369a1;
            --editor-bg: #ffffff;
            --editor-gutter: #f1f5f9;
            --editor-text: #0f172a;
        }

        * {
            box-sizing: border-box;
            user-select: none;
        }

        body {
            background-color: var(--bg-app);
            color: var(--text-main);
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 0;
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            transition: background-color 0.3s ease, color 0.3s ease;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* 스크롤바 디자인 */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
        }
        .theme-light ::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.1);
        }
        ::-webkit-scrollbar-thumb:hover {
            background: var(--accent);
        }

        /* 헤더 탑 바 */
        header {
            height: 60px;
            background: var(--bg-sidebar);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            backdrop-filter: blur(12px);
            z-index: 100;
        }

        .brand-section {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .brand-logo {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, var(--accent), #ad5389);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            box-shadow: 0 0 15px var(--accent-glow);
        }

        .brand-title {
            font-family: 'Outfit', sans-serif;
            font-size: 1.25em;
            font-weight: 700;
            background: linear-gradient(90deg, #ffffff, var(--text-muted));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .theme-light .brand-title {
            background: linear-gradient(90deg, #0f172a, #64748b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .workspace-path {
            font-size: 0.85em;
            color: var(--text-muted);
            background: rgba(255, 255, 255, 0.04);
            padding: 6px 12px;
            border-radius: 6px;
            border: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 8px;
            max-width: 400px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            cursor: pointer;
        }
        .workspace-path:hover {
            border-color: var(--accent);
            color: var(--accent);
        }
        .add-doc-btn {
            font-size: 0.85em;
            color: var(--accent);
            background: var(--accent-glow);
            padding: 6px 12px;
            border-radius: 6px;
            border: 1px solid var(--accent);
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: 'Outfit', sans-serif;
            font-weight: 500;
        }
        .add-doc-btn:hover {
            background: var(--accent);
            color: #0d0e12;
            box-shadow: 0 0 10px var(--accent-glow);
        }
        .theme-light .add-doc-btn:hover {
            color: #ffffff;
        }

        .view-mode-toggles {
            display: flex;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border);
            padding: 4px;
            border-radius: 8px;
        }

        .mode-btn {
            background: transparent;
            border: none;
            color: var(--text-muted);
            padding: 6px 16px;
            border-radius: 6px;
            font-size: 0.9em;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
        }

        .mode-btn.active {
            background: var(--accent);
            color: #090a0f !important;
            font-weight: 600;
            box-shadow: 0 0 10px var(--accent-glow);
        }
        .theme-light .mode-btn.active {
            color: #ffffff !important;
        }

        .mode-btn:hover:not(.active) {
            color: var(--text-main);
        }

        .action-group {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .btn {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border);
            color: var(--text-main);
            padding: 8px 14px;
            border-radius: 6px;
            font-size: 0.85em;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
        }

        .btn:hover {
            border-color: var(--accent);
            box-shadow: 0 0 10px var(--accent-glow);
            color: var(--accent);
        }

        .btn-accent {
            background: var(--accent);
            color: #090a0f;
            border: none;
            font-weight: 600;
        }
        .theme-light .btn-accent {
            color: #ffffff;
        }
        .btn-accent:hover {
            background: var(--accent-hover);
            color: #090a0f;
        }

        /* 메인 컨테이너 */
        main {
            flex: 1;
            display: flex;
            overflow: hidden;
            position: relative;
        }

        /* 사이드바 - 파일 익스플로러 */
        .sidebar {
            width: var(--panel-width-explorer);
            background: var(--bg-sidebar);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            backdrop-filter: blur(12px);
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden; /* 사이드바 내용이 삐져나가지 않도록 hidden으로 복원 */
            position: relative;
        }

        .sidebar.collapsed {
            width: 0 !important;
            border-right: none !important;
        }

        /* 슬라이딩 숨기기/나오기 핸들 (좌측 사이드바) */
        .sidebar-slide-toggle {
            position: absolute;
            left: var(--panel-width-explorer);
            top: 50%;
            transform: translate(-50%, -50%);
            width: 16px;
            height: 60px;
            background: var(--accent); /* 눈에 확 띄는 메인 악센트 컬러 */
            border: 1px solid var(--accent);
            border-radius: 0 8px 8px 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #090a0f !important; /* 고대비 어두운 아이콘 */
            cursor: pointer;
            z-index: 999;
            transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s, color 0.2s, width 0.2s;
            backdrop-filter: blur(12px);
            box-shadow: 0 0 12px var(--accent-glow);
            padding: 0;
        }
        
        .theme-light .sidebar-slide-toggle {
            color: #ffffff !important;
        }
        
        /* 사이드바가 접혔을 때 토글 핸들이 화면 왼쪽 가장자리(x=0)에 딱 달라붙어 전체가 다 보이도록 설정 */
        .sidebar.collapsed + .sidebar-slide-toggle {
            left: 0 !important;
            transform: translate(0, -50%) !important;
            border-left: none !important;
        }

        .sidebar-slide-toggle:hover {
            background: var(--accent-hover);
            color: #090a0f !important;
            width: 20px;
            box-shadow: 0 0 18px var(--accent);
        }
        .sidebar-slide-toggle i {
            pointer-events: none;
        }

        /* 슬라이딩 숨기기/나오기 핸들 (우측 TOC 사이드바) */
        .toc-slide-toggle {
            position: absolute;
            right: var(--panel-width-toc);
            top: 50%;
            transform: translate(50%, -50%);
            width: 16px;
            height: 60px;
            background: var(--accent); /* 눈에 확 띄는 메인 악센트 컬러 */
            border: 1px solid var(--accent);
            border-radius: 8px 0 0 8px; /* 왼쪽이 둥글도록 설정 */
            display: flex;
            align-items: center;
            justify-content: center;
            color: #090a0f !important;
            cursor: pointer;
            z-index: 999;
            transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s, color 0.2s, width 0.2s;
            backdrop-filter: blur(12px);
            box-shadow: 0 0 12px var(--accent-glow);
            padding: 0;
        }
        
        .theme-light .toc-slide-toggle {
            color: #ffffff !important;
        }
        
        /* 우측 TOC가 접혔을 때 토글 핸들이 화면 오른쪽 가장자리(right=0)에 딱 달라붙도록 설정 */
        .toc-pane.collapsed + .toc-slide-toggle {
            right: 0 !important;
            transform: translate(0, -50%) !important;
            border-right: none !important;
        }

        .toc-slide-toggle:hover {
            background: var(--accent-hover);
            color: #090a0f !important;
            width: 20px;
            box-shadow: 0 0 18px var(--accent);
        }
        .toc-slide-toggle i {
            pointer-events: none;
        }

        /* 사이드바 탭 버튼 텍스트 줄바꿈 방지 */
        .sidebar-tab-btn {
            white-space: nowrap !important;
            font-size: 0.72em !important;
            padding: 12px 2px !important;
            gap: 4px !important;
        }

        .sidebar-header {
            padding: 16px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .sidebar-title {
            font-family: 'Outfit', sans-serif;
            font-weight: 600;
            font-size: 0.95em;
            letter-spacing: 0.5px;
            color: var(--text-main);
        }

        .sidebar-actions {
            display: flex;
            gap: 6px;
        }

        .icon-btn {
            background: transparent;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        .icon-btn:hover {
            color: var(--accent);
            background: rgba(255, 255, 255, 0.05);
        }
        
        .icon-btn-sm {
            background: transparent;
            border: 1px solid var(--border);
            border-radius: 4px;
            color: var(--text-muted);
            width: 26px;
            height: 26px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
        }
        .icon-btn-sm:hover {
            color: var(--accent);
            border-color: var(--accent);
            background: rgba(255, 255, 255, 0.05);
        }
        .theme-light .icon-btn-sm:hover {
            background: rgba(0, 0, 0, 0.04);
        }
        
        /* 수식 입력기 스타일 */
        .math-section {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .math-section-title {
            font-family: 'Outfit', sans-serif;
            font-size: 0.8em;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .math-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }
        .math-grid-small {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
        }
        .math-item {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 10px 6px;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            color: var(--text-main);
            transition: all 0.2s ease;
        }
        .math-item:hover {
            border-color: var(--accent);
            background: rgba(69, 243, 255, 0.05);
            transform: translateY(-1px);
        }
        .math-item span {
            font-size: 0.75em;
            color: var(--text-muted);
            font-weight: 500;
        }
        .math-item-small {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border);
            border-radius: 4px;
            padding: 6px 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.9em;
            color: var(--text-main);
            transition: all 0.2s ease;
        }
        .math-item-small:hover {
            border-color: var(--accent);
            background: rgba(69, 243, 255, 0.05);
        }
        
        .theme-light .math-item, .theme-light .math-item-small {
            background: rgba(0, 0, 0, 0.01);
        }
        .theme-light .math-item:hover, .theme-light .math-item-small:hover {
            background: rgba(2, 132, 199, 0.05);
        }

        /* 파일 트리 뷰 */
        .file-tree {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
        }

        .tree-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 8px;
            border-radius: 6px;
            font-size: 0.9em;
            cursor: pointer;
            margin-bottom: 2px;
            color: var(--text-main);
            transition: all 0.15s ease;
            position: relative;
        }

        .tree-item:hover {
            background: rgba(255, 255, 255, 0.04);
            color: var(--accent);
        }
        .theme-light .tree-item:hover {
            background: rgba(0, 0, 0, 0.03);
        }

        .tree-item.active {
            background: var(--accent-glow);
            color: var(--accent);
            font-weight: 500;
            border-left: 3px solid var(--accent);
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
        }

        .tree-folder-children {
            margin-left: 12px;
            border-left: 1px dashed var(--border);
            padding-left: 8px;
            display: none;
        }

        .tree-folder-children.open {
            display: block;
        }

        .tree-item-actions {
            position: absolute;
            right: 6px;
            display: none;
            gap: 4px;
        }

        .tree-item:hover .tree-item-actions {
            display: flex;
        }

        /* 편집기 & 프리뷰 스플릿 레이아웃 */
        .workspace-panes {
            flex: 1;
            display: flex;
            overflow: hidden;
            background-color: var(--bg-app);
            position: relative;
        }

        .pane {
            flex: 1;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
        }

        /* 드래그 가능한 조절선 스타일 */
        .resizer-gutter {
            width: 6px;
            background: var(--border);
            cursor: col-resize;
            transition: background 0.15s, width 0.15s;
            position: relative;
            z-index: 100;
            display: block; /* 스플릿 모드에서 기본 표시 */
            flex-shrink: 0;
        }
        .resizer-gutter:hover, .resizer-gutter.dragging {
            background: var(--accent);
            width: 8px;
        }
        .resizer-gutter::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 2px;
            height: 30px;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 1px;
            transition: background 0.15s;
        }
        .resizer-gutter:hover::after, .resizer-gutter.dragging::after {
            background: rgba(255, 255, 255, 0.6);
        }

        .pane-header {
            height: 38px;
            background: rgba(255, 255, 255, 0.02);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
            font-size: 0.8em;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* 편집기 전용 스타일 */
        .editor-container {
            flex: 1;
            display: flex;
            background: var(--editor-bg);
            position: relative;
            overflow: hidden;
        }

        .editor-gutter {
            width: 45px;
            background: var(--editor-gutter);
            border-right: 1px solid var(--border);
            padding: 16px 0;
            text-align: right;
            padding-right: 10px;
            font-family: 'Fira Code', monospace;
            font-size: 13px;
            color: var(--text-muted);
            line-height: 20px;
            user-select: none;
            overflow: hidden;
        }

        .editor-textarea {
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            color: var(--editor-text);
            font-family: 'Fira Code', monospace;
            font-size: 13.5px;
            line-height: 20px;
            padding: 16px;
            resize: none;
            overflow-y: auto;
            white-space: pre;
            word-wrap: normal;
            tab-size: 4;
            user-select: text;
        }

        /* 프리뷰 영역 스타일 */
        .preview-pane {
            flex: 1;
            overflow-y: auto;
            padding: 40px;
            background: var(--bg-card);
            user-select: text;
            scroll-behavior: smooth;
        }
        
        /* 문서 전체화면 모드 대응 */
        #preview-pane:fullscreen {
            padding: 60px 40px !important;
            background: var(--bg-card) !important;
            overflow-y: auto !important;
        }
        #preview-pane:fullscreen .markdown-body {
            max-width: 900px !important;
            margin: 0 auto !important;
            padding-bottom: 80px;
        }

        /* 마크다운 렌더링 세부 스타일 */
        .markdown-body {
            max-width: 800px;
            margin: 0 auto;
            line-height: 1.7;
            font-size: 1.05em;
        }

        .markdown-body h1, .markdown-body h2, .markdown-body h3, 
        .markdown-body h4, .markdown-body h5, .markdown-body h6 {
            font-family: 'Outfit', sans-serif;
            color: var(--text-main);
            margin-top: 1.6em;
            margin-bottom: 0.6em;
            font-weight: 600;
        }

        .markdown-body h1 {
            font-size: 2.1em;
            border-bottom: 1px solid var(--border);
            padding-bottom: 0.3em;
        }

        .markdown-body h2 {
            font-size: 1.6em;
            border-bottom: 1px solid var(--border);
            padding-bottom: 0.25em;
        }

        .markdown-body h3 { font-size: 1.3em; }

        .markdown-body p {
            margin-top: 0;
            margin-bottom: 1.1em;
            color: var(--text-main);
            opacity: 0.9;
        }

        .markdown-body a {
            color: var(--accent);
            text-decoration: none;
            border-bottom: 1px dashed var(--accent);
            transition: all 0.2s;
        }

        .markdown-body a:hover {
            color: var(--accent-hover);
            border-bottom-style: solid;
        }

        .markdown-body pre {
            background: rgba(255, 255, 255, 0.03) !important;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            margin: 1.2em 0;
            overflow-x: auto;
            position: relative;
        }
        .theme-light .markdown-body pre {
            background: #f8fafc !important;
        }

        .markdown-body code {
            font-family: 'Fira Code', monospace;
            font-size: 0.9em;
        }

        .markdown-body :not(pre) > code {
            background: rgba(255, 255, 255, 0.06);
            color: var(--accent);
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 500;
        }
        .theme-light .markdown-body :not(pre) > code {
            background: rgba(0, 0, 0, 0.05);
        }

        /* 테이블 */
        .markdown-body table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 0.95em;
        }

        .markdown-body th, .markdown-body td {
            border: 1px solid var(--border);
            padding: 12px 16px;
            text-align: left;
        }

        .markdown-body th {
            background: rgba(255, 255, 255, 0.03);
            font-weight: 600;
        }
        .theme-light .markdown-body th {
            background: rgba(0, 0, 0, 0.02);
        }

        /* 콜아웃 박스 (Quarto & Github 스타일) */
        .callout {
            border-left: 4px solid var(--callout-note);
            background: rgba(59, 130, 246, 0.05);
            border-radius: 6px;
            padding: 16px 20px;
            margin: 24px 0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .callout-header {
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--text-main);
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1.05em;
        }

        .callout-content p:last-child {
            margin-bottom: 0;
        }

        .callout-note { border-left-color: var(--callout-note); background: rgba(59, 130, 246, 0.05); }
        .callout-tip { border-left-color: var(--callout-tip); background: rgba(16, 185, 129, 0.05); }
        .callout-warning { border-left-color: var(--callout-warning); background: rgba(245, 158, 11, 0.05); }
        .callout-important, .callout-caution { border-left-color: var(--callout-important); background: rgba(239, 68, 68, 0.05); }

        .callout-note .callout-header { color: #60a5fa; }
        .callout-tip .callout-header { color: #34d399; }
        .callout-warning .callout-header { color: #fbbf24; }
        .callout-important .callout-header, .callout-caution .callout-header { color: #f87171; }

        /* 블록 인용 */
        blockquote {
            border-left: 4px solid var(--border);
            padding-left: 20px;
            margin: 20px 0;
            color: var(--text-muted);
            font-style: italic;
        }

        /* 이미지 */
        .markdown-body img {
            max-width: 100%;
            border-radius: 8px;
            border: 1px solid var(--border);
            margin: 20px 0;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }

        /* Mermaid 렌더링 컨테이너 */
        .mermaid-container {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 24px;
            margin: 24px 0;
            display: flex;
            justify-content: center;
            overflow-x: auto;
            position: relative;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .theme-light .mermaid-container {
            background: #ffffff;
        }
        .mermaid {
            width: 100% !important;
            text-align: center;
        }
        .mermaid-container svg {
            display: inline-block !important;
            max-width: 100% !important;
            transition: max-width 0.25s ease, width 0.25s ease;
            overflow: visible !important;
        }
        .mermaid-container.zoomed svg {
            max-width: none !important;
        }
        
        /* 화학 분자식 (SMILES) 렌더링 컨테이너 */
        .smiles-container {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            margin: 24px 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            transition: border-color 0.3s ease;
        }
        .theme-light .smiles-container {
            background: #ffffff;
        }
        .smiles-container:hover {
            border-color: var(--accent);
        }
        .smiles-container canvas {
            display: block;
            margin: 0 auto;
            max-width: 100%;
            height: auto;
        }
        
        /* Mermaid 컨트롤 패널 overlay */
        .mermaid-controls {
            position: absolute;
            top: 12px;
            right: 12px;
            display: flex;
            gap: 6px;
            opacity: 0.3;
            transition: all 0.2s ease;
            z-index: 10;
        }
        .mermaid-container:hover .mermaid-controls {
            opacity: 1;
        }
        .mermaid-zoom-btn, .mermaid-fs-btn {
            background: rgba(255, 255, 255, 0.04);
            backdrop-filter: blur(8px);
            border: 1px solid var(--border);
            border-radius: 6px;
            color: var(--text-muted);
            font-size: 0.75em;
            font-family: inherit;
            font-weight: 500;
            padding: 6px 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
        }
        .mermaid-zoom-btn:hover, .mermaid-fs-btn:hover {
            border-color: var(--accent);
            color: var(--accent);
            background: rgba(255, 255, 255, 0.08);
            box-shadow: 0 0 10px var(--accent-glow);
        }
        .theme-light .mermaid-zoom-btn, .theme-light .mermaid-fs-btn {
            background: rgba(0, 0, 0, 0.03);
            color: var(--text-muted);
        }
        .theme-light .mermaid-zoom-btn:hover, .theme-light .mermaid-fs-btn:hover {
            background: rgba(0, 0, 0, 0.06);
        }

        /* Mermaid 전체화면 모달 */
        .mermaid-fullscreen-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(9, 10, 15, 0.96);
            backdrop-filter: blur(15px);
            z-index: 9999;
            display: none;
            justify-content: center;
            align-items: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        .mermaid-fullscreen-modal.show {
            opacity: 1;
        }
        .fs-close-btn {
            position: absolute;
            top: 24px;
            right: 24px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border);
            border-radius: 50%;
            width: 48px;
            height: 48px;
            color: var(--text-main);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.25s ease;
            z-index: 100;
        }
        .fs-close-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            color: var(--accent);
            border-color: var(--accent);
            transform: rotate(90deg);
        }
        .fs-modal-content {
            max-width: 92%;
            max-height: 92%;
            overflow: auto;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .fs-modal-content svg {
            max-width: 100% !important;
            height: auto !important;
        }
        
        .theme-light .mermaid-fullscreen-modal {
            background: rgba(255, 255, 255, 0.97);
        }
        .theme-light .fs-modal-content {
            background: #ffffff;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .theme-light .fs-close-btn {
            background: rgba(0, 0, 0, 0.03);
            color: var(--text-main);
        }
        .theme-light .fs-close-btn:hover {
            background: rgba(0, 0, 0, 0.06);
        }
        
        .mermaid-error {
            background: rgba(239, 68, 68, 0.05);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 8px;
            padding: 16px;
            width: 100%;
        }
        .mermaid-error .error-title {
            color: #ef4444;
            font-weight: 600;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* LaTeX 수식 에러 */
        .math-error {
            color: #ef4444;
            border-bottom: 1px dashed #ef4444;
            padding: 2px 4px;
        }

        /* 우측 TOC 플로팅 아웃라인 */
        .toc-pane {
            width: var(--panel-width-toc);
            background: var(--bg-sidebar);
            border-left: 1px solid var(--border);
            padding: 20px;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            backdrop-filter: blur(12px);
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1), border 0.3s;
        }

        .toc-pane.collapsed {
            width: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            border-left: none !important;
            overflow: hidden !important;
        }

        .toc-title {
            font-family: 'Outfit', sans-serif;
            font-weight: 600;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 16px;
            color: var(--text-muted);
        }

        .toc-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .toc-item {
            font-size: 0.85em;
            color: var(--text-muted);
            cursor: pointer;
            transition: all 0.2s;
            padding: 4px 6px;
            border-radius: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .toc-item:hover {
            color: var(--accent);
            background: rgba(255, 255, 255, 0.03);
        }

        .toc-item.active {
            color: var(--accent);
            font-weight: 600;
            border-left: 2px solid var(--accent);
            padding-left: 8px;
            border-radius: 0;
        }

        .toc-h1 { padding-left: 0; font-weight: 500; }
        .toc-h2 { padding-left: 12px; }
        .toc-h3 { padding-left: 24px; font-size: 0.8em; }

        /* 파일 액션 팝업 */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }

        .modal-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            width: 400px;
            padding: 24px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .modal-title {
            font-family: 'Outfit', sans-serif;
            font-weight: 600;
            font-size: 1.1em;
        }

        .modal-input {
            width: 100%;
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--border);
            border-radius: 6px;
            color: var(--text-main);
            padding: 10px 12px;
            font-size: 0.9em;
            outline: none;
        }
        .theme-light .modal-input {
            background: rgba(0,0,0,0.02);
        }
        .modal-input:focus {
            border-color: var(--accent);
        }

        .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        /* 알림 메시지 */
        .toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: #10b981;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 0.9em;
            font-weight: 500;
            box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            z-index: 10000;
        }

        .toast.show {
            transform: translateY(0);
            opacity: 1;
        }

        /* 코드 블록 복사 버튼 */
        .code-copy-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--border);
            color: var(--text-muted);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75em;
            cursor: pointer;
            opacity: 0;
            transition: all 0.2s;
        }

        .markdown-body pre:hover .code-copy-btn {
            opacity: 1;
        }

        .code-copy-btn:hover {
            color: var(--accent);
            background: rgba(255,255,255,0.1);
        }

        /* 빈 상태 */
        .empty-state {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            gap: 16px;
        }
        .empty-state-icon {
            font-size: 4em;
            background: linear-gradient(135deg, var(--accent), #ad5389);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        /* Drag & Drop 영역 */
        .drag-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(9, 10, 15, 0.85);
            border: 3px dashed var(--accent);
            z-index: 9999;
            display: none;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 16px;
            color: var(--accent);
        }
        
        .drag-overlay.active {
            display: flex;
        }

        /* 스플래시 화면 */
        #splash-screen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: #090a0f;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            opacity: 1;
            transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .splash-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 24px;
            transform: translateY(30px);
            opacity: 0;
            animation: splashFadeIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes splashFadeIn {
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        .splash-logo {
            width: 90px;
            height: 90px;
            background: linear-gradient(135deg, var(--accent), #ad5389);
            border-radius: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 50px rgba(69, 243, 255, 0.25);
            color: white;
            animation: logoPulse 2s infinite ease-in-out alternate;
        }
        .splash-logo i {
            width: 44px;
            height: 44px;
        }
        .splash-title {
            font-family: 'Outfit', sans-serif;
            font-size: 2.8em;
            font-weight: 800;
            letter-spacing: 2px;
            background: linear-gradient(90deg, #ffffff, var(--accent));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 0 30px rgba(69, 243, 255, 0.15);
        }
        @keyframes logoPulse {
            0% {
                transform: scale(1);
                box-shadow: 0 0 40px rgba(69, 243, 255, 0.2);
            }
            100% {
                transform: scale(1.05);
                box-shadow: 0 0 60px rgba(69, 243, 255, 0.4);
            }
        }

        /* PDF 인쇄 시 미리보기 영역만 깔끔하게 출력되도록 설정 */
        @media print {
            /* 헤더, 사이드바, 편집기, 개요(TOC), 각종 조절 버튼 등 인쇄에 불필요한 모든 UI 요소 숨김 */
            header,
            #sidebar-panel,
            .sidebar-slide-toggle,
            #pane-editor,
            #pane-resizer,
            #sidebar-toc,
            .toc-slide-toggle,
            .pane-header,
            .modal,
            .toast,
            #splash-screen,
            .mermaid-controls,
            .code-copy-btn,
            .empty-state {
                display: none !important;
            }
            
            /* 레이아웃 제약 해제하여 화면 전체를 활용해 인쇄하도록 설정 */
            html, body, main, .workspace-panes, #pane-preview, #preview-pane {
                background: #ffffff !important;
                color: #000000 !important;
                overflow: visible !important;
                height: auto !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                position: static !important;
                box-shadow: none !important;
                backdrop-filter: none !important;
                display: block !important;
            }
            
            #preview-pane {
                padding: 0 !important;
                margin: 0 !important;
            }
            
            #preview-content {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: transparent !important;
            }
            
            .markdown-body {
                max-width: 100% !important;
                background: transparent !important;
                color: #000000 !important;
                padding: 10mm !important; /* 종이 여백 최적화 */
                margin: 0 auto !important;
            }
            
            /* 제목 및 일반 텍스트 잉크 절약 및 가시성 극대화 (완전한 흑백 대비) */
            .markdown-body h1, .markdown-body h2, .markdown-body h3, 
            .markdown-body h4, .markdown-body h5, .markdown-body h6 {
                color: #000000 !important;
                border-bottom-color: #dddddd !important;
                page-break-after: avoid; /* 제목 바로 뒤에서 페이지가 짤리는 현상 방지 */
            }
            
            .markdown-body p, .markdown-body li, .markdown-body td, .markdown-body th, .markdown-body a {
                color: #000000 !important;
            }
            
            .markdown-body a {
                border-bottom: none !important;
                text-decoration: underline !important;
            }
            
            /* 코드 블록, 인용 블록, 테이블, 다이어그램, 화학식 등의 페이지 짤림 현상 방지 */
            pre, blockquote, .callout, .mermaid-container, .smiles-container, table, img {
                page-break-inside: avoid !important;
            }
            
            /* 테이블 및 경계선 스타일 가독성 개선 */
            .markdown-body table, .markdown-body th, .markdown-body td {
                border-color: #cccccc !important;
            }
            
            .markdown-body th {
                background-color: #f3f4f6 !important;
            }
            
            /* 코드 블록 인쇄 최적화 (어두운 배경 -> 밝은 배경 및 잉크 절약) */
            .markdown-body pre {
                background: #f8fafc !important;
                border: 1px solid #e2e8f0 !important;
                color: #0f172a !important;
            }
            
            .markdown-body code {
                color: #0f172a !important;
            }
            
            .markdown-body :not(pre) > code {
                background: #f1f5f9 !important;
                color: #0284c7 !important;
                border: 1px solid #e2e8f0 !important;
            }
            
            /* 수식 렌더링 글꼴 색상 강제 지정 */
            .katex {
                color: #000000 !important;
            }
            
            /* 다이어그램 및 화학식 테두리 및 배경 최적화 */
            .mermaid-container, .smiles-container {
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                box-shadow: none !important;
                padding: 12px !important;
            }
            
            /* 인쇄 페이지 여백 설정 */
            @page {
                size: auto;
                margin: 15mm 15mm 15mm 15mm;
            }
        }
    </style>
</head>
<body>

    <!-- 스플래시 화면 -->
    <div id="splash-screen">
        <div class="splash-content">
            <div class="splash-logo">
                <i data-lucide="book-open"></i>
            </div>
            <div class="splash-title">JM Studio</div>
        </div>
    </div>

    <!-- 헤더 영역 -->
    <header>
        <div class="brand-section">
            <div class="brand-logo"><i data-lucide="book-open" style="width: 18px; height: 18px;"></i></div>
            <div class="brand-title">JM Studio</div>
            <button class="add-doc-btn" onclick="addDocumentToLibrary()" title="서재에 마크다운 문서(.md) 추가">
                <i data-lucide="file-plus" style="width: 14px; height: 14px;"></i>
                <span>문서 추가</span>
            </button>
        </div>

        <!-- 뷰 모드 토글 -->
        <div class="view-mode-toggles">
            <button class="mode-btn" id="mode-edit" onclick="setViewMode('edit')">
                <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                <span>편집기</span>
            </button>
            <button class="mode-btn active" id="mode-split" onclick="setViewMode('split')">
                <i data-lucide="columns" style="width: 14px; height: 14px;"></i>
                <span>스플릿</span>
            </button>
            <button class="mode-btn" id="mode-preview" onclick="setViewMode('preview')">
                <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
                <span>미리보기</span>
            </button>
        </div>

        <!-- 액션 그룹 -->
        <div class="action-group">
            <button class="btn" onclick="toggleDocumentFullscreen()" title="문서 전체화면 (더블클릭 단축 지원)">
                <i id="fs-doc-icon" data-lucide="expand" style="width: 14px; height: 14px;"></i>
                <span>문서 전체화면</span>
            </button>
            <button class="btn btn-accent" onclick="saveActiveFile()">
                <i data-lucide="save" style="width: 14px; height: 14px;"></i>
                <span>저장</span>
            </button>
            <button class="btn" onclick="exportToHtml()">
                <i data-lucide="external-link" style="width: 14px; height: 14px;"></i>
                <span>HTML 내보내기</span>
            </button>
            <button class="btn" onclick="printDocument()">
                <i data-lucide="printer" style="width: 14px; height: 14px;"></i>
                <span>PDF 인쇄</span>
            </button>
            <button class="icon-btn" onclick="toggleTheme()" title="테마 전환" style="margin-left: 8px;">
                <i id="theme-icon" data-lucide="sun" style="width: 18px; height: 18px;"></i>
            </button>
            <button class="icon-btn" onclick="openSettingsModal()" title="네트워크 및 보안 설정" style="margin-left: 4px;">
                <i data-lucide="settings" style="width: 18px; height: 18px;"></i>
            </button>
        </div>
    </header>

    <!-- 메인 워크스페이스 -->
    <main id="main-dropzone">
        <!-- 드래그 드롭 오버레이 -->
        <div class="drag-overlay" id="drag-overlay">
            <i data-lucide="upload-cloud" style="width: 48px; height: 48px;"></i>
            <div style="font-size: 1.2em; font-weight: 600;">여기에 마크다운 파일을 드롭하여 즉시 열기</div>
        </div>

        <!-- 사이드바 (내 서재 + 수식 입력기) -->
        <div class="sidebar" id="sidebar-panel" style="display: flex; flex-direction: column;">
            <div class="sidebar-tabs" style="display: flex; border-bottom: 1px solid var(--border); background: rgba(0,0,0,0.15);">
                <button class="sidebar-tab-btn active" id="tab-explorer" onclick="setSidebarTab('explorer')" style="flex: 1; padding: 12px; background: transparent; border: none; border-bottom: 2px solid var(--accent); color: var(--text-main); font-family: 'Outfit', sans-serif; font-size: 0.8em; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;">
                    <i data-lucide="folder" style="width: 14px; height: 14px;"></i>
                    <span>내 서재</span>
                </button>
                <button class="sidebar-tab-btn" id="tab-math" onclick="setSidebarTab('math')" style="flex: 1; padding: 12px; background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-family: 'Outfit', sans-serif; font-size: 0.8em; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;">
                    <i data-lucide="calculator" style="width: 14px; height: 14px;"></i>
                    <span>수식 입력기</span>
                </button>
                <button class="sidebar-tab-btn" id="tab-chemistry" onclick="setSidebarTab('chemistry')" style="flex: 1; padding: 12px; background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-family: 'Outfit', sans-serif; font-size: 0.8em; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;">
                    <i data-lucide="beaker" style="width: 14px; height: 14px;"></i>
                    <span>화학식 검색</span>
                </button>
            </div>
            
            <!-- 내 서재 패널 -->
            <div class="sidebar-content-pane" id="sidebar-content-explorer" style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
                <div class="sidebar-header">
                    <span class="sidebar-title">내 서재</span>
                    <div class="sidebar-actions">
                        <button class="icon-btn" onclick="openCreateModal('file')" title="새 파일 생성">
                            <i data-lucide="file-plus" style="width: 16px; height: 16px;"></i>
                        </button>
                        <button class="icon-btn" onclick="openCreateModal('folder')" title="새 폴더 생성">
                            <i data-lucide="folder-plus" style="width: 16px; height: 16px;"></i>
                        </button>
                        <button class="icon-btn" onclick="refreshWorkspace()" title="목록 새로고침">
                            <i data-lucide="rotate-cw" style="width: 16px; height: 16px;"></i>
                        </button>
                    </div>
                </div>
                <!-- 트리 뷰 목록 -->
                <div class="file-tree" id="file-tree-container"></div>
            </div>
            
            <!-- 수식 입력기 패널 -->
            <div class="sidebar-content-pane" id="sidebar-content-math" style="display: none; flex-direction: column; flex: 1; overflow-y: auto; padding: 16px; gap: 12px;">
                <!-- 서브탭 네비게이션 -->
                <div class="math-subtabs" style="display: flex; gap: 4px; background: rgba(255, 255, 255, 0.03); padding: 4px; border-radius: 6px; margin-bottom: 4px; border: 1px solid var(--border);">
                    <button class="math-subtab-btn active" id="subtab-math-math" onclick="setMathSubTab('math')" style="flex: 1; padding: 6px 2px; border: none; background: var(--accent-glow); color: var(--accent); font-family: 'Outfit', sans-serif; font-size: 0.72em; font-weight: 600; border-radius: 4px; cursor: pointer; transition: all 0.2s; white-space: nowrap;">📐 수학</button>
                    <button class="math-subtab-btn" id="subtab-math-physics" onclick="setMathSubTab('physics')" style="flex: 1; padding: 6px 2px; border: none; background: transparent; color: var(--text-muted); font-family: 'Outfit', sans-serif; font-size: 0.72em; font-weight: 600; border-radius: 4px; cursor: pointer; transition: all 0.2s; white-space: nowrap;">⚛️ 물리</button>
                    <button class="math-subtab-btn" id="subtab-math-bio" onclick="setMathSubTab('bio')" style="flex: 1; padding: 6px 2px; border: none; background: transparent; color: var(--text-muted); font-family: 'Outfit', sans-serif; font-size: 0.72em; font-weight: 600; border-radius: 4px; cursor: pointer; transition: all 0.2s; white-space: nowrap;">🧪 화학/생명</button>
                </div>

                <!-- 1. 수학 서브탭 콘텐츠 -->
                <div class="math-subtab-content" id="math-subtab-content-math" style="display: flex; flex-direction: column; gap: 16px;">
                    <div class="math-section">
                        <div class="math-section-title">자주 쓰이는 기본 수식</div>
                        <div class="math-grid">
                            <button class="math-item" onclick="insertMathSymbol('$\\\\frac{?}{?}$')">$$\\frac{a}{b}$$<span>분수</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\sqrt{?}$')">$$\\sqrt{x}$$<span>루트</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$?^{?}$')">$$a^b$$<span>거듭제곱</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$?_{?}$')">$$a_n$$<span>아래첨자</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\sum_{i=1}^{n} ?_{i}$')">$$\\sum x_i$$<span>합(Sum)</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\prod_{i=1}^{n} ?_{i}$')">$$\\prod x_i$$<span>곱(Prod)</span></button>
                        </div>
                    </div>
                    
                    <div class="math-section">
                        <div class="math-section-title">미적분 및 극한</div>
                        <div class="math-grid">
                            <button class="math-item" onclick="insertMathSymbol('$\\\\frac{d?}{d?}$')">$$\\frac{dy}{dx}$$<span>미분</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\frac{\\\\partial ?}{\\\\partial ?}$')">$$\\frac{\\partial y}{\\partial x}$$<span>편미분</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\int f(x)\\\\,dx$')">$$\\int$$<span>부정적분</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\int_{?}^{?} ?\\\\,d?$')">$$\\int_a^b$$<span>정적분</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\lim_{? \\\\to ?} ?$')">$$\\lim$$<span>극한</span></button>
                        </div>
                    </div>

                    <div class="math-section">
                        <div class="math-section-title">그리스 문자 (Greek)</div>
                        <div class="math-grid-small">
                            <button class="math-item-small" onclick="insertMathSymbol('$\\\\alpha$')">$$\\alpha$$</button>
                            <button class="math-item-small" onclick="insertMathSymbol('$\\\\beta$')">$$\\beta$$</button>
                            <button class="math-item-small" onclick="insertMathSymbol('$\\\\gamma$')">$$\\gamma$$</button>
                            <button class="math-item-small" onclick="insertMathSymbol('$\\\\delta$')">$$\\delta$$</button>
                            <button class="math-item-small" onclick="insertMathSymbol('$\\\\epsilon$')">$$\\epsilon$$</button>
                            <button class="math-item-small" onclick="insertMathSymbol('$\\\\theta$')">$$\\theta$$</button>
                            <button class="math-item-small" onclick="insertMathSymbol('$\\\\lambda$')">$$\\lambda$$</button>
                            <button class="math-item-small" onclick="insertMathSymbol('$\\\\pi$')">$$\\pi$$</button>
                            <button class="math-item-small" onclick="insertMathSymbol('$\\\\sigma$')">$$\\sigma$$</button>
                            <button class="math-item-small" onclick="insertMathSymbol('$\\\\omega$')">$$\\omega$$</button>
                            <button class="math-item-small" onclick="insertMathSymbol('$\\\\Delta$')">$$\\Delta$$</button>
                            <button class="math-item-small" onclick="insertMathSymbol('$\\\\Sigma$')">$$\\Sigma$$</button>
                            <button class="math-item-small" onclick="insertMathSymbol('$\\\\Omega$')">$$\\Omega$$</button>
                            <button class="math-item-small" onclick="insertMathSymbol('$\\\\Phi$')">$$\\Phi$$</button>
                        </div>
                    </div>

                    <div class="math-section">
                        <div class="math-section-title">수학 기호</div>
                        <div class="math-grid">
                            <button class="math-item" onclick="insertMathSymbol('$\\\\infty$')">$$\\infty$$<span>무한대</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\approx$')">$$\\approx$$<span>근사치</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\ne$')">$$\\ne$$<span>다름</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\times$')">$$\\times$$<span>곱셈</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\div$')">$$\\div$$<span>나눗셈</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\vec{?}$')">$$\\vec{v}$$<span>벡터</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\to$')">$$\\to$$<span>화살표</span></button>
                        </div>
                    </div>
                </div>

                <!-- 2. 물리학 서브탭 콘텐츠 -->
                <div class="math-subtab-content" id="math-subtab-content-physics" style="display: none; flex-direction: column; gap: 16px;">
                    <div class="math-section">
                        <div class="math-section-title">전자기학 및 중력</div>
                        <div class="math-grid">
                            <button class="math-item" onclick="insertMathSymbol('$F = k_e \\\\frac{q_1 q_2}{r^2}$')">$$F = k_e \\\\frac{q_1 q_2}{r^2}$$<span>쿨롱 법칙</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\vec{F} = q(\\\\vec{E} + \\\\vec{v} \\\\times \\\\vec{B})$')">$$\\\\vec{F} = q(\\\\vec{E} + \\\\vec{v} \\\\times \\\\vec{B})$$<span>로런츠 힘</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\oint \\\\vec{E} \\\\cdot d\\\\vec{A} = \\\\frac{Q}{\\\\varepsilon_0}$')">$$\\\\oint \\\\vec{E} \\\\cdot d\\\\vec{A} = \\\\frac{Q}{\\\\varepsilon_0}$$<span>가우스 법칙</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$F = G \\\\frac{m_1 m_2}{r^2}$')">$$F = G \\\\frac{m_1 m_2}{r^2}$$<span>만유인력</span></button>
                        </div>
                    </div>
                    
                    <div class="math-section">
                        <div class="math-section-title">양자역학 및 상대성이론</div>
                        <div class="math-grid">
                            <button class="math-item" onclick="insertMathSymbol('$E = mc^2$')">$$E = mc^2$$<span>질량-에너지</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$E = h\\\\nu$')">$$E = h\\\\nu$$<span>플랑크-양자</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$i\\\\hbar\\\\frac{\\\\partial}{\\\\partial t}\\\\Psi = \\\\hat{H}\\\\Psi$')">$$i\\\\hbar\\\\frac{\\\\partial}{\\\\partial t}\\\\Psi = \\\\hat{H}\\\\Psi$$<span>슈뢰딩거</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\Delta x \\\\Delta p \\\\ge \\\\frac{\\\\hbar}{2}$')">$$\\\\Delta x \\\\Delta p \\\\ge \\\\frac{\\\\hbar}{2}$$<span>불확정성</span></button>
                        </div>
                    </div>
                </div>

                <!-- 3. 화학/생명 서브탭 콘텐츠 -->
                <div class="math-subtab-content" id="math-subtab-content-bio" style="display: none; flex-direction: column; gap: 16px;">
                    <div class="math-section">
                        <div class="math-section-title">화학 반응 및 평형</div>
                        <div class="math-grid">
                            <button class="math-item" onclick="insertMathSymbol('$k = A e^{-\\\\frac{E_a}{RT}}$')">$$k = A e^{-\\\\frac{E_a}{RT}}$$<span>아레니우스</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$PV = nRT$')">$$PV = nRT$$<span>이상기체</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\rightarrow$')">$$\\\\rightarrow$$<span>정반응</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\rightleftharpoons$')">$$\\\\rightleftharpoons$$<span>가역반응</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\uparrow$')">$$\\\\uparrow$$<span>기체발생</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\downarrow$')">$$\\\\downarrow$$<span>침전발생</span></button>
                        </div>
                    </div>

                    <div class="math-section">
                        <div class="math-section-title">유전공학 및 생화학</div>
                        <div class="math-grid">
                            <button class="math-item" onclick="insertMathSymbol('$p^2 + 2pq + q^2 = 1$')">$$p^2 + 2pq + q^2 = 1$$<span>하디-바인베르크</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$v = \\\\frac{V_{max}[S]}{K_m + [S]}$')">$$v = \\\\frac{V_{max}[S]}{K_m + [S]}$$<span>멘텐 속도식</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\text{A} = \\\\text{T}$')">$$\\\\text{A} = \\\\text{T}$$<span>A-T 염기쌍</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\text{G} \\\\equiv \\\\text{C}$')">$$\\\\text{G} \\\\equiv \\\\text{C}$$<span>G-C 염기쌍</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\Delta G = \\\\Delta H - T\\\\Delta S$')">$$\\\\Delta G = \\\\Delta H - T\\\\Delta S$$<span>깁스 자유에너지</span></button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 화학식 검색 패널 -->
            <div class="sidebar-content-pane" id="sidebar-content-chemistry" style="display: none; flex-direction: column; flex: 1; overflow: hidden; padding: 20px; gap: 16px;">
                <div style="font-family: 'Outfit', sans-serif; font-size: 1.1em; font-weight: 600; color: var(--text-main); margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="beaker" style="width: 18px; height: 18px; color: var(--accent);"></i>
                    <span>PubChem 화학식 연동 검색</span>
                </div>
                <div style="font-size: 0.85em; color: var(--text-muted); line-height: 1.4;">
                    미국 국립의학도서관(NLM) PubChem 데이터베이스에서 화합물을 검색하여 분자 구조와 SMILES 코드를 실시간으로 가져옵니다. (한글/영어 모두 지원)
                </div>
                
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <input type="text" id="chemistry-search-input" placeholder="예: aspirin, caffeine, 캡사이신" style="flex: 1; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main); padding: 8px 12px; font-size: 0.9em; outline: none; transition: border-color 0.2s;" onkeydown="if(event.key==='Enter') searchChemistryPubChem()">
                    <button class="btn btn-accent" style="padding: 8px 14px;" onclick="searchChemistryPubChem()" title="검색 실행">
                        <i data-lucide="search" style="width: 14px; height: 14px;"></i>
                    </button>
                </div>
                
                <!-- 검색 로딩 스피너 -->
                <div id="chemistry-search-loading" style="display: none; align-items: center; justify-content: center; padding: 24px 0; gap: 10px; color: var(--text-muted); font-size: 0.9em;">
                    <div style="width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <span>PubChem 검색 중...</span>
                </div>
                
                <!-- 검색 결과 영역 -->
                <div id="chemistry-search-result" style="display: none; flex-direction: column; gap: 16px; overflow-y: auto; flex: 1; margin-top: 12px; border-top: 1px dashed var(--border); padding-top: 16px;">
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
                        <div>
                            <div id="chem-result-name" style="font-size: 1.05em; font-weight: 600; color: var(--accent); text-transform: capitalize;">Aspirin</div>
                            <div id="chem-result-cid" style="font-size: 0.75em; color: var(--text-muted); margin-top: 2px;">PubChem CID: 2244</div>
                        </div>
                        
                        <!-- 분자 구조 실시간 벡터 프리뷰 -->
                        <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--border); border-radius: 6px; padding: 8px; display: flex; justify-content: center; align-items: center; min-height: 160px; position: relative;">
                            <svg id="chem-preview-svg" style="width: 150px; height: 150px; display: block;"></svg>
                        </div>
                        
                        <div>
                            <div style="font-size: 0.75em; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">SMILES 코드</div>
                            <div style="position: relative; display: flex;">
                                <input type="text" id="chem-result-smiles" readonly style="flex: 1; font-family: monospace; font-size: 0.8em; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 4px; padding: 6px 8px; color: var(--text-main); outline: none;">
                            </div>
                        </div>
                        
                        <button class="btn btn-accent" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;" onclick="insertChemistryToEditor()">
                            <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                            <span>에디터에 분자식 삽입</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 슬라이딩 숨기기/나오기 핸들 (사이드바 바로 뒤 인접 형제로 배치) -->
        <button class="sidebar-slide-toggle" onclick="toggleSidebar()" id="sidebar-slide-btn" title="사이드바 열기/접기">
            <i id="sidebar-slide-icon" data-lucide="chevron-left" style="width: 12px; height: 12px;"></i>
        </button>

        <!-- 편집기 및 렌더러 영역 -->
        <div class="workspace-panes">
            <!-- 편집기 패널 -->
            <div class="pane" id="pane-editor">
                <div class="pane-header">
                    <span id="active-file-title">선택된 파일 없음</span>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <button class="icon-btn-sm" onclick="undoEditor()" title="되돌리기 (Ctrl+Z)">
                            <i data-lucide="undo" style="width: 12px; height: 12px;"></i>
                        </button>
                        <button class="icon-btn-sm" onclick="redoEditor()" title="다시 실행 (Ctrl+Y)">
                            <i data-lucide="redo" style="width: 12px; height: 12px;"></i>
                        </button>
                        <span style="font-size: 0.85em; opacity: 0.6; margin-left: 8px;">Editor</span>
                    </div>
                </div>
                <div class="editor-container">
                    <div class="editor-gutter" id="editor-gutter">1</div>
                    <textarea class="editor-textarea" id="editor" spellcheck="false" placeholder="마크다운 내용을 여기에 입력하거나 좌측 탐색기에서 파일을 선택해 주세요..." oninput="handleEditorInput()" onscroll="syncGutterScroll()"></textarea>
                </div>
            </div>

            <!-- 드래그 가능한 분할 크기 조절선 -->
            <div class="resizer-gutter" id="pane-resizer"></div>

            <!-- 프리뷰 패널 -->
            <div class="pane" id="pane-preview">
                <div class="pane-header">
                    <span>실시간 미리보기</span>
                    <span>Live Render</span>
                </div>
                <div class="preview-pane" id="preview-pane">
                    <div class="markdown-body" id="preview-content">
                        <div class="empty-state">
                            <div class="empty-state-icon"><i data-lucide="markdown" style="width: 64px; height: 64px;"></i></div>
                            <div style="font-size: 1.1em; font-weight: 500;">파일이 열리지 않았습니다.</div>
                            <div style="font-size: 0.85em; opacity: 0.8;">좌측 탐색기에서 파일을 열거나 새로운 마크다운 문서를 작성해 보세요.</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 우측 TOC 플로팅 패널 -->
        <div class="toc-pane" id="sidebar-toc">
            <div class="toc-title">문서 개요 (TOC)</div>
            <div id="toc-container">
                <ul class="toc-list" id="toc-list"></ul>
            </div>
        </div>

        <!-- 슬라이딩 숨기기/나오기 핸들 (우측 TOC) -->
        <button class="toc-slide-toggle" onclick="toggleToc()" id="toc-slide-btn" title="문서 개요 열기/접기">
            <i id="toc-slide-icon" data-lucide="chevron-right" style="width: 12px; height: 12px;"></i>
        </button>
    </main>

    <!-- 새 아이템 생성 모달 -->
    <div class="modal" id="create-modal">
        <div class="modal-card">
            <div class="modal-title" id="modal-card-title">새 항목 추가</div>
            <input type="text" class="modal-input" id="modal-card-input" placeholder="이름을 입력해 주세요...">
            <div class="modal-actions">
                <button class="btn" onclick="closeCreateModal()">취소</button>
                <button class="btn btn-accent" onclick="submitCreateItem()">생성</button>
            </div>
        </div>
    </div>

    <!-- 네트워크 및 보안 설정 모달 -->
    <div class="modal" id="settings-modal" style="display: none;">
        <div class="modal-card" style="width: 480px; max-width: 90%; padding: 32px; gap: 20px;">
            <div style="display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); padding-bottom: 12px;">
                <i data-lucide="settings" style="width: 20px; height: 20px; color: var(--accent);"></i>
                <div class="modal-title" style="margin: 0; font-size: 1.25em;">네트워크 및 보안 설정</div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 8px; padding: 14px; box-sizing: border-box; text-align: left;">
                <div style="font-size: 0.85em; font-weight: 600; color: var(--accent); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="info" style="width: 14px; height: 14px;"></i> 현재 네트워크 접속 정보
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: var(--text-main);">
                    <span>내부 IP (LAN):</span>
                    <span id="settings-local-ip" style="font-weight: 600; color: #38bdf8;">127.0.0.1</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: var(--text-main);">
                    <span>공인 IP (WAN):</span>
                    <span id="settings-public-ip" style="font-weight: 600; color: #4ade80;">가져오는 중...</span>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 16px; width: 100%;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-size: 0.85em; font-weight: 600; color: var(--text-main);">접속 호스트 (Bind IP)</label>
                    <select id="settings-bind-ip" class="modal-input" style="width: 100%; box-sizing: border-box;">
                        <option value="0.0.0.0">0.0.0.0 (외부 접속 허용)</option>
                        <option value="127.0.0.1">127.0.0.1 (로컬만 허용)</option>
                    </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-size: 0.85em; font-weight: 600; color: var(--text-main);">포트 번호</label>
                    <input type="number" id="settings-port" class="modal-input" placeholder="58220" style="width: 100%; box-sizing: border-box;" min="1024" max="65535">
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-size: 0.85em; font-weight: 600; color: var(--text-main);">웹 접속 암호</label>
                    <input type="password" id="settings-password" class="modal-input" placeholder="미지정 시 로그인 없이 접속" style="width: 100%; box-sizing: border-box;">
                </div>
            </div>
            <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 6px; padding: 10px; font-size: 0.78em; color: #f87171; line-height: 1.4;">
                호스트/포트 변경은 앱 재시작 후 적용. 암호 변경은 즉시 적용.
            </div>
            <div class="modal-actions" style="width: 100%; justify-content: flex-end;">
                <button class="btn" onclick="closeSettingsModal()">취소</button>
                <button class="btn btn-accent" onclick="saveSettings()">저장</button>
            </div>
        </div>
    </div>

    <!-- 보안 접속 인증 overlay -->
    <div id="auth-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(9,10,15,0.85); backdrop-filter: blur(25px); z-index: 99999; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif;">
        <div style="background: rgba(20,22,30,0.7); border: 1px solid rgba(69,243,255,0.15); border-radius: 16px; padding: 40px; width: 420px; max-width: 90%; box-shadow: 0 20px 50px rgba(0,0,0,0.5); text-align: center; display: flex; flex-direction: column; gap: 24px;">
            <div style="width: 64px; height: 64px; background: rgba(69,243,255,0.1); border-radius: 50%; border: 1px solid rgba(69,243,255,0.25); display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                <i data-lucide="shield-alert" style="width: 32px; height: 32px; color: #45f3ff;"></i>
            </div>
            <div>
                <div style="font-size: 1.5em; font-weight: 700; color: #e2e8f0;">Secure Access</div>
                <div style="font-size: 0.85em; color: #94a3b8; margin-top: 6px;">접속 암호를 입력해 주세요.</div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <input type="password" id="auth-password-input" placeholder="비밀번호" style="width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; padding: 12px 16px; font-size: 1em; outline: none;" onkeydown="if(event.key==='Enter') submitAuthPassword()">
                <div id="auth-error-msg" style="display: none; color: #ef4444; font-size: 0.8em;">암호가 올바르지 않습니다.</div>
            </div>
            <button class="btn btn-accent" style="width: 100%; padding: 12px; justify-content: center; gap: 8px; font-weight: 600;" onclick="submitAuthPassword()">
                <i data-lucide="key" style="width: 16px; height: 16px;"></i> 접속하기
            </button>
        </div>
    </div>

    <!-- 토스트 알림 -->
    <div class="toast" id="toast">
        <i data-lucide="check-circle" style="width: 16px; height: 16px;"></i>
        <span id="toast-message">변경 사항이 저장되었습니다.</span>
    </div>

    <!-- Mermaid 전체화면 모달 -->
    <div class="mermaid-fullscreen-modal" id="mermaid-fs-modal" onclick="closeMermaidFullscreen(event)">
        <button class="fs-close-btn" onclick="closeMermaidFullscreen(event)" title="닫기 (Esc)">
            <i data-lucide="x" style="width: 20px; height: 20px;"></i>
        </button>
        <div class="fs-modal-content" onclick="event.stopPropagation()">
            <!-- 클론된 SVG가 여기에 주입됩니다. -->
        </div>
    </div>

    <!-- 스크립트 파일 로직 -->
    <script>
        class UndoManager {
            constructor(textarea) {
                this.textarea = textarea;
                this.history = [];
                this.currentIndex = -1;
                this.maxHistory = 100;
                this.isUndoRedoAction = false;
            }
            
            saveState() {
                if (this.isUndoRedoAction) return;
                
                const value = this.textarea.value;
                const selStart = this.textarea.selectionStart;
                const selEnd = this.textarea.selectionEnd;
                
                if (this.currentIndex >= 0 && this.history[this.currentIndex].value === value) {
                    return;
                }
                
                this.history = this.history.slice(0, this.currentIndex + 1);
                this.history.push({ value, selStart, selEnd });
                
                if (this.history.length > this.maxHistory) {
                    this.history.shift();
                }
                this.currentIndex = this.history.length - 1;
            }
            
            undo() {
                if (this.currentIndex > 0) {
                    this.currentIndex--;
                    this.restoreState();
                    return true;
                }
                return false;
            }
            
            redo() {
                if (this.currentIndex < this.history.length - 1) {
                    this.currentIndex++;
                    this.restoreState();
                    return true;
                }
                return false;
            }
            
            restoreState() {
                this.isUndoRedoAction = true;
                const state = this.history[this.currentIndex];
                this.textarea.value = state.value;
                this.textarea.selectionStart = state.selStart;
                this.textarea.selectionEnd = state.selEnd;
                this.textarea.focus();
                
                // 에디터 변경 리프레시
                updateLineNumbers();
                syncGutterScroll();
                triggerLiveRender();
                
                this.isUndoRedoAction = false;
            }
        }

        window.undoManager = null;
        let currentFilePath = "";
        let currentViewMode = "split";
        let currentTheme = "dark";
        let isSyncScrolling = true;
        let isCreatingType = "file"; // 'file' or 'folder'
        let workspaceRoot = "";
        let currentNetworkConfig = { bind_ip: '0.0.0.0', port: 58220, access_password: '', local_ip: '127.0.0.1' };
        
        // 디바운스 타이머 (Mermaid 및 MathJax 실시간 렌더링 렉 방지)
        let renderTimeout;

        // Mermaid 초기화 완료 (모듈 로더에서 글로벌 바인딩됨)

        // Lucide 아이콘 활성화
        lucide.createIcons();

        // 초기 앱 구동 시 파이썬 백엔드에서 초기 상태 로드
        document.addEventListener('DOMContentLoaded', async () => {
            // Undo Manager 초기화 및 이벤트 바인딩
            const textareaEl = document.getElementById('editor');
            window.undoManager = new UndoManager(textareaEl);
            
            let inputSaveTimeout;
            textareaEl.addEventListener('input', () => {
                clearTimeout(inputSaveTimeout);
                inputSaveTimeout = setTimeout(() => {
                    if (window.undoManager) {
                        window.undoManager.saveState();
                    }
                }, 500); // 500ms 간 타이핑 중지 시 상태 스냅샷 저장
            });
            
            textareaEl.addEventListener('blur', () => {
                if (window.undoManager) {
                    window.undoManager.saveState();
                }
            });

            if (window.pywebview) {
                // 데스크톱 앱 모드: 네이티브 브릿지 즉시 사용
                initApp();
            } else {
                // pywebviewready 이벤트 대기 (데스크톱 앱에서 약간 늦을 때)
                let resolved = false;
                window.addEventListener('pywebviewready', () => {
                    if (!resolved) {
                        resolved = true;
                        initApp();
                    }
                });
                
                // 500ms 이내에 pywebview가 로드되지 않으면 브라우저 접속으로 판단
                setTimeout(() => {
                    if (!resolved && !window.pywebview) {
                        resolved = true;
                        console.log("Running in Web Browser mode. Injecting HTTP API Proxy.");
                        window.pywebview = {
                            is_browser_proxy: true,
                            api: new Proxy({}, {
                                get: function(target, prop) {
                                    return function(...args) {
                                        if (prop === 'open_library_folder') {
                                            alert("웹 브라우저 모드에서는 로컬 폴더를 열 수 없습니다.");
                                            return Promise.resolve({ status: 'cancel' });
                                        }
                                        if (prop === 'add_documents_to_library') {
                                            alert("웹 브라우저 모드에서는 파일 선택 대화상자를 사용할 수 없습니다.\\n마크다운 파일을 화면에 드래그 앤 드롭해 주세요.");
                                            return Promise.resolve({ status: 'cancel' });
                                        }
                                        
                                        let bodyData = {};
                                        if (prop === 'read_file') { bodyData.rel_path = args[0]; }
                                        else if (prop === 'save_file') { bodyData.rel_path = args[0]; bodyData.content = args[1]; }
                                        else if (prop === 'create_item') { bodyData.rel_path = args[0]; bodyData.item_type = args[1]; }
                                        else if (prop === 'delete_item') { bodyData.rel_path = args[0]; }
                                        else if (prop === 'rename_item') { bodyData.old_rel_path = args[0]; bodyData.new_rel_path = args[1]; }
                                        else if (prop === 'search_pubchem_smiles') { bodyData.compound_name = args[0]; }
                                        else if (prop === 'save_theme') { bodyData.theme_name = args[0]; }
                                        else if (prop === 'save_network_settings') { bodyData.bind_ip = args[0]; bodyData.port = args[1]; bodyData.access_password = args[2]; }
                                        else if (prop === 'export_html') { bodyData.rel_path = args[0]; bodyData.html_body = args[1]; bodyData.title = args[2]; }
                                        
                                        let headers = { 'Content-Type': 'application/json' };
                                        const savedPwd = localStorage.getItem('access_password');
                                        if (savedPwd) { headers['X-Access-Password'] = savedPwd; }
                                        
                                        return fetch(`/api/${prop}`, {
                                            method: 'POST',
                                            headers: headers,
                                            body: JSON.stringify(bodyData)
                                        }).then(res => res.json())
                                          .catch(err => ({ status: 'error', message: err.message }));
                                    };
                                }
                            })
                        };
                        initApp();
                    }
                }, 500);
            }
            
            // Drag and drop setup
            setupDragAndDrop();
        });

        async function initApp() {
            try {
                const state = await pywebview.api.get_initial_state();
                
                // HTTP API 보안 검증 통과 실패 시
                if (state && state.status === 'auth_failed') {
                    showAuthOverlay();
                    return;
                }
                
                // 네트워크 설정 저장
                currentNetworkConfig.bind_ip = state.bind_ip || '0.0.0.0';
                currentNetworkConfig.port = state.port || 58220;
                currentNetworkConfig.access_password = state.access_password || '';
                currentNetworkConfig.local_ip = state.local_ip || '127.0.0.1';

                workspaceRoot = state.workspace;
                currentTheme = state.theme;
                
                const wsNameEl = document.getElementById('workspace-name');
                if (wsNameEl) {
                    wsNameEl.innerText = workspaceRoot.replace(/\\\\/g, '/');
                }
                setTheme(currentTheme);
                renderFileTree(state.files);
                
                if (state.last_file) {
                    openFile(state.last_file);
                }
                
                // 스플래시 화면 페이드아웃
                setTimeout(() => {
                    const splash = document.getElementById('splash-screen');
                    if (splash) {
                        splash.style.opacity = '0';
                        setTimeout(() => { splash.style.display = 'none'; }, 800);
                    }
                }, 1800);
            } catch (err) {
                console.error("Initialization error:", err);
                const splash = document.getElementById('splash-screen');
                if (splash) splash.style.display = 'none';
                if (err && err.message && (err.message.includes('401') || err.message.includes('auth_failed'))) {
                    showAuthOverlay();
                }
            }
        }

        // 테마 설정 (saveConfig가 false인 경우, 파일 인쇄 시 임시 테마 변경에 대처하여 DB 쓰기 방지)
        function setTheme(theme, saveConfig = true) {
            currentTheme = theme;
            const body = document.body;
            const themeIcon = document.getElementById('theme-icon');
            
            if (theme === 'light') {
                body.classList.add('theme-light');
                themeIcon.setAttribute('data-lucide', 'moon');
                mermaid.initialize({ theme: 'default', flowchart: { useMaxWidth: false } });
            } else {
                body.classList.remove('theme-light');
                themeIcon.setAttribute('data-lucide', 'sun');
                mermaid.initialize({ theme: 'dark', flowchart: { useMaxWidth: false } });
            }
            lucide.createIcons();
            
            // 프리뷰 리렌더링
            triggerLiveRender();
            
            if (window.pywebview && saveConfig) {
                pywebview.api.save_theme(theme);
            }
        }

        function toggleTheme() {
            setTheme(currentTheme === 'dark' ? 'light' : 'dark');
        }

        // 윈도우 탐색기에서 서재 폴더 열기
        async function openLibraryFolder() {
            if (window.pywebview) {
                const res = await pywebview.api.open_library_folder();
                if (res.status === 'success') {
                    showToast("윈도우 탐색기에서 서재 폴더를 열었습니다.");
                } else if (res.status === 'error') {
                    alert("폴더 열기 실패: " + res.message);
                }
            }
        }

        // 서재에 외부 문서 추가
        async function addDocumentToLibrary() {
            if (window.pywebview) {
                const res = await pywebview.api.add_documents_to_library();
                if (res.status === 'success') {
                    renderFileTree(res.files);
                    showToast(res.message);
                } else if (res.status === 'error') {
                    alert("문서 추가 중 오류가 발생했습니다: " + res.message);
                }
            }
        }

        // 워크스페이스 새로고침
        async function refreshWorkspace() {
            const files = await pywebview.api.list_files();
            renderFileTree(files);
            showToast("내 서재를 새로고침했습니다.");
        }

        // 파일 트리 렌더링
        function renderFileTree(files) {
            const container = document.getElementById('file-tree-container');
            container.innerHTML = "";
            
            if (!files || files.length === 0) {
                container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85em; padding: 10px; text-align: center;">파일이 존재하지 않습니다.</div>`;
                return;
            }
            
            container.appendChild(createTreeDOM(files));
            lucide.createIcons();
        }

        function createTreeDOM(items) {
            const ul = document.createElement('div');
            
            items.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'tree-item';
                if (currentFilePath === item.path) {
                    itemEl.classList.add('active');
                }
                
                const iconName = item.type === 'folder' ? 'folder' : 'file-text';
                
                itemEl.innerHTML = `
                    <i data-lucide="${iconName}" style="width: 16px; height: 16px; min-width: 16px;"></i>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}</span>
                    <div class="tree-item-actions">
                        <button class="icon-btn" onclick="deleteWorkspaceItem(event, '${item.path}')" title="삭제"><i data-lucide="trash-2" style="width: 12px; height: 12px;"></i></button>
                    </div>
                `;
                
                if (item.type === 'folder') {
                    // 폴더 토글 메커니즘
                    const folderWrapper = document.createElement('div');
                    const childrenWrapper = document.createElement('div');
                    childrenWrapper.className = 'tree-folder-children';
                    
                    itemEl.onclick = (e) => {
                        if (e.target.closest('.tree-item-actions')) return;
                        childrenWrapper.classList.toggle('open');
                        const icon = itemEl.querySelector('[data-lucide]');
                        const isOpen = childrenWrapper.classList.contains('open');
                        icon.setAttribute('data-lucide', isOpen ? 'folder-open' : 'folder');
                        lucide.createIcons();
                    };
                    
                    if (item.children && item.children.length > 0) {
                        childrenWrapper.appendChild(createTreeDOM(item.children));
                    } else {
                        childrenWrapper.innerHTML = `<div style="color: var(--text-muted); font-size: 0.8em; padding: 4px 16px;">빈 폴더</div>`;
                    }
                    
                    folderWrapper.appendChild(itemEl);
                    folderWrapper.appendChild(childrenWrapper);
                    ul.appendChild(folderWrapper);
                } else {
                    itemEl.onclick = (e) => {
                        if (e.target.closest('.tree-item-actions')) return;
                        // 활성화 스타일 해제 후 신규 지정
                        document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
                        itemEl.classList.add('active');
                        openFile(item.path);
                    };
                    ul.appendChild(itemEl);
                }
            });
            
            return ul;
        }

        // 파일 열기
        async function openFile(relPath) {
            const res = await pywebview.api.read_file(relPath);
            if (res.status === 'success') {
                currentFilePath = relPath;
                
                // 파일 이름만 노출하고 물리적 전체 저장 경로는 툴팁으로 우아하게 표시
                const titleEl = document.getElementById('active-file-title');
                const fileName = relPath.substring(relPath.lastIndexOf('/') + 1);
                titleEl.innerText = fileName;
                const fullSavingPath = (workspaceRoot.replace(/\\\\/g, '/') + '/' + relPath).replace(/\\/+/g, '/');
                titleEl.title = "저장 위치: " + fullSavingPath;
                
                const textarea = document.getElementById('editor');
                textarea.value = res.content;
                
                // 라인 넘버 빌드
                updateLineNumbers();
                
                // 마크다운 그래픽 파싱 & 렌더링
                triggerLiveRender();
                
                // Undo Manager 초기화 및 첫 스냅샷 기록
                if (window.undoManager) {
                    window.undoManager.history = [];
                    window.undoManager.currentIndex = -1;
                    window.undoManager.saveState();
                }
            } else {
                alert("파일을 읽을 수 없습니다: " + res.message);
            }
        }

        // 라인 넘버 업데이트
        function updateLineNumbers() {
            const textarea = document.getElementById('editor');
            const gutter = document.getElementById('editor-gutter');
            const lines = textarea.value.split('\\n');
            const count = Math.max(lines.length, 1);
            
            let numHtml = "";
            for (let i = 1; i <= count; i++) {
                numHtml += `<div>${i}</div>`;
            }
            gutter.innerHTML = numHtml;
        }

        function syncGutterScroll() {
            const textarea = document.getElementById('editor');
            const gutter = document.getElementById('editor-gutter');
            gutter.scrollTop = textarea.scrollTop;
        }

        // 실시간 미리보기 렌더링 제어
        function handleEditorInput() {
            updateLineNumbers();
            triggerLiveRender();
        }

        function triggerLiveRender() {
            clearTimeout(renderTimeout);
            
            // 타이핑 도중 렉 유발 방지를 위한 디바운싱 (300ms)
            renderTimeout = setTimeout(async () => {
                const markdownText = document.getElementById('editor').value;
                if (!markdownText.trim()) {
                    document.getElementById('preview-content').innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon"><i data-lucide="file-text" style="width: 64px; height: 64px;"></i></div>
                            <div style="font-size: 1.1em; font-weight: 500;">내용이 비어있습니다.</div>
                        </div>
                    `;
                    lucide.createIcons();
                    return;
                }
                
                // 1. Math block 임시 마스킹 (Marked 파서 간섭 방지)
                const maskedText = maskLaTeX(markdownText);
                
                // 2. 콜아웃 (Quarto 및 Github 스타일) 변환
                const calloutParsed = parseCallouts(maskedText);
                
                // 3. Marked 기본 마크다운 컴파일
                let renderedHtml = marked.parse(calloutParsed);
                
                // 4. 로컬 워크스페이스 이미지 경로 수정
                renderedHtml = resolveImagePaths(renderedHtml);
                
                // 5. LaTeX 수식 복원 및 KaTeX 렌더링
                renderedHtml = unmaskAndRenderLaTeX(renderedHtml);
                
                // 6. DOM 뷰 적용
                const container = document.getElementById('preview-content');
                container.innerHTML = renderedHtml;
                
                // Quarto 스타일의 클래스 명 보정 (예: language-{mermaid} -> language-mermaid)
                container.querySelectorAll('pre code').forEach(codeEl => {
                    const classes = Array.from(codeEl.classList);
                    classes.forEach(cls => {
                        if (cls.startsWith('language-{') && cls.endsWith('}')) {
                            const cleanLang = cls.slice(10, -1);
                            codeEl.classList.remove(cls);
                            codeEl.classList.add(`language-${cleanLang}`);
                        }
                    });
                });
                
                // 7. Mermaid 다이어그램 렌더링
                await renderMermaid(container);
                
                // 7.5. 화학 분자식 (SMILES) 렌더링
                renderSmiles(container);
                
                // 8. 코드 하이라이트 (PrismJS) 적용 및 복사 버튼 생성
                applyCodeHighlighting(container);
                
                // 9. TOC(목차) 재생성
                generateTOC(container);
            }, 300);
        }

        // SMILES 화학 분자식 실시간 렌더링
        function renderSmiles(container) {
            const smilesBlocks = container.querySelectorAll('code.language-smiles');
            for (let i = 0; i < smilesBlocks.length; i++) {
                const block = smilesBlocks[i];
                const pre = block.parentElement;
                const smilesText = block.innerText.trim();
                
                // 고유 ID 생성
                const svgId = `smiles-svg-${Date.now()}-${i}`;
                
                // 컨테이너 HTML 교체 (벡터 드로잉을 위해 svg 태그로 선언)
                const wrapper = document.createElement('div');
                wrapper.className = 'smiles-container';
                wrapper.innerHTML = `
                    <svg id="${svgId}" style="width: 320px; height: 320px; max-width: 100%; height: auto; display: block; margin: 0 auto;"></svg>
                    <div style="text-align: center; font-size: 0.8em; color: var(--text-muted); margin-top: 12px; font-family: 'Inter', sans-serif; font-weight: 500; letter-spacing: 0.5px;">분자식: ${smilesText}</div>
                `;
                
                pre.parentNode.replaceChild(wrapper, pre);
                
                // SmilesDrawer SVG 렌더링 실행
                try {
                    const theme = currentTheme === 'light' ? 'light' : 'dark';
                    
                    // 테마에 맞는 색상 설정
                    const drawerOptions = {
                        width: 320,
                        height: 320,
                        theme: theme,
                        bondThickness: 2.2,
                        bondLength: 18,
                        fontSizeLarge: 6,
                        fontSizeSmall: 4,
                        overlapSensitivity: 1.8,
                        doubleBondSpacing: 4
                    };
                    
                    const drawer = new SmilesDrawer.SvgDrawer(drawerOptions);
                    
                    SmilesDrawer.parse(smilesText, function(tree) {
                        drawer.draw(tree, svgId, theme, false);
                    }, function(err) {
                        console.error("Smiles parsing error: ", err);
                        wrapper.innerHTML = `<div style="color: var(--callout-important); border: 1px solid var(--border); padding: 12px; border-radius: 8px; font-size: 0.9em; font-family: 'Inter', sans-serif;">분자식 파싱 실패: <span style="font-family: monospace;">${smilesText}</span></div>`;
                    });
                } catch (e) {
                    console.error("SmilesDrawer error: ", e);
                }
            }
        }

        // ----------------- 수식 & 그래픽 & 콜아웃 파싱 핵심 로직 -----------------
        
        let mathBlocks = [];
        
        function maskLaTeX(text) {
            mathBlocks = [];
            // 1. Block 수식 ($$수식$$) 마스킹
            text = text.replace(/\\$\\$([\\s\\S]+?)\\$\\$/g, (match, math) => {
                const placeholder = `%%BLOCK_MATH_${mathBlocks.length}%%`;
                mathBlocks.push({ id: placeholder, math: math.trim(), block: true });
                return placeholder;
            });
            // 2. Inline 수식 ($수식$) 마스킹
            text = text.replace(/\\$([^\\$\\n\\r]+?)\\$/g, (match, math) => {
                const placeholder = `%%INLINE_MATH_${mathBlocks.length}%%`;
                mathBlocks.push({ id: placeholder, math: math.trim(), block: false });
                return placeholder;
            });
            return text;
        }

        function unmaskAndRenderLaTeX(html) {
            mathBlocks.forEach(item => {
                try {
                    const rendered = katex.renderToString(item.math, {
                        displayMode: item.block,
                        throwOnError: false
                    });
                    html = html.replace(item.id, rendered);
                } catch (e) {
                    html = html.replace(item.id, `<span class="math-error" title="${e.message}">${item.math}</span>`);
                }
            });
            return html;
        }

        function parseCallouts(text) {
            // 1. Quarto 스타일 콜아웃: ::: {.callout-note} ... :::
            const quartoRegex = /:::\\s*\\{\\s*\\.callout-(\\w+)\\s*\\}\\s*\\n([\\s\\S]*?)\\n\\s*:::/g;
            text = text.replace(quartoRegex, (match, type, content) => {
                const title = type.charAt(0).toUpperCase() + type.slice(1);
                return `<div class="callout callout-${type}">
                            <div class="callout-header"><span class="callout-icon"></span>${title}</div>
                            <div class="callout-content">${marked.parse(content)}</div>
                        </div>`;
            });

            // 2. Github Alert 스타일 콜아웃: > [!NOTE]
            const githubRegex = />\\s*\\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\\]\\s*\\n((?:>\\s*.*\\n?)*)/gi;
            text = text.replace(githubRegex, (match, type, content) => {
                const cleanContent = content.replace(/^>\\s?/gm, '');
                const lowerType = type.toLowerCase();
                return `<div class="callout callout-${lowerType}">
                            <div class="callout-header"><span class="callout-icon"></span>${type.toUpperCase()}</div>
                            <div class="callout-content">${marked.parse(cleanContent)}</div>
                        </div>`;
            });
            
            return text;
        }

        function resolveImagePaths(html) {
            // 이미지 주소가 relative일 경우 /workspace/ 경로로 우회 서빙
            const div = document.createElement('div');
            div.innerHTML = html;
            
            const images = div.querySelectorAll('img');
            images.forEach(img => {
                const src = img.getAttribute('src');
                if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
                    // relative 경로는 백엔드 Bottle static 서버 경로로 라우팅
                    img.setAttribute('src', `/workspace/${src}`);
                }
            });
            return div.innerHTML;
        }

        async function renderMermaid(container) {
            const blocks = container.querySelectorAll('pre code.language-mermaid');
            for (let index = 0; index < blocks.length; index++) {
                const codeEl = blocks[index];
                const preEl = codeEl.parentElement;
                const codeText = codeEl.textContent.trim();
                
                const containerDiv = document.createElement('div');
                containerDiv.className = 'mermaid-container';
                
                const id = `mermaid-chart-${index}`;
                const graphDiv = document.createElement('div');
                graphDiv.className = 'mermaid';
                graphDiv.id = id;
                
                // 컨트롤 패널 overlay 생성
                const controlsDiv = document.createElement('div');
                controlsDiv.className = 'mermaid-controls';
                
                // 돋보기(확대/축소) 버튼 생성
                const zoomBtn = document.createElement('button');
                zoomBtn.className = 'mermaid-zoom-btn';
                zoomBtn.innerHTML = '<i data-lucide="maximize-2" style="width: 12px; height: 12px;"></i><span>원본 크기</span>';
                zoomBtn.onclick = () => toggleMermaidZoom(zoomBtn);
                
                // 전체화면 버튼 생성
                const fsBtn = document.createElement('button');
                fsBtn.className = 'mermaid-fs-btn';
                fsBtn.innerHTML = '<i data-lucide="expand" style="width: 12px; height: 12px;"></i><span>전체화면</span>';
                fsBtn.onclick = () => openMermaidFullscreen(fsBtn);
                
                controlsDiv.appendChild(zoomBtn);
                controlsDiv.appendChild(fsBtn);
                
                containerDiv.appendChild(controlsDiv);
                containerDiv.appendChild(graphDiv);
                preEl.replaceWith(containerDiv);
                
                try {
                    // Mermaid 문법 검사 후 드로잉
                    await mermaid.parse(codeText);
                    const { svg, bindFunctions } = await mermaid.render(`mermaid-svg-${index}`, codeText);
                    graphDiv.innerHTML = svg;
                    
                    const renderedSvg = graphDiv.querySelector('svg');
                    if (renderedSvg) {
                        // WebView2 폰트 렌더링 오차로 인한 하단 잘림 해결: 높이를 15px 보정하여 안전 공간 확보
                        const curHeightAttr = renderedSvg.getAttribute('height');
                        if (curHeightAttr) {
                            const curHeight = parseFloat(curHeightAttr);
                            if (!isNaN(curHeight)) {
                                renderedSvg.setAttribute('height', (curHeight + 15) + 'px');
                            }
                        }
                        if (renderedSvg.style.height) {
                            const curStyleHeight = parseFloat(renderedSvg.style.height);
                            if (!isNaN(curStyleHeight)) {
                                renderedSvg.style.height = (curStyleHeight + 15) + 'px';
                            }
                        }
                    }

                    if (bindFunctions) {
                        bindFunctions(graphDiv);
                    }
                    lucide.createIcons();
                } catch (err) {
                    // 에러 시 컨트롤 패널 제거
                    controlsDiv.remove();
                    containerDiv.innerHTML = `
                        <div class="mermaid-error">
                            <div class="error-title">
                                <i data-lucide="alert-triangle" style="width: 16px; height: 16px;"></i>
                                <span>Mermaid 다이어그램 문법 오류</span>
                            </div>
                            <div style="font-size: 0.85em; opacity: 0.85; margin-bottom: 8px;">오타가 있거나 문법 규격에 맞지 않습니다. 아래 에러 로그를 확인해 주세요:</div>
                            <pre style="margin: 0; background: rgba(0,0,0,0.2) !important; font-size:0.8em; color: #ef4444; border:none; padding:8px;">${err.message || err}</pre>
                        </div>
                    `;
                    lucide.createIcons();
                }
            }
        }

        function toggleMermaidZoom(btn) {
            const container = btn.closest('.mermaid-container');
            const isZoomed = container.classList.toggle('zoomed');
            const svg = container.querySelector('.mermaid svg');
            const icon = btn.querySelector('[data-lucide]');
            
            if (svg) {
                if (isZoomed) {
                    btn.querySelector('span').innerText = '화면에 맞춤';
                    icon.setAttribute('data-lucide', 'minimize-2');
                    
                    // 원본 크기로 강제 확대하기 위해 viewBox 또는 원래 style의 max-width 값을 width로 임시 설정
                    const maxWidthStyle = svg.style.maxWidth;
                    if (maxWidthStyle && maxWidthStyle !== 'none') {
                        svg.setAttribute('data-original-max-width', maxWidthStyle);
                        svg.style.width = maxWidthStyle; // e.g. "638px"
                        svg.style.maxWidth = 'none';
                    } else {
                        // style에 없으면 viewBox에서 추출
                        const viewBox = svg.getAttribute('viewBox');
                        if (viewBox) {
                            const widthVal = viewBox.split(' ')[2];
                            if (widthVal) {
                                svg.style.width = widthVal + 'px';
                                svg.style.maxWidth = 'none';
                            }
                        }
                    }
                } else {
                    btn.querySelector('span').innerText = '원본 크기';
                    icon.setAttribute('data-lucide', 'maximize-2');
                    
                    // 원래 상태로 환원
                    svg.style.width = '';
                    svg.style.maxWidth = '';
                }
            } else {
                if (isZoomed) {
                    btn.querySelector('span').innerText = '화면에 맞춤';
                    icon.setAttribute('data-lucide', 'minimize-2');
                } else {
                    btn.querySelector('span').innerText = '원본 크기';
                    icon.setAttribute('data-lucide', 'maximize-2');
                }
            }
            lucide.createIcons();
        }

        function openMermaidFullscreen(btn) {
            const container = btn.closest('.mermaid-container');
            const svg = container.querySelector('.mermaid svg');
            if (!svg) return;
            
            const modal = document.getElementById('mermaid-fs-modal');
            const content = modal.querySelector('.fs-modal-content');
            
            // SVG를 깊은 클론(Deep Clone)하여 주입
            content.innerHTML = svg.outerHTML;
            
            // 모달 노출 및 애니메이션 트리거
            modal.style.display = 'flex';
            modal.offsetHeight; // force reflow
            modal.classList.add('show');
            
            // 모달 내부 SVG 크기 최대화 스타일 지정
            const fsSvg = content.querySelector('svg');
            if (fsSvg) {
                // viewBox에서 실제 가로/세로 추출하여 고정 픽셀로 지정 (CSS 순환 허탈 방지)
                const viewBox = fsSvg.getAttribute('viewBox');
                if (viewBox) {
                    const parts = viewBox.split(/\\s+/);
                    if (parts.length >= 4) {
                        const vbWidth = parseFloat(parts[2]);
                        const vbHeight = parseFloat(parts[3]);
                        if (!isNaN(vbWidth) && !isNaN(vbHeight)) {
                            fsSvg.style.setProperty('width', vbWidth + 'px', 'important');
                            fsSvg.style.setProperty('height', vbHeight + 'px', 'important');
                        }
                    }
                } else {
                    fsSvg.style.setProperty('width', 'auto', 'important');
                    fsSvg.style.setProperty('height', 'auto', 'important');
                }
                fsSvg.style.setProperty('max-width', '100%', 'important');
                fsSvg.style.setProperty('max-height', '80vh', 'important');
            }
            
            document.addEventListener('keydown', handleFsEsc);
            lucide.createIcons();
        }

        function closeMermaidFullscreen(event) {
            if (event && event.target.closest('.fs-modal-content')) return;
            
            const modal = document.getElementById('mermaid-fs-modal');
            modal.classList.remove('show');
            
            setTimeout(() => {
                modal.style.display = 'none';
                modal.querySelector('.fs-modal-content').innerHTML = "";
            }, 300);
            
            document.removeEventListener('keydown', handleFsEsc);
        }

        function handleFsEsc(e) {
            if (e.key === 'Escape') {
                closeMermaidFullscreen();
            }
        }

        function undoEditor() {
            if (window.undoManager) {
                const undone = window.undoManager.undo();
                if (undone) {
                    showToast("되돌리기(Undo) 완료");
                }
            }
        }

        function redoEditor() {
            if (window.undoManager) {
                const redone = window.undoManager.redo();
                if (redone) {
                    showToast("다시 실행(Redo) 완료");
                }
            }
        }

        // 사이드바 수식 입력기 및 화학식 검색기 탭 전환 기능
        function setSidebarTab(tab) {
            const explorerPane = document.getElementById('sidebar-content-explorer');
            const mathPane = document.getElementById('sidebar-content-math');
            const chemistryPane = document.getElementById('sidebar-content-chemistry');
            
            const tabBtnExplorer = document.getElementById('tab-explorer');
            const tabBtnMath = document.getElementById('tab-math');
            const tabBtnChemistry = document.getElementById('tab-chemistry');
            
            // 모든 패널 숨김
            explorerPane.style.display = 'none';
            mathPane.style.display = 'none';
            if (chemistryPane) chemistryPane.style.display = 'none';
            
            // 모든 탭 버튼 비활성화
            tabBtnExplorer.classList.remove('active');
            tabBtnMath.classList.remove('active');
            if (tabBtnChemistry) tabBtnChemistry.classList.remove('active');
            
            tabBtnExplorer.style.borderBottom = '2px solid transparent';
            tabBtnExplorer.style.color = 'var(--text-muted)';
            tabBtnMath.style.borderBottom = '2px solid transparent';
            tabBtnMath.style.color = 'var(--text-muted)';
            if (tabBtnChemistry) {
                tabBtnChemistry.style.borderBottom = '2px solid transparent';
                tabBtnChemistry.style.color = 'var(--text-muted)';
            }
            
            // 선택된 탭 활성화
            if (tab === 'explorer') {
                explorerPane.style.display = 'flex';
                tabBtnExplorer.classList.add('active');
                tabBtnExplorer.style.borderBottom = '2px solid var(--accent)';
                tabBtnExplorer.style.color = 'var(--text-main)';
            } else if (tab === 'math') {
                mathPane.style.display = 'flex';
                tabBtnMath.classList.add('active');
                tabBtnMath.style.borderBottom = '2px solid var(--accent)';
                tabBtnMath.style.color = 'var(--text-main)';
                renderSidebarMath();
            } else if (tab === 'chemistry') {
                if (chemistryPane) chemistryPane.style.display = 'flex';
                if (tabBtnChemistry) {
                    tabBtnChemistry.classList.add('active');
                    tabBtnChemistry.style.borderBottom = '2px solid var(--accent)';
                    tabBtnChemistry.style.color = 'var(--text-main)';
                }
            }
        }

        function setMathSubTab(subtab) {
            const subtabMath = document.getElementById('subtab-math-math');
            const subtabPhysics = document.getElementById('subtab-math-physics');
            const subtabBio = document.getElementById('subtab-math-bio');
            
            const contentMath = document.getElementById('math-subtab-content-math');
            const contentPhysics = document.getElementById('math-subtab-content-physics');
            const contentBio = document.getElementById('math-subtab-content-bio');
            
            // 모든 콘텐츠 숨김
            contentMath.style.display = 'none';
            contentPhysics.style.display = 'none';
            contentBio.style.display = 'none';
            
            // 모든 탭 버튼 비활성화
            subtabMath.classList.remove('active');
            subtabPhysics.classList.remove('active');
            subtabBio.classList.remove('active');
            
            subtabMath.style.background = 'transparent';
            subtabMath.style.color = 'var(--text-muted)';
            subtabPhysics.style.background = 'transparent';
            subtabPhysics.style.color = 'var(--text-muted)';
            subtabBio.style.background = 'transparent';
            subtabBio.style.color = 'var(--text-muted)';
            
            // 선택된 탭 활성화
            if (subtab === 'math') {
                contentMath.style.display = 'flex';
                subtabMath.classList.add('active');
                subtabMath.style.background = 'var(--accent-glow)';
                subtabMath.style.color = 'var(--accent)';
            } else if (subtab === 'physics') {
                contentPhysics.style.display = 'flex';
                subtabPhysics.classList.add('active');
                subtabPhysics.style.background = 'var(--accent-glow)';
                subtabPhysics.style.color = 'var(--accent)';
            } else if (subtab === 'bio') {
                contentBio.style.display = 'flex';
                subtabBio.classList.add('active');
                subtabBio.style.background = 'var(--accent-glow)';
                subtabBio.style.color = 'var(--accent)';
            }
            
            // KaTeX 렌더링 트리거 (렌더러 상태 플래그 초기화하여 새로운 영역도 렌더링되게 함)
            isSidebarMathRendered = false; 
            renderSidebarMath();
        }

        function insertMathSymbol(latex) {
            const textarea = document.getElementById('editor');
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            
            let replacement = latex;
            if (start !== end) {
                const selected = text.substring(start, end);
                if (latex.includes('?')) {
                    replacement = latex.replace('?', selected);
                } else {
                    replacement = selected + latex;
                }
            }
            
            if (window.undoManager) window.undoManager.saveState();
            
            const before = text.substring(0, start);
            const after = text.substring(end);
            textarea.value = before + replacement + after;
            
            // 물음표(?) 기호가 있으면 물음표를 블록 선택하여 사용자 편의 극대화
            const qIndex = replacement.indexOf('?');
            textarea.focus();
            if (replacement.includes('?') && qIndex !== -1) {
                const targetPos = start + qIndex;
                textarea.selectionStart = targetPos;
                textarea.selectionEnd = targetPos + 1;
            } else {
                textarea.selectionStart = textarea.selectionEnd = start + replacement.length;
            }
            
            handleEditorInput();
            if (window.undoManager) window.undoManager.saveState();
            showToast("수식 기호가 에디터에 삽입되었습니다.");
        }

        let isSidebarMathRendered = false;
        function renderSidebarMath() {
            if (isSidebarMathRendered) return; // 이미 렌더링되었으면 패스 (속도 절약)
            
            const mathPane = document.getElementById('sidebar-content-math');
            if (!mathPane) return;
            
            const textNodes = [];
            function findTextNodes(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node.nodeValue.includes('$$') || node.nodeValue.includes('$')) {
                        textNodes.push(node);
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'SCRIPT') {
                    node.childNodes.forEach(child => findTextNodes(child));
                }
            }
            findTextNodes(mathPane);
            
            textNodes.forEach(node => {
                const parent = node.parentNode;
                let val = node.nodeValue;
                
                // 블록 수식 $$...$$
                val = val.replace(/\\$\\$([\\s\\S]+?)\\$\\$/g, (match, math) => {
                    try {
                        return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
                    } catch (e) {
                        return match;
                    }
                });
                
                // 인라인 수식 $...$
                val = val.replace(/\\$([^\\$\\n\\r]+?)\\$/g, (match, math) => {
                    try {
                        return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
                    } catch (e) {
                        return match;
                    }
                });
                
                const span = document.createElement('span');
                span.innerHTML = val;
                parent.replaceChild(span, node);
            });
            
            isSidebarMathRendered = true;
        }

        // PubChem 화학식 연동 검색 실행
        let currentSearchResultSmiles = "";
        
        async function searchChemistryPubChem() {
            const inputEl = document.getElementById('chemistry-search-input');
            const query = inputEl.value.trim();
            if (!query) {
                alert("검색할 화합물 이름을 입력해주세요.");
                return;
            }
            
            const loadingEl = document.getElementById('chemistry-search-loading');
            const resultEl = document.getElementById('chemistry-search-result');
            
            loadingEl.style.display = 'flex';
            resultEl.style.display = 'none';
            
            try {
                if (!window.pywebview) {
                    throw new Error("파이썬 백엔드 연결을 찾을 수 없습니다.");
                }
                
                const res = await pywebview.api.search_pubchem_smiles(query);
                loadingEl.style.display = 'none';
                
                if (res.status === 'success') {
                    // 성공 피드백 및 프리뷰 바인딩
                    document.getElementById('chem-result-name').innerText = res.name;
                    document.getElementById('chem-result-cid').innerText = `PubChem CID: ${res.cid}`;
                    document.getElementById('chem-result-smiles').value = res.smiles;
                    currentSearchResultSmiles = res.smiles;
                    
                    resultEl.style.display = 'flex';
                    
                    // 2D 벡터 구조식 즉시 프리뷰 렌더링
                    renderSearchPreview(res.smiles);
                    showToast("화합물을 성공적으로 찾았습니다!");
                } else {
                    alert(res.message);
                }
            } catch (err) {
                loadingEl.style.display = 'none';
                alert("검색 오류: " + err.message);
            }
        }
        
        // 검색 결과 분자 구조 프리뷰 렌더링
        function renderSearchPreview(smiles) {
            const svgId = 'chem-preview-svg';
            const svgEl = document.getElementById(svgId);
            svgEl.innerHTML = ""; // 이전 프리뷰 클리어
            
            try {
                const theme = currentTheme === 'light' ? 'light' : 'dark';
                const drawerOptions = {
                    width: 150,
                    height: 150,
                    theme: theme,
                    bondThickness: 2.0,
                    bondLength: 15,
                    fontSizeLarge: 6,
                    fontSizeSmall: 4,
                    overlapSensitivity: 1.8,
                    doubleBondSpacing: 4
                };
                
                const drawer = new SmilesDrawer.SvgDrawer(drawerOptions);
                SmilesDrawer.parse(smiles, function(tree) {
                    drawer.draw(tree, svgId, theme, false);
                }, function(err) {
                    console.error("Preview render parsing error: ", err);
                });
            } catch (e) {
                console.error("Preview render exception: ", e);
            }
        }
        
        // 에디터 커서 위치에 분자식 삽입
        function insertChemistryToEditor() {
            if (!currentSearchResultSmiles) return;
            
            const textarea = document.getElementById('editor');
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            
            const smilesBlock = "\\n" + "```smiles\\n" + currentSearchResultSmiles + "\\n" + "```\\n";
            
            textarea.value = text.substring(0, start) + smilesBlock + text.substring(end);
            
            // 커서 포지션 재정렬
            textarea.selectionStart = textarea.selectionEnd = start + smilesBlock.length;
            
            handleEditorInput();
            if (window.undoManager) window.undoManager.saveState();
            
            showToast("에디터에 화학 구조식이 삽입되었습니다!");
        }

        function toggleDocumentFullscreen() {
            const pane = document.getElementById('preview-pane');
            if (!document.fullscreenElement) {
                pane.requestFullscreen().then(() => {
                    showToast("문서 전체화면 모드 (종료: Esc / 더블클릭)");
                }).catch(err => {
                    console.error("Fullscreen failed:", err);
                });
            } else {
                document.exitFullscreen();
            }
        }

        // 사이드바 슬라이딩 토글 실행
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar-panel');
            const icon = document.getElementById('sidebar-slide-icon');
            const btn = document.getElementById('sidebar-slide-btn');
            
            const isCollapsed = sidebar.classList.toggle('collapsed');
            
            if (isCollapsed) {
                icon.setAttribute('data-lucide', 'chevron-right');
                btn.title = "사이드바 열기";
                showToast("사이드바를 접었습니다.");
            } else {
                icon.setAttribute('data-lucide', 'chevron-left');
                btn.title = "사이드바 접기";
                showToast("사이드바를 열었습니다.");
            }
            lucide.createIcons();
        }

        // 우측 TOC 슬라이딩 토글 실행
        function toggleToc() {
            const toc = document.getElementById('sidebar-toc');
            const icon = document.getElementById('toc-slide-icon');
            const btn = document.getElementById('toc-slide-btn');
            
            const isCollapsed = toc.classList.toggle('collapsed');
            isTocManualCollapsed = isCollapsed;
            
            if (isCollapsed) {
                icon.setAttribute('data-lucide', 'chevron-left');
                btn.title = "문서 개요 열기";
                showToast("문서 개요를 접었습니다.");
            } else {
                icon.setAttribute('data-lucide', 'chevron-right');
                btn.title = "문서 개요 접기";
                showToast("문서 개요를 열었습니다.");
            }
            lucide.createIcons();
        }

        // Fullscreen 이벤트 및 더블클릭 리스너 등록
        document.addEventListener('fullscreenchange', () => {
            const icon = document.getElementById('fs-doc-icon');
            if (icon) {
                const isFs = !!document.fullscreenElement;
                icon.setAttribute('data-lucide', isFs ? 'shrink' : 'expand');
                lucide.createIcons();
            }
        });

        document.addEventListener('DOMContentLoaded', () => {
            const pane = document.getElementById('preview-pane');
            if (pane) {
                pane.addEventListener('dblclick', (e) => {
                    // 버튼, 링크, 코드박스, 이미지 등을 클릭한 게 아닐 때만 작동
                    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('pre') || e.target.closest('img') || e.target.closest('.mermaid-container')) return;
                    toggleDocumentFullscreen();
                });
            }
        });

        function applyCodeHighlighting(container) {
            const preBlocks = container.querySelectorAll('pre');
            preBlocks.forEach(pre => {
                const code = pre.querySelector('code');
                if (code) {
                    // 복사 버튼 추가
                    const copyBtn = document.createElement('button');
                    copyBtn.className = 'code-copy-btn';
                    copyBtn.innerText = '복사';
                    copyBtn.onclick = () => {
                        navigator.clipboard.writeText(code.textContent);
                        copyBtn.innerText = '복사 완료!';
                        copyBtn.style.color = '#10b981';
                        setTimeout(() => {
                            copyBtn.innerText = '복사';
                            copyBtn.style.color = '';
                        }, 2000);
                    };
                    pre.appendChild(copyBtn);
                    
                    // PrismJS 코드 하이라이트
                    Prism.highlightElement(code);
                }
            });
        }

        let isTocManualCollapsed = false;

        function generateTOC(container) {
            const list = document.getElementById('toc-list');
            list.innerHTML = "";
            
            const headings = container.querySelectorAll('h1, h2, h3');
            const tocPanel = document.getElementById('sidebar-toc');
            const tocBtn = document.getElementById('toc-slide-btn');
            
            if (headings.length === 0) {
                tocPanel.style.display = 'none';
                if (tocBtn) tocBtn.style.display = 'none';
                return;
            }
            
            tocPanel.style.display = 'flex';
            if (tocBtn) tocBtn.style.display = 'flex';
            
            // 인라인 스타일 제거하여 CSS 규칙(width)이 적용되도록 함
            tocPanel.style.width = '';
            tocPanel.style.padding = '';
            
            // 수동 접힘 상태에 맞춰 클래스 유지
            if (isTocManualCollapsed) {
                tocPanel.classList.add('collapsed');
                const icon = document.getElementById('toc-slide-icon');
                const btn = document.getElementById('toc-slide-btn');
                if (icon) icon.setAttribute('data-lucide', 'chevron-left');
                if (btn) btn.title = "문서 개요 열기";
            } else {
                tocPanel.classList.remove('collapsed');
                const icon = document.getElementById('toc-slide-icon');
                const btn = document.getElementById('toc-slide-btn');
                if (icon) icon.setAttribute('data-lucide', 'chevron-right');
                if (btn) btn.title = "문서 개요 접기";
            }
            if (window.lucide) lucide.createIcons();
            
            headings.forEach((h, index) => {
                const id = `heading-jump-${index}`;
                h.id = id;
                
                const li = document.createElement('li');
                li.className = `toc-item toc-${h.tagName.toLowerCase()}`;
                li.innerText = h.innerText;
                li.onclick = () => {
                    h.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // 활성화 표시
                    document.querySelectorAll('.toc-item').forEach(el => el.classList.remove('active'));
                    li.classList.add('active');
                };
                
                list.appendChild(li);
            });
        }

        // ----------------- 단축키 및 에디터 키 편의 기능 -----------------
        
        const textarea = document.getElementById('editor');
        
        // 글로벌 단축키 지원 (저장 / 되돌리기 / 다시 실행)
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                saveActiveFile();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undoEditor();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redoEditor();
            }
        });
        
        // 괄호/따옴표 자동 닫기 기능
        textarea.addEventListener('keydown', (e) => {
            const pairs = {
                '{': '}',
                '[': ']',
                '(': ')',
                '"': '"',
                "'": "'",
                '`': '`'
            };
            
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            
            // Tab 키 들여쓰기 처리
            if (e.key === 'Tab') {
                e.preventDefault();
                if (window.undoManager) window.undoManager.saveState();
                const before = textarea.value.substring(0, start);
                const after = textarea.value.substring(end);
                textarea.value = before + "    " + after;
                textarea.selectionStart = textarea.selectionEnd = start + 4;
                handleEditorInput();
                if (window.undoManager) window.undoManager.saveState();
            }
            
            // 자동 완성 쌍 매칭
            if (pairs[e.key] !== undefined) {
                e.preventDefault();
                if (window.undoManager) window.undoManager.saveState();
                const closingChar = pairs[e.key];
                const before = textarea.value.substring(0, start);
                const after = textarea.value.substring(end);
                
                // 만약 선택 영역이 있는 경우 감싸기
                if (start !== end) {
                    const selected = textarea.value.substring(start, end);
                    textarea.value = before + e.key + selected + closingChar + after;
                    textarea.selectionStart = start + 1;
                    textarea.selectionEnd = end + 1;
                } else {
                    textarea.value = before + e.key + closingChar + after;
                    textarea.selectionStart = textarea.selectionEnd = start + 1;
                }
                handleEditorInput();
                if (window.undoManager) window.undoManager.saveState();
            }
        });

        // 뷰 모드 조절
        function setViewMode(mode) {
            currentViewMode = mode;
            
            const paneEditor = document.getElementById('pane-editor');
            const panePreview = document.getElementById('pane-preview');
            const resizer = document.getElementById('pane-resizer');
            
            document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(`mode-${mode}`).classList.add('active');
            
            if (mode === 'edit') {
                paneEditor.style.display = 'flex';
                paneEditor.style.flex = '1';
                paneEditor.style.width = '';
                panePreview.style.display = 'none';
                if (resizer) resizer.style.display = 'none';
            } else if (mode === 'preview') {
                paneEditor.style.display = 'none';
                panePreview.style.display = 'flex';
                panePreview.style.flex = '1';
                panePreview.style.width = '';
                if (resizer) resizer.style.display = 'none';
            } else {
                paneEditor.style.display = 'flex';
                panePreview.style.display = 'flex';
                if (resizer) resizer.style.display = 'block';
                
                // 기존 크기 조절값 복원 또는 50:50 분할
                if (paneEditor.style.width) {
                    paneEditor.style.flex = 'none';
                    panePreview.style.flex = 'none';
                } else {
                    paneEditor.style.flex = '1';
                    paneEditor.style.width = '';
                    panePreview.style.flex = '1';
                    panePreview.style.width = '';
                }
            }
            
            // 뷰 변경 시 Mermaid 차트 사이즈 등 리사이징 보정
            triggerLiveRender();
        }

        // 스플릿 뷰 드래그 크기 조절 기능
        let isDraggingResizer = false;

        document.addEventListener('DOMContentLoaded', () => {
            const resizer = document.getElementById('pane-resizer');
            const paneEditor = document.getElementById('pane-editor');
            const panePreview = document.getElementById('pane-preview');
            const workspace = document.querySelector('.workspace-panes');

            if (!resizer) return;

            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                isDraggingResizer = true;
                resizer.classList.add('dragging');
                document.body.style.cursor = 'col-resize';
                
                // 드래그 전용 오버레이 추가하여 마우스 포인터 유실 방지
                const overlay = document.createElement('div');
                overlay.id = 'resizer-drag-overlay';
                overlay.style.position = 'fixed';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100vw';
                overlay.style.height = '100vh';
                overlay.style.zIndex = '99999';
                overlay.style.cursor = 'col-resize';
                document.body.appendChild(overlay);
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDraggingResizer) return;

                const workspaceRect = workspace.getBoundingClientRect();
                const offsetX = e.clientX - workspaceRect.left;
                
                // 조절 범위 제한 (15% ~ 85%)
                const minWidth = workspaceRect.width * 0.15;
                const maxWidth = workspaceRect.width * 0.85;
                
                let newWidth = offsetX;
                if (newWidth < minWidth) newWidth = minWidth;
                if (newWidth > maxWidth) newWidth = maxWidth;

                const percent = (newWidth / workspaceRect.width) * 100;
                
                paneEditor.style.flex = 'none';
                paneEditor.style.width = `${percent}%`;
                
                panePreview.style.flex = 'none';
                panePreview.style.width = `${100 - percent}%`;
            });

            document.addEventListener('mouseup', () => {
                if (!isDraggingResizer) return;
                
                isDraggingResizer = false;
                resizer.classList.remove('dragging');
                document.body.style.cursor = '';
                
                const overlay = document.getElementById('resizer-drag-overlay');
                if (overlay) overlay.remove();
                
                // 크기 변경 완료 후 Live Render 갱신 및 차트 리사이즈 보정
                triggerLiveRender();
            });
        });

        // 파일 저장 (Python 연동)
        async function saveActiveFile() {
            if (!currentFilePath) {
                alert("저장할 활성화된 파일이 없습니다. 좌측에서 새 파일을 생성하거나 선택해 주세요.");
                return;
            }
            const content = document.getElementById('editor').value;
            const res = await pywebview.api.save_file(currentFilePath, content);
            if (res.status === 'success') {
                showToast("성공적으로 저장되었습니다.");
            } else {
                alert("저장 오류: " + res.message);
            }
        }

        // HTML standalone 파일 내보내기
        async function exportToHtml() {
            if (!currentFilePath) {
                alert("내보낼 활성화된 파일이 없습니다.");
                return;
            }
            const htmlBody = document.getElementById('preview-content').innerHTML;
            const res = await pywebview.api.export_html(currentFilePath, htmlBody, currentFilePath);
            if (res.status === 'success') {
                showToast(`HTML 저장 완료: ${res.dest}`);
            } else {
                alert("내보내기 실패: " + res.message);
            }
        }

        // PDF 인쇄 실행 (미리보기 화면만 밝은 테마로 자동 최적화하여 깔끔하게 출력)
        async function printDocument() {
            if (!currentFilePath) {
                alert("인쇄할 활성화된 파일이 없습니다.");
                return;
            }
            
            const originalTheme = currentTheme;
            
            // 다크 테마인 경우, 인쇄 가독성을 위해 일시적으로 고대비 라이트 테마로 자동 전환
            if (originalTheme === 'dark') {
                setTheme('light', false); // 파일 DB 저장을 우회하여 메모리 상에서만 테마 상태 변경
                
                // 테마가 가볍게 바뀐 뒤, Mermaid 다이어그램 및 화학 구조식(SMILES)이
                // 화이트 인쇄용 테마로 고해상도 리렌더링을 완전히 완료할 때까지 대기 (450ms)
                setTimeout(() => {
                    window.print();
                    
                    // 인쇄창이 호출되거나 닫힌 즉시 원래의 세련된 다크 테마로 깜쪽같이 원복
                    setTimeout(() => {
                        setTheme('dark', false);
                        showToast("인쇄가 정상 호출되어 다크 테마를 복원했습니다.");
                    }, 100);
                }, 450);
            } else {
                // 이미 라이트 테마인 경우 즉시 출력
                window.print();
            }
        }

        // ----------------- 모달 & 파일 트리 CRUD 연동 -----------------
        
        function openCreateModal(type) {
            isCreatingType = type;
            document.getElementById('modal-card-title').innerText = type === 'folder' ? '새 폴더 생성' : '새 마크다운 문서 생성';
            document.getElementById('modal-card-input').value = type === 'folder' ? 'new_folder' : 'document.md';
            document.getElementById('create-modal').style.display = 'flex';
            document.getElementById('modal-card-input').focus();
        }

        function closeCreateModal() {
            document.getElementById('create-modal').style.display = 'none';
        }

        async function submitCreateItem() {
            const name = document.getElementById('modal-card-input').value.trim();
            if (!name) {
                alert("이름을 제대로 입력해 주세요.");
                return;
            }
            
            // 현재 활성화된 폴더나 루트에 생성
            const res = await pywebview.api.create_item(name, isCreatingType);
            if (res.status === 'success') {
                renderFileTree(res.files);
                closeCreateModal();
                showToast("항목이 성공적으로 생성되었습니다.");
                if (isCreatingType === 'file') {
                    openFile(name);
                }
            } else {
                alert("생성 실패: " + res.message);
            }
        }

        async function deleteWorkspaceItem(event, relPath) {
            event.stopPropagation();
            const fileName = relPath.substring(relPath.lastIndexOf('/') + 1);
            if (confirm(`정말 "${fileName}" 문서를 내 서재 목록에서 제외하시겠습니까?\n\n(※ 실제 컴퓨터 내의 원본 파일은 절대 삭제되지 않고 안전하게 보존됩니다)`)) {
                const res = await pywebview.api.delete_item(relPath);
                if (res.status === 'success') {
                    renderFileTree(res.files);
                    if (currentFilePath === relPath) {
                        currentFilePath = "";
                        document.getElementById('active-file-title').innerText = "선택된 파일 없음";
                        document.getElementById('editor').value = "";
                        updateLineNumbers();
                        document.getElementById('preview-content').innerHTML = `
                            <div class="empty-state">
                                <div class="empty-state-icon"><i data-lucide="markdown" style="width: 64px; height: 64px;"></i></div>
                                <div style="font-size: 1.1em; font-weight: 500;">문서가 내 서재 목록에서 제외되었습니다.</div>
                            </div>
                        `;
                        lucide.createIcons();
                    }
                    showToast("내 서재 목록에서 제외했습니다.");
                } else {
                    alert("서재 제외 실패: " + res.message);
                }
            }
        }

        // ----------------- 네트워크 설정 및 인증 -----------------
        function openSettingsModal() {
            document.getElementById('settings-bind-ip').value = currentNetworkConfig.bind_ip;
            document.getElementById('settings-port').value = currentNetworkConfig.port;
            document.getElementById('settings-password').value = currentNetworkConfig.access_password;
            
            // 내부 및 공인 IP 정보 표시
            document.getElementById('settings-local-ip').innerText = currentNetworkConfig.local_ip;
            const publicIpEl = document.getElementById('settings-public-ip');
            publicIpEl.innerText = "조회 중...";
            
            fetch('https://api.ipify.org?format=json')
                .then(res => res.json())
                .then(data => {
                    publicIpEl.innerText = data.ip;
                })
                .catch(err => {
                    publicIpEl.innerText = "조회 실패 (네트워크 점검 필요)";
                });

            document.getElementById('settings-modal').style.display = 'flex';
            lucide.createIcons();
        }

        function closeSettingsModal() {
            document.getElementById('settings-modal').style.display = 'none';
        }

        function toggleSettingsPasswordView() {
            const pwdInput = document.getElementById('settings-password');
            pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
        }

        async function saveSettings() {
            const bindIp = document.getElementById('settings-bind-ip').value;
            const port = parseInt(document.getElementById('settings-port').value) || 58220;
            const accessPassword = document.getElementById('settings-password').value;
            try {
                const res = await pywebview.api.save_network_settings(bindIp, port, accessPassword);
                if (res.status === 'success') {
                    currentNetworkConfig.bind_ip = bindIp;
                    currentNetworkConfig.port = port;
                    currentNetworkConfig.access_password = accessPassword;
                    localStorage.setItem('access_password', accessPassword);
                    showToast("네트워크 및 보안 설정이 저장되었습니다!");
                    closeSettingsModal();
                } else {
                    alert("설정 저장 실패: " + res.message);
                }
            } catch (err) {
                alert("설정 저장 오류: " + err.message);
            }
        }

        function showAuthOverlay() {
            // 데스크톱 앱 내부 직접 실행 시에는 암호 오버레이창 차단
            if (window.pywebview && !window.pywebview.is_browser_proxy) {
                console.log("Native Desktop mode. Bypassing auth overlay.");
                const splash = document.getElementById('splash-screen');
                if (splash) splash.style.display = 'none';
                return;
            }
            const splash = document.getElementById('splash-screen');
            if (splash) splash.style.display = 'none';
            document.getElementById('auth-overlay').style.display = 'flex';
            document.getElementById('auth-password-input').focus();
            lucide.createIcons();
        }

        async function submitAuthPassword() {
            const pwdInput = document.getElementById('auth-password-input');
            const password = pwdInput.value;
            const errorMsg = document.getElementById('auth-error-msg');
            errorMsg.style.display = 'none';
            localStorage.setItem('access_password', password);
            try {
                const res = await pywebview.api.get_initial_state();
                if (res && res.status !== 'auth_failed') {
                    document.getElementById('auth-overlay').style.display = 'none';
                    initApp();
                } else {
                    errorMsg.style.display = 'block';
                    pwdInput.value = "";
                    pwdInput.focus();
                    localStorage.removeItem('access_password');
                }
            } catch (err) {
                errorMsg.style.display = 'block';
                pwdInput.value = "";
                pwdInput.focus();
                localStorage.removeItem('access_password');
            }
        }

        // 토스트 팝업 띄우기
        function showToast(message) {
            const toast = document.getElementById('toast');
            document.getElementById('toast-message').innerText = message;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
        
        // ----------------- 외부 드래그 앤 드롭 파일 로드 -----------------
        function setupDragAndDrop() {
            const dropzone = document.getElementById('main-dropzone');
            const overlay = document.getElementById('drag-overlay');
            
            window.addEventListener('dragenter', (e) => {
                e.preventDefault();
                overlay.classList.add('active');
            });
            
            overlay.addEventListener('dragover', (e) => {
                e.preventDefault();
            });
            
            overlay.addEventListener('dragleave', (e) => {
                e.preventDefault();
                overlay.classList.remove('active');
            });
            
            window.addEventListener('drop', async (e) => {
                e.preventDefault();
                overlay.classList.remove('active');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const file = files[0];
                    if (file.name.endsWith('.md') || file.name.endsWith('.qmd') || file.name.endsWith('.txt')) {
                        // 만약 워크스페이스 외부 파일인 경우, 임시로 읽거나 경고 후 새 파일 생성 방식으로 서빙
                        // 에디터 텍스트에 직접 드랍 데이터 로드
                        const reader = new FileReader();
                        reader.onload = function(evt) {
                            currentFilePath = file.name; // 로컬 가상 주소
                            document.getElementById('active-file-title').innerText = file.name + " (외부 파일 - 저장 시 워크스페이스에 생성)";
                            document.getElementById('editor').value = evt.target.result;
                            updateLineNumbers();
                            triggerLiveRender();
                            showToast("외부 파일을 읽어왔습니다.");
                        };
                        reader.readAsText(file);
                    } else {
                        alert("지원하지 않는 파일 형식입니다. 마크다운(.md, .qmd) 파일만 드롭해 주세요.");
                    }
                }
            });
        }
    </script>
</body>
</html>
"""

if __name__ == "__main__":
    api = MdViewerApi()
    
    # Bottle 로컬 서버 백그라운드 구동 (상대 경로 리소스/이미지 서빙용)
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    
    # 생성된 고품격 아이콘 복사 및 바인딩 (Windows의 경우 .ico 포맷 필수)
    src_icon = r"C:\Users\Yc.Cho\.gemini\antigravity\brain\8534f42c-f8d2-48b4-918f-fe2797c68a51\app_icon_1778997717949.png"
    dest_dir = os.path.dirname(os.path.abspath(__file__))
    dest_png = os.path.join(dest_dir, "app_icon.png")
    dest_ico = os.path.join(dest_dir, "app_icon.ico")
    
    if os.path.exists(src_icon) and not os.path.exists(dest_png):
        try:
            shutil.copy2(src_icon, dest_png)
        except:
            pass
            
    # PNG를 ICO 형식으로 자동 변환 (다중 사이즈 포함)
    if os.path.exists(dest_png) and not os.path.exists(dest_ico):
        try:
            from PIL import Image
            img = Image.open(dest_png)
            img.save(dest_ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
        except Exception as e:
            print("아이콘 변환 실패 (Pillow 필요):", e)
            
    # 웹뷰 창 로드
    window = webview.create_window(
        APP_NAME, 
        url=f"http://127.0.0.1:{PORT}", 
        js_api=api,
        width=1350, 
        height=850,
        background_color='#090a0f'
    )
    
    # Windows System.Drawing.Icon은 오직 .ico 파일만 수용하므로 변환된 .ico 사용
    webview.start(icon=dest_ico if os.path.exists(dest_ico) else None)
