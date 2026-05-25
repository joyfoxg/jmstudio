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
APP_NAME = "Joy Markdown Studio v3.7.3"
PORT = int(config.get("port", 58220))
BIND_IP = config.get("bind_ip", "0.0.0.0")

# Flask/Bottle 앱 초기화
app = Bottle()
active_workspace = os.path.abspath(os.getcwd())

if "last_workspace" in config and os.path.exists(config["last_workspace"]):
    active_workspace = os.path.abspath(config["last_workspace"])

# API 인스턴스 전역 바인딩
window = None
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
            "lang": cfg.get("lang", "ko"),
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

    def save_lang(self, lang):
        cfg = get_config()
        cfg["lang"] = lang
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
    <title>Joy Markdown Studio v3.7.3</title>
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

        /* 언어 토글 버튼 */
        .lang-toggle-container {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 2px;
            cursor: pointer;
            display: inline-flex;
            position: relative;
            user-select: none;
            transition: all 0.2s ease;
            margin-left: 8px;
        }
        .theme-light .lang-toggle-container {
            background: rgba(0, 0, 0, 0.03);
        }
        .lang-toggle-container:hover {
            border-color: var(--accent);
            box-shadow: 0 0 8px var(--accent-glow);
        }
        .lang-toggle-track {
            display: flex;
            align-items: center;
            position: relative;
            width: 64px;
            height: 24px;
        }
        .lang-text {
            flex: 1;
            font-size: 0.72em;
            font-weight: 700;
            text-align: center;
            z-index: 2;
            transition: color 0.2s ease;
            color: var(--text-muted);
            line-height: 24px;
            font-family: 'Outfit', sans-serif;
        }
        .lang-toggle-thumb {
            position: absolute;
            top: 1px;
            left: 1px;
            width: 30px;
            height: 22px;
            background: var(--accent);
            border-radius: 18px;
            z-index: 1;
            transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 0 8px var(--accent-glow);
        }
        .lang-ko .lang-text.ko {
            color: #090a0f !important;
        }
        .theme-light.lang-ko .lang-text.ko {
            color: #ffffff !important;
        }
        .lang-en .lang-text.en {
            color: #090a0f !important;
        }
        .theme-light.lang-en .lang-text.en {
            color: #ffffff !important;
        }
        .lang-ko .lang-toggle-thumb {
            transform: translateX(0);
        }
        .lang-en .lang-toggle-thumb {
            transform: translateX(32px);
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
    <script>
        if (window.lucide) {
            lucide.createIcons();
        }
    </script>

    <!-- 헤더 영역 -->
    <header>
        <div class="brand-section">
            <div class="brand-logo"><i data-lucide="book-open" style="width: 18px; height: 18px;"></i></div>
            <div class="brand-title">JM Studio</div>
            <button class="add-doc-btn" onclick="addDocumentToLibrary()" title="서재에 마크다운 문서(.md) 추가" data-i18n-title="tooltip_add_doc">
                <i data-lucide="file-plus" style="width: 14px; height: 14px;"></i>
                <span data-i18n="btn_add_doc">문서 추가</span>
            </button>
        </div>

        <!-- 뷰 모드 토글 -->
        <div class="view-mode-toggles">
            <button class="mode-btn" id="mode-edit" onclick="setViewMode('edit')">
                <i data-lucide="edit" style="width: 14px; height: 14px;"></i>
                <span data-i18n="mode_edit">편집기</span>
            </button>
            <button class="mode-btn active" id="mode-split" onclick="setViewMode('split')">
                <i data-lucide="columns" style="width: 14px; height: 14px;"></i>
                <span data-i18n="mode_split">스플릿</span>
            </button>
            <button class="mode-btn" id="mode-preview" onclick="setViewMode('preview')">
                <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
                <span data-i18n="mode_preview">미리보기</span>
            </button>
        </div>

        <!-- 액션 그룹 -->
        <div class="action-group">
            <button class="btn" onclick="toggleDocumentFullscreen()" title="문서 전체화면 (더블클릭 단축 지원)" data-i18n-title="tooltip_fullscreen">
                <i id="fs-doc-icon" data-lucide="expand" style="width: 14px; height: 14px;"></i>
                <span data-i18n="btn_fullscreen">문서 전체화면</span>
            </button>
            <button class="btn btn-accent" onclick="saveActiveFile()">
                <i data-lucide="save" style="width: 14px; height: 14px;"></i>
                <span data-i18n="btn_save">저장</span>
            </button>
            <button class="btn" onclick="exportToHtml()">
                <i data-lucide="external-link" style="width: 14px; height: 14px;"></i>
                <span data-i18n="btn_export_html">HTML 내보내기</span>
            </button>
            <button class="btn" onclick="printDocument()">
                <i data-lucide="printer" style="width: 14px; height: 14px;"></i>
                <span data-i18n="btn_print_pdf">PDF 인쇄</span>
            </button>
            <div class="lang-toggle-container" onclick="toggleLanguage()" title="언어 변경 / Switch Language" style="margin-left: 8px;">
                <div class="lang-toggle-track">
                    <span class="lang-text ko">KR</span>
                    <span class="lang-text en">EN</span>
                    <div class="lang-toggle-thumb"></div>
                </div>
            </div>
            <button class="icon-btn" onclick="toggleTheme()" title="테마 전환" data-i18n-title="tooltip_theme" style="margin-left: 8px;">
                <i id="theme-icon" data-lucide="sun" style="width: 18px; height: 18px;"></i>
            </button>
            <button class="icon-btn" onclick="openSettingsModal()" title="네트워크 및 보안 설정" data-i18n-title="tooltip_settings" style="margin-left: 4px;">
                <i data-lucide="settings" style="width: 18px; height: 18px;"></i>
            </button>
        </div>
    </header>

    <!-- 메인 워크스페이스 -->
    <main id="main-dropzone">
        <!-- 드래그 드롭 오버레이 -->
        <div class="drag-overlay" id="drag-overlay">
            <i data-lucide="upload-cloud" style="width: 48px; height: 48px;"></i>
            <div style="font-size: 1.2em; font-weight: 600;" data-i18n="msg_drag_drop_desc">여기에 마크다운 파일을 드롭하여 즉시 열기</div>
        </div>

        <!-- 사이드바 (내 서재 + 수식 입력기) -->
        <div class="sidebar" id="sidebar-panel" style="display: flex; flex-direction: column;">
            <div class="sidebar-tabs" style="display: flex; border-bottom: 1px solid var(--border); background: rgba(0,0,0,0.15);">
                <button class="sidebar-tab-btn active" id="tab-explorer" onclick="setSidebarTab('explorer')" style="flex: 1; padding: 12px; background: transparent; border: none; border-bottom: 2px solid var(--accent); color: var(--text-main); font-family: 'Outfit', sans-serif; font-size: 0.8em; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;">
                    <i data-lucide="folder" style="width: 14px; height: 14px;"></i>
                    <span data-i18n="tab_explorer">내 서재</span>
                </button>
                <button class="sidebar-tab-btn" id="tab-math" onclick="setSidebarTab('math')" style="flex: 1; padding: 12px; background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-family: 'Outfit', sans-serif; font-size: 0.8em; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;">
                    <i data-lucide="calculator" style="width: 14px; height: 14px;"></i>
                    <span data-i18n="tab_math">수식 입력기</span>
                </button>
                <button class="sidebar-tab-btn" id="tab-chemistry" onclick="setSidebarTab('chemistry')" style="flex: 1; padding: 12px; background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-family: 'Outfit', sans-serif; font-size: 0.8em; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;">
                    <i data-lucide="beaker" style="width: 14px; height: 14px;"></i>
                    <span data-i18n="tab_chemistry">화학식 검색</span>
                </button>
            </div>
            
            <!-- 내 서재 패널 -->
            <div class="sidebar-content-pane" id="sidebar-content-explorer" style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
                <div class="sidebar-header">
                    <span class="sidebar-title" data-i18n="sidebar_title_explorer">내 서재</span>
                    <div class="sidebar-actions">
                        <button class="icon-btn" onclick="openCreateModal('file')" title="새 파일 생성" data-i18n-title="tooltip_create_file">
                            <i data-lucide="file-plus" style="width: 16px; height: 16px;"></i>
                        </button>
                        <button class="icon-btn" onclick="openCreateModal('folder')" title="새 폴더 생성" data-i18n-title="tooltip_create_folder">
                            <i data-lucide="folder-plus" style="width: 16px; height: 16px;"></i>
                        </button>
                        <button class="icon-btn" onclick="refreshWorkspace()" title="목록 새로고침" data-i18n-title="tooltip_refresh">
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
                    <button class="math-subtab-btn active" id="subtab-math-math" onclick="setMathSubTab('math')" style="flex: 1; padding: 6px 2px; border: none; background: var(--accent-glow); color: var(--accent); font-family: 'Outfit', sans-serif; font-size: 0.72em; font-weight: 600; border-radius: 4px; cursor: pointer; transition: all 0.2s; white-space: nowrap;" data-i18n="math_subtab_math">📐 수학</button>
                    <button class="math-subtab-btn" id="subtab-math-physics" onclick="setMathSubTab('physics')" style="flex: 1; padding: 6px 2px; border: none; background: transparent; color: var(--text-muted); font-family: 'Outfit', sans-serif; font-size: 0.72em; font-weight: 600; border-radius: 4px; cursor: pointer; transition: all 0.2s; white-space: nowrap;" data-i18n="math_subtab_physics">⚛️ 물리</button>
                    <button class="math-subtab-btn" id="subtab-math-bio" onclick="setMathSubTab('bio')" style="flex: 1; padding: 6px 2px; border: none; background: transparent; color: var(--text-muted); font-family: 'Outfit', sans-serif; font-size: 0.72em; font-weight: 600; border-radius: 4px; cursor: pointer; transition: all 0.2s; white-space: nowrap;" data-i18n="math_subtab_bio">🧪 화학/생명</button>
                </div>

                <!-- 1. 수학 서브탭 콘텐츠 -->
                <div class="math-subtab-content" id="math-subtab-content-math" style="display: flex; flex-direction: column; gap: 16px;">
                    <div class="math-section">
                        <div class="math-section-title" data-i18n="math_title_basic">자주 쓰이는 기본 수식</div>
                        <div class="math-grid">
                            <button class="math-item" onclick="insertMathSymbol('$\\\\frac{?}{?}$')">$$\\frac{a}{b}$$<span data-i18n="math_label_fraction">분수</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\sqrt{?}$')">$$\\sqrt{x}$$<span data-i18n="math_label_sqrt">루트</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$?^{?}$')">$$a^b$$<span data-i18n="math_label_power">거듭제곱</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$?_{?}$')">$$a_n$$<span data-i18n="math_label_subscript">아래첨자</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\sum_{i=1}^{n} ?_{i}$')">$$\\sum x_i$$<span data-i18n="math_label_sum">합(Sum)</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\prod_{i=1}^{n} ?_{i}$')">$$\\prod x_i$$<span data-i18n="math_label_prod">곱(Prod)</span></button>
                        </div>
                    </div>
                    
                    <div class="math-section">
                        <div class="math-section-title" data-i18n="math_title_calculus">미적분 및 극한</div>
                        <div class="math-grid">
                            <button class="math-item" onclick="insertMathSymbol('$\\\\frac{d?}{d?}$')">$$\\frac{dy}{dx}$$<span data-i18n="math_label_diff">미분</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\frac{\\\\partial ?}{\\\\partial ?}$')">$$\\frac{\\partial y}{\\partial x}$$<span data-i18n="math_label_partial">편미분</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\int f(x)\\\\,dx$')">$$\\int$$<span data-i18n="math_label_indef_int">부정적분</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\int_{?}^{?} ?\\\\,d?$')">$$\\int_a^b$$<span data-i18n="math_label_def_int">정적분</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\lim_{? \\\\to ?} ?$')">$$\\lim$$<span data-i18n="math_label_limit">극한</span></button>
                        </div>
                    </div>

                    <div class="math-section">
                        <div class="math-section-title" data-i18n="math_title_greek">그리스 문자 (Greek)</div>
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
                        <div class="math-section-title" data-i18n="math_title_symbols">수학 기호</div>
                        <div class="math-grid">
                            <button class="math-item" onclick="insertMathSymbol('$\\\\infty$')">$$\\infty$$<span data-i18n="math_label_infinity">무한대</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\approx$')">$$\\approx$$<span data-i18n="math_label_approx">근사치</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\ne$')">$$\\ne$$<span data-i18n="math_label_ne">다름</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\times$')">$$\\times$$<span data-i18n="math_label_mul">곱셈</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\div$')">$$\\div$$<span data-i18n="math_label_div">나눗셈</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\vec{?}$')">$$\\vec{v}$$<span data-i18n="math_label_vector">벡터</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\to$')">$$\\to$$<span data-i18n="math_label_arrow">화살표</span></button>
                        </div>
                    </div>
                </div>

                <!-- 2. 물리학 서브탭 콘텐츠 -->
                <div class="math-subtab-content" id="math-subtab-content-physics" style="display: none; flex-direction: column; gap: 16px;">
                    <div class="math-section">
                        <div class="math-section-title" data-i18n="math_title_em_gravity">전자기학 및 중력</div>
                        <div class="math-grid">
                            <button class="math-item" onclick="insertMathSymbol('$F = k_e \\\\frac{q_1 q_2}{r^2}$')">$$F = k_e \\\\frac{q_1 q_2}{r^2}$$<span data-i18n="math_label_coulomb">쿨롱 법칙</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\vec{F} = q(\\\\vec{E} + \\\\vec{v} \\\\times \\\\vec{B})$')">$$\\\\vec{F} = q(\\\\vec{E} + \\\\vec{v} \\\\times \\\\vec{B})$$<span data-i18n="math_label_lorentz">로런츠 힘</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\oint \\\\vec{E} \\\\cdot d\\\\vec{A} = \\\\frac{Q}{\\\\varepsilon_0}$')">$$\\\\oint \\\\vec{E} \\\\cdot d\\\\vec{A} = \\\\frac{Q}{\\\\varepsilon_0}$$<span data-i18n="math_label_gauss">가우스 법칙</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$F = G \\\\frac{m_1 m_2}{r^2}$')">$$F = G \\\\frac{m_1 m_2}{r^2}$$<span data-i18n="math_label_gravity">만유인력</span></button>
                        </div>
                    </div>
                    
                    <div class="math-section">
                        <div class="math-section-title" data-i18n="math_title_quantum">양자역학 및 상대성이론</div>
                        <div class="math-grid">
                            <button class="math-item" onclick="insertMathSymbol('$E = mc^2$')">$$E = mc^2$$<span data-i18n="math_label_mass_energy">질량-에너지</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$E = h\\\\nu$')">$$E = h\\\\nu$$<span data-i18n="math_label_planck">플랑크-양자</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$i\\\\hbar\\\\frac{\\\\partial}{\\\\partial t}\\\\Psi = \\\\hat{H}\\\\Psi$')">$$i\\\\hbar\\\\frac{\\\\partial}{\\\\partial t}\\\\Psi = \\\\hat{H}\\\\Psi$$<span data-i18n="math_label_schrodinger">슈뢰딩거</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\Delta x \\\\Delta p \\\\ge \\\\frac{\\\\hbar}{2}$')">$$\\\\Delta x \\\\Delta p \\\\ge \\\\frac{\\\\hbar}{2}$$<span data-i18n="math_label_uncertainty">불확정성</span></button>
                        </div>
                    </div>
                </div>

                <!-- 3. 화학/생명 서브탭 콘텐츠 -->
                <div class="math-subtab-content" id="math-subtab-content-bio" style="display: none; flex-direction: column; gap: 16px;">
                    <div class="math-section">
                        <div class="math-section-title" data-i18n="math_title_rxn">화학 반응 및 평형</div>
                        <div class="math-grid">
                            <button class="math-item" onclick="insertMathSymbol('$k = A e^{-\\\\frac{E_a}{RT}}$')">$$k = A e^{-\\\\frac{E_a}{RT}}$$<span data-i18n="math_label_arrhenius">아레니우스</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$PV = nRT$')">$$PV = nRT$$<span data-i18n="math_label_ideal_gas">이상기체</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\rightarrow$')">$$\\\\rightarrow$$<span data-i18n="math_label_forward">정반응</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\rightleftharpoons$')">$$\\\\rightleftharpoons$$<span data-i18n="math_label_reversible">가역반응</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\uparrow$')">$$\\\\uparrow$$<span data-i18n="math_label_gas_gen">기체발생</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\downarrow$')">$$\\\\downarrow$$<span data-i18n="math_label_precip">침전발생</span></button>
                        </div>
                    </div>

                    <div class="math-section">
                        <div class="math-section-title" data-i18n="math_title_bio">유전공학 및 생화학</div>
                        <div class="math-grid">
                            <button class="math-item" onclick="insertMathSymbol('$p^2 + 2pq + q^2 = 1$')">$$p^2 + 2pq + q^2 = 1$$<span data-i18n="math_label_hardy">하디-바인베르크</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$v = \\\\frac{V_{max}[S]}{K_m + [S]}$')">$$v = \\\\frac{V_{max}[S]}{K_m + [S]}$$<span data-i18n="math_label_menten">멘텐 속도식</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\text{A} = \\\\text{T}$')">$$\\\\text{A} = \\\\text{T}$$<span data-i18n="math_label_at_pair">A-T 염기쌍</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\text{G} \\\\equiv \\\\text{C}$')">$$\\\\text{G} \\\\equiv \\\\text{C}$$<span data-i18n="math_label_gc_pair">G-C 염기쌍</span></button>
                            <button class="math-item" onclick="insertMathSymbol('$\\\\Delta G = \\\\Delta H - T\\\\Delta S$')">$$\\\\Delta G = \\\\Delta H - T\\\\Delta S$$<span data-i18n="math_label_gibbs">깁스 자유에너지</span></button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 화학식 검색 패널 -->
            <div class="sidebar-content-pane" id="sidebar-content-chemistry" style="display: none; flex-direction: column; flex: 1; overflow: hidden; padding: 20px; gap: 16px;">
                <div style="font-family: 'Outfit', sans-serif; font-size: 1.1em; font-weight: 600; color: var(--text-main); margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="beaker" style="width: 18px; height: 18px; color: var(--accent);"></i>
                    <span data-i18n="chem_title">PubChem 화학식 연동 검색</span>
                </div>
                <div style="font-size: 0.85em; color: var(--text-muted); line-height: 1.4;" data-i18n="chem_desc">
                    미국 국립의학도서관(NLM) PubChem 데이터베이스에서 화합물을 검색하여 분자 구조와 SMILES 코드를 실시간으로 가져옵니다. (한글/영어 모두 지원)
                </div>
                
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <input type="text" id="chemistry-search-input" placeholder="예: aspirin, caffeine, 캡사이신" style="flex: 1; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 6px; color: var(--text-main); padding: 8px 12px; font-size: 0.9em; outline: none; transition: border-color 0.2s;" onkeydown="if(event.key==='Enter') searchChemistryPubChem()" data-i18n-placeholder="placeholder_chem_search">
                    <button class="btn btn-accent" style="padding: 8px 14px;" onclick="searchChemistryPubChem()" title="검색 실행" data-i18n-title="tooltip_chem_search_btn">
                        <i data-lucide="search" style="width: 14px; height: 14px;"></i>
                    </button>
                </div>
                
                <!-- 검색 로딩 스피너 -->
                <div id="chemistry-search-loading" style="display: none; align-items: center; justify-content: center; padding: 24px 0; gap: 10px; color: var(--text-muted); font-size: 0.9em;">
                    <div style="width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <span data-i18n="chem_searching">PubChem 검색 중...</span>
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
                            <div style="font-size: 0.75em; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;" data-i18n="chem_smiles_title">SMILES 코드</div>
                            <div style="position: relative; display: flex;">
                                <input type="text" id="chem-result-smiles" readonly style="flex: 1; font-family: monospace; font-size: 0.8em; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 4px; padding: 6px 8px; color: var(--text-main); outline: none;">
                            </div>
                        </div>
                        
                        <button class="btn btn-accent" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;" onclick="insertChemistryToEditor()">
                            <i data-lucide="edit" style="width: 14px; height: 14px;"></i>
                            <span data-i18n="chem_btn_insert">에디터에 분자식 삽입</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 슬라이딩 숨기기/나오기 핸들 (사이드바 바로 뒤 인접 형제로 배치) -->
        <button class="sidebar-slide-toggle" onclick="toggleSidebar()" id="sidebar-slide-btn" title="사이드바 열기/접기" data-i18n-title="tooltip_toggle_sidebar">
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
                    <span data-i18n="preview_live">실시간 미리보기</span>
                    <span>Live Render</span>
                </div>
                <div class="preview-pane" id="preview-pane">
                    <div class="markdown-body" id="preview-content">
                        <div class="empty-state">
                            <div class="empty-state-icon"><i data-lucide="markdown" style="width: 64px; height: 64px;"></i></div>
                            <div style="font-size: 1.1em; font-weight: 500;" data-i18n="empty_no_file">파일이 열리지 않았습니다.</div>
                            <div style="font-size: 0.85em; opacity: 0.8;" data-i18n="empty_no_file_desc">좌측 탐색기에서 파일을 열거나 새로운 마크다운 문서를 작성해 보세요.</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 우측 TOC 플로팅 패널 -->
        <div class="toc-pane" id="sidebar-toc">
            <div class="toc-title" data-i18n="toc_title">문서 개요 (TOC)</div>
            <div id="toc-container">
                <ul class="toc-list" id="toc-list"></ul>
            </div>
        </div>

        <!-- 슬라이딩 숨기기/나오기 핸들 (우측 TOC) -->
        <button class="toc-slide-toggle" onclick="toggleToc()" id="toc-slide-btn" title="문서 개요 열기/접기" data-i18n-title="tooltip_toggle_toc">
            <i id="toc-slide-icon" data-lucide="chevron-right" style="width: 12px; height: 12px;"></i>
        </button>
    </main>

    <!-- 새 아이템 생성 모달 -->
    <div class="modal" id="create-modal">
        <div class="modal-card">
            <div class="modal-title" id="modal-card-title" data-i18n="create_modal_title">새 항목 추가</div>
            <input type="text" class="modal-input" id="modal-card-input" placeholder="이름을 입력해 주세요..." data-i18n-placeholder="placeholder_name">
            <div class="modal-actions">
                <button class="btn" onclick="closeCreateModal()" data-i18n="btn_cancel">취소</button>
                <button class="btn btn-accent" onclick="submitCreateItem()" data-i18n="btn_create">생성</button>
            </div>
        </div>
    </div>

    <!-- 네트워크 및 보안 설정 모달 -->
    <div class="modal" id="settings-modal" style="display: none;">
        <div class="modal-card" style="width: 480px; max-width: 90%; padding: 32px; gap: 20px;">
            <div style="display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); padding-bottom: 12px;">
                <i data-lucide="settings" style="width: 20px; height: 20px; color: var(--accent);"></i>
                <div class="modal-title" style="margin: 0; font-size: 1.25em;" data-i18n="settings_title">네트워크 및 보안 설정</div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 8px; padding: 14px; box-sizing: border-box; text-align: left;">
                <div style="display: flex; align-items: center; gap: 6px; font-size: 0.85em; font-weight: 600; color: var(--accent); margin-bottom: 4px;">
                    <i data-lucide="info" style="width: 14px; height: 14px;"></i> <span data-i18n="settings_network_info">현재 네트워크 접속 정보</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: var(--text-main);">
                    <span data-i18n="settings_lan">내부 IP (LAN):</span>
                    <span id="settings-local-ip" style="font-weight: 600; color: #38bdf8;">127.0.0.1</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: var(--text-main);">
                    <span data-i18n="settings_wan">공인 IP (WAN):</span>
                    <span id="settings-public-ip" style="font-weight: 600; color: #4ade80;" data-i18n="settings_retrieving">가져오는 중...</span>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 16px; width: 100%;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-size: 0.85em; font-weight: 600; color: var(--text-main);" data-i18n="settings_bind_ip">접속 호스트 (Bind IP)</label>
                    <select id="settings-bind-ip" class="modal-input" style="width: 100%; box-sizing: border-box;">
                        <option value="0.0.0.0" data-i18n="settings_bind_external">0.0.0.0 (외부 접속 허용)</option>
                        <option value="127.0.0.1" data-i18n="settings_bind_local">127.0.0.1 (로컬만 허용)</option>
                    </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-size: 0.85em; font-weight: 600; color: var(--text-main);" data-i18n="settings_port">포트 번호</label>
                    <input type="number" id="settings-port" class="modal-input" placeholder="58220" style="width: 100%; box-sizing: border-box;" min="1024" max="65535">
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-size: 0.85em; font-weight: 600; color: var(--text-main);" data-i18n="settings_password">웹 접속 암호</label>
                    <input type="password" id="settings-password" class="modal-input" placeholder="미지정 시 로그인 없이 접속" style="width: 100%; box-sizing: border-box;" data-i18n-placeholder="placeholder_password_empty">
                </div>
            </div>
            <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 6px; padding: 10px; font-size: 0.78em; color: #f87171; line-height: 1.4;" data-i18n="settings_warn">
                호스트/포트 변경은 앱 재시작 후 적용. 암호 변경은 즉시 적용.
            </div>
            <div class="modal-actions" style="width: 100%; justify-content: flex-end;">
                <button class="btn" onclick="closeSettingsModal()" data-i18n="btn_cancel">취소</button>
                <button class="btn btn-accent" onclick="saveSettings()" data-i18n="btn_save">저장</button>
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
                <div style="font-size: 0.85em; color: #94a3b8; margin-top: 6px;" data-i18n="auth_desc">접속 암호를 입력해 주세요.</div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <input type="password" id="auth-password-input" placeholder="비밀번호" style="width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; padding: 12px 16px; font-size: 1em; outline: none;" onkeydown="if(event.key==='Enter') submitAuthPassword()" data-i18n-placeholder="placeholder_password">
                <div id="auth-error-msg" style="display: none; color: #ef4444; font-size: 0.8em;" data-i18n="auth_error_msg">암호가 올바르지 않습니다.</div>
            </div>
            <button class="btn btn-accent" style="width: 100%; padding: 12px; justify-content: center; gap: 8px; font-weight: 600;" onclick="submitAuthPassword()">
                <i data-lucide="key" style="width: 16px; height: 16px;"></i> <span data-i18n="auth_btn_connect">접속하기</span>
            </button>
        </div>
    </div>

    <!-- 토스트 알림 -->
    <div class="toast" id="toast">
        <i data-lucide="check-circle" style="width: 16px; height: 16px;"></i>
        <span id="toast-message" data-i18n="toast_default">변경 사항이 저장되었습니다.</span>
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
        let currentLang = "ko";
        let isSyncScrolling = true;
        let renderTimeout;
        let isCreatingType = "file"; // 'file' or 'folder'
        let workspaceRoot = "";
        let currentNetworkConfig = { bind_ip: '0.0.0.0', port: 58220, access_password: '', local_ip: '127.0.0.1' };

        const translations = {
            ko: {
                // Header
                "btn_add_doc": "문서 추가",
                "tooltip_add_doc": "서재에 마크다운 문서(.md) 추가",
                "mode_edit": "편집기",
                "mode_split": "스플릿",
                "mode_preview": "미리보기",
                "btn_fullscreen": "문서 전체화면",
                "tooltip_fullscreen": "문서 전체화면 (더블클릭 단축 지원)",
                "btn_save": "저장",
                "btn_export_html": "HTML 내보내기",
                "btn_print_pdf": "PDF 인쇄",
                "tooltip_theme": "테마 전환",
                "tooltip_settings": "네트워크 및 보안 설정",
                "tooltip_toggle_sidebar": "사이드바 열기/접기",
                "tooltip_delete": "목록에서 제외",
                
                // Sidebar
                "tab_explorer": "내 서재",
                "tab_math": "수식 입력기",
                "tab_chemistry": "화학식 검색",
                "sidebar_title_explorer": "내 서재",
                "tooltip_create_file": "새 파일 생성",
                "tooltip_create_folder": "새 폴더 생성",
                "tooltip_refresh": "목록 새로고침",
                "sidebar_no_files": "파일이 존재하지 않습니다.",
                "sidebar_empty_folder": "빈 폴더",
                
                // Math Input
                "math_subtab_math": "📐 수학",
                "math_subtab_physics": "⚛️ 물리",
                "math_subtab_bio": "🧪 화학/생명",
                
                "math_title_basic": "자주 쓰이는 기본 수식",
                "math_title_calculus": "미적분 및 극한",
                "math_title_greek": "그리스 문자 (Greek)",
                "math_title_symbols": "수학 기호",
                "math_title_em_gravity": "전자기학 및 중력",
                "math_title_quantum": "양자역학 및 상대성이론",
                "math_title_rxn": "화학 반응 및 평형",
                "math_title_bio": "유전공학 및 생화학",
                
                "math_label_fraction": "분수",
                "math_label_sqrt": "루트",
                "math_label_power": "거듭제곱",
                "math_label_subscript": "아래첨자",
                "math_label_sum": "합(Sum)",
                "math_label_prod": "곱(Prod)",
                "math_label_diff": "미분",
                "math_label_partial": "편미분",
                "math_label_indef_int": "부정적분",
                "math_label_def_int": "정적분",
                "math_label_limit": "극한",
                "math_label_infinity": "무한대",
                "math_label_approx": "근사치",
                "math_label_ne": "다름",
                "math_label_mul": "곱셈",
                "math_label_div": "나눗셈",
                "math_label_vector": "벡터",
                "math_label_arrow": "화살표",
                "math_label_coulomb": "쿨롱 법칙",
                "math_label_lorentz": "로런츠 힘",
                "math_label_gauss": "가우스 법칙",
                "math_label_gravity": "만유인력",
                "math_label_mass_energy": "질량-에너지",
                "math_label_planck": "플랑크-양자",
                "math_label_schrodinger": "슈뢰딩거",
                "math_label_uncertainty": "불확정성",
                "math_label_arrhenius": "아레니우스",
                "math_label_ideal_gas": "이상기체",
                "math_label_forward": "정반응",
                "math_label_reversible": "가역반응",
                "math_label_gas_gen": "기체발생",
                "math_label_precip": "침전발생",
                "math_label_hardy": "하디-바인베르크",
                "math_label_menten": "멘텐 속도식",
                "math_label_at_pair": "A-T 염기쌍",
                "math_label_gc_pair": "G-C 염기쌍",
                "math_label_gibbs": "깁스 자유에너지",
                
                // Chem Search
                "chem_title": "PubChem 화학식 연동 검색",
                "chem_desc": "미국 국립의학도서관(NLM) PubChem 데이터베이스에서 화합물을 검색하여 분자 구조와 SMILES 코드를 실시간으로 가져옵니다. (한글/영어 모두 지원)",
                "placeholder_chem_search": "예: aspirin, caffeine, 캡사이신",
                "tooltip_chem_search_btn": "검색 실행",
                "chem_searching": "PubChem 검색 중...",
                "chem_btn_insert": "에디터에 분자식 삽입",
                "chem_result_loading_err": "화합물은 발견되었으나 분자식을 찾을 수 없습니다.",
                "chem_smiles_title": "SMILES 코드",
                
                // Workspace Empty
                "preview_live": "실시간 미리보기",
                "empty_no_file": "파일이 열리지 않았습니다.",
                "empty_no_file_desc": "좌측 탐색기에서 파일을 열거나 새로운 마크다운 문서를 작성해 보세요.",
                "empty_no_content": "내용이 비어있습니다.",
                "empty_removed": "문서가 내 서재 목록에서 제외되었습니다.",
                "toc_title": "문서 개요 (TOC)",
                "tooltip_toggle_toc": "문서 개요 열기/접기",
                "toc_collapsed_msg": "문서 개요를 접었습니다.",
                "toc_opened_msg": "문서 개요를 열었습니다.",
                
                // Create Modal
                "create_modal_title": "새 항목 추가",
                "create_modal_title_folder": "새 폴더 생성",
                "create_modal_title_file": "새 마크다운 문서 생성",
                "placeholder_name": "이름을 입력해 주세요...",
                "btn_cancel": "취소",
                "btn_create": "생성",
                
                // Settings Modal
                "settings_title": "네트워크 및 보안 설정",
                "settings_network_info": "현재 네트워크 접속 정보",
                "settings_lan": "내부 IP (LAN):",
                "settings_wan": "공인 IP (WAN):",
                "settings_retrieving": "가져오는 중...",
                "settings_retrieval_failed": "조회 실패 (네트워크 점검 필요)",
                "settings_bind_ip": "접속 호스트 (Bind IP)",
                "settings_bind_external": "0.0.0.0 (외부 접속 허용)",
                "settings_bind_local": "127.0.0.1 (로컬만 허용)",
                "settings_port": "포트 번호",
                "settings_password": "웹 접속 암호",
                "placeholder_password_empty": "미지정 시 로그인 없이 접속",
                "settings_warn": "호스트/포트 변경은 앱 재시작 후 적용. 암호 변경은 즉시 적용.",
                
                // Auth Overlay
                "auth_desc": "접속 암호를 입력해 주세요.",
                "placeholder_password": "비밀번호",
                "auth_error_msg": "암호가 올바르지 않습니다.",
                "auth_btn_connect": "접속하기",
                
                // Default Toast
                "toast_default": "변경 사항이 저장되었습니다.",
                
                // JS Messages / Alerts / Dialogs
                "msg_web_folder_err": "웹 브라우저 모드에서는 로컬 폴더를 열 수 없습니다.",
                "msg_web_file_dialog_err": "웹 브라우저 모드에서는 파일 선택 대화상자를 사용할 수 없습니다.\\n마크다운 파일을 화면에 드래그 앤 드롭해 주세요.",
                "msg_folder_open_success": "윈도우 탐색기에서 서재 폴더를 열었습니다.",
                "msg_folder_open_failed": "폴더 열기 실패: ",
                "msg_doc_add_failed": "문서 추가 중 오류가 발생했습니다: ",
                "msg_library_refreshed": "내 서재를 새로고침했습니다.",
                "msg_file_read_failed": "파일을 읽을 수 없습니다: ",
                "msg_undo_done": "되돌리기(Undo) 완료",
                "msg_redo_done": "다시 실행(Redo) 완료",
                "msg_math_inserted": "수식 기호가 에디터에 삽입되었습니다.",
                "msg_chem_search_empty": "검색할 화합물 이름을 입력해주세요.",
                "msg_chem_backend_err": "파이썬 백엔드 연결을 찾을 수 없습니다.",
                "msg_chem_found": "화합물을 성공적으로 찾았습니다!",
                "msg_chem_search_failed": "검색 오류: ",
                "msg_chem_inserted": "에디터에 화학 구조식이 삽입되었습니다!",
                "msg_fullscreen_toast": "문서 전체화면 모드 (종료: Esc / 더블클릭)",
                "msg_sidebar_collapsed": "사이드바를 접었습니다.",
                "msg_sidebar_opened": "사이드바를 열었습니다.",
                "msg_save_no_file": "저장할 활성화된 파일이 없습니다. 좌측에서 새 파일을 생성하거나 선택해 주세요.",
                "msg_save_success": "성공적으로 저장되었습니다.",
                "msg_save_failed": "저장 오류: ",
                "msg_export_no_file": "내보낼 활성화된 파일이 없습니다.",
                "msg_export_success": "HTML 저장 완료: ",
                "msg_export_failed": "내보내기 실패: ",
                "msg_print_no_file": "인쇄할 활성화된 파일이 없습니다.",
                "msg_print_success": "인쇄가 정상 호출되어 다크 테마를 복원했습니다.",
                "msg_create_invalid_name": "이름을 제대로 입력해 주세요.",
                "msg_create_success": "항목이 성공적으로 생성되었습니다.",
                "msg_create_failed": "생성 실패: ",
                "msg_delete_confirm": "정말 \\\"{fileName}\\\" 문서를 내 서재 목록에서 제외하시겠습니까?\\n\\n(※ 실제 컴퓨터 내의 원본 파일은 절대 삭제되지 않고 안전하게 보존됩니다)",
                "msg_delete_success": "내 서재 목록에서 제외했습니다.",
                "msg_delete_failed": "서재 제외 실패: ",
                "msg_settings_saved": "네트워크 및 보안 설정이 저장되었습니다!",
                "msg_settings_failed": "설정 저장 실패: ",
                "msg_settings_err": "설정 저장 오류: ",
                "msg_drag_drop_desc": "여기에 마크다운 파일을 드롭하여 즉시 열기",
                "msg_external_file_loaded": "외부 파일을 읽어왔습니다.",
                "msg_external_file_unsupported": "지원하지 않는 파일 형식입니다. 마크다운(.md, .qmd) 파일만 드롭해 주세요.",
                "msg_editor_placeholder": "마크다운 내용을 여기에 입력하거나 좌측 탐색기에서 파일을 선택해 주세요...",
                "msg_active_file_tooltip": "저장 위치: ",
                "msg_active_file_external": " (외부 파일 - 저장 시 워크스페이스에 생성)",
                "msg_no_active_file": "선택된 파일 없음",
                
                // Copy Code Block
                "btn_copy_code": "복사",
                "btn_copy_code_done": "복사 완료!",
                
                // Mermaid
                "mermaid_zoom_fit": "화면에 맞춤",
                "mermaid_zoom_orig": "원본 크기",
                "mermaid_fullscreen": "전체화면",
                "mermaid_close": "닫기 (Esc)",
                "mermaid_syntax_error": "Mermaid 다이어그램 문법 오류",
                "mermaid_syntax_error_desc": "오타가 있거나 문법 규격에 맞지 않습니다. 아래 에러 로그를 확인해 주세요:"
            },
            en: {
                // Header
                "btn_add_doc": "Add Document",
                "tooltip_add_doc": "Add Markdown Document (.md) to Library",
                "mode_edit": "Editor",
                "mode_split": "Split",
                "mode_preview": "Preview",
                "btn_fullscreen": "Fullscreen",
                "tooltip_fullscreen": "Document Fullscreen (Double-click shortcut)",
                "btn_save": "Save",
                "btn_export_html": "Export HTML",
                "btn_print_pdf": "Print PDF",
                "tooltip_theme": "Switch Theme",
                "tooltip_settings": "Network & Security Settings",
                "tooltip_toggle_sidebar": "Toggle Sidebar",
                "tooltip_delete": "Remove from library",
                
                // Sidebar
                "tab_explorer": "My Library",
                "tab_math": "Math Input",
                "tab_chemistry": "Chem Search",
                "sidebar_title_explorer": "My Library",
                "tooltip_create_file": "Create File",
                "tooltip_create_folder": "Create Folder",
                "tooltip_refresh": "Refresh List",
                "sidebar_no_files": "No files found.",
                "sidebar_empty_folder": "Empty Folder",
                
                // Math Input
                "math_subtab_math": "📐 Math",
                "math_subtab_physics": "⚛️ Physics",
                "math_subtab_bio": "🧪 Chem/Bio",
                
                "math_title_basic": "Basic Formulas",
                "math_title_calculus": "Calculus & Limits",
                "math_title_greek": "Greek Letters",
                "math_title_symbols": "Math Symbols",
                "math_title_em_gravity": "Electromagnetism & Gravity",
                "math_title_quantum": "Quantum & Relativity",
                "math_title_rxn": "Chemical Reactions & Equilibrium",
                "math_title_bio": "Genetics & Biochemistry",
                
                "math_label_fraction": "Fraction",
                "math_label_sqrt": "Sqrt",
                "math_label_power": "Power",
                "math_label_subscript": "Subscript",
                "math_label_sum": "Sum",
                "math_label_prod": "Prod",
                "math_label_diff": "Diff",
                "math_label_partial": "Partial Diff",
                "math_label_indef_int": "Indefinite Integral",
                "math_label_def_int": "Definite Integral",
                "math_label_limit": "Limit",
                "math_label_infinity": "Infinity",
                "math_label_approx": "Approx",
                "math_label_ne": "Not Equal",
                "math_label_mul": "Multiply",
                "math_label_div": "Divide",
                "math_label_vector": "Vector",
                "math_label_arrow": "Arrow",
                "math_label_coulomb": "Coulomb's Law",
                "math_label_lorentz": "Lorentz Force",
                "math_label_gauss": "Gauss's Law",
                "math_label_gravity": "Gravitation",
                "math_label_mass_energy": "Mass-Energy",
                "math_label_planck": "Planck-Quantum",
                "math_label_schrodinger": "Schrödinger",
                "math_label_uncertainty": "Uncertainty",
                "math_label_arrhenius": "Arrhenius",
                "math_label_ideal_gas": "Ideal Gas",
                "math_label_forward": "Forward Rxn",
                "math_label_reversible": "Reversible Rxn",
                "math_label_gas_gen": "Gas Evolution",
                "math_label_precip": "Precipitation",
                "math_label_hardy": "Hardy-Weinberg",
                "math_label_menten": "Menten Kinetics",
                "math_label_at_pair": "A-T Base Pair",
                "math_label_gc_pair": "G-C Base Pair",
                "math_label_gibbs": "Gibbs Free Energy",
                
                // Chem Search
                "chem_title": "PubChem Chemical Search",
                "chem_desc": "Search compounds in the US NLM PubChem database to retrieve molecular structures and SMILES codes in real-time. (Supports Korean/English)",
                "placeholder_chem_search": "e.g., aspirin, caffeine, acetaminophen",
                "tooltip_chem_search_btn": "Run Search",
                "chem_searching": "Searching PubChem...",
                "chem_btn_insert": "Insert Molecule to Editor",
                "chem_result_loading_err": "Compound was found but molecular structure is unavailable.",
                "chem_smiles_title": "SMILES Code",
                
                // Workspace Empty
                "preview_live": "Live Preview",
                "empty_no_file": "No file is open.",
                "empty_no_file_desc": "Open a file from the left explorer or write a new markdown document.",
                "empty_no_content": "Content is empty.",
                "empty_removed": "Document has been removed from the library list.",
                "toc_title": "Table of Contents (TOC)",
                "tooltip_toggle_toc": "Open/Close Outline",
                "toc_collapsed_msg": "Table of Contents collapsed.",
                "toc_opened_msg": "Table of Contents opened.",
                
                // Create Modal
                "create_modal_title": "Add New Item",
                "create_modal_title_folder": "Create New Folder",
                "create_modal_title_file": "Create New Markdown File",
                "placeholder_name": "Please enter a name...",
                "btn_cancel": "Cancel",
                "btn_create": "Create",
                
                // Settings Modal
                "settings_title": "Network & Security Settings",
                "settings_network_info": "Current Network Connection Info",
                "settings_lan": "Internal IP (LAN):",
                "settings_wan": "Public IP (WAN):",
                "settings_retrieving": "Retrieving...",
                "settings_retrieval_failed": "Retrieval failed (Check network)",
                "settings_bind_ip": "Host (Bind IP)",
                "settings_bind_external": "0.0.0.0 (Allow external connections)",
                "settings_bind_local": "127.0.0.1 (Allow local only)",
                "settings_port": "Port Number",
                "settings_password": "Web Access Password",
                "placeholder_password_empty": "Leave blank for no password",
                "settings_warn": "Host/port changes apply after restart. Password changes apply immediately.",
                
                // Auth Overlay
                "auth_desc": "Please enter the access password.",
                "placeholder_password": "Password",
                "auth_error_msg": "Incorrect password.",
                "auth_btn_connect": "Access",
                
                // Default Toast
                "toast_default": "Changes have been saved.",
                
                // JS Messages / Alerts / Dialogs
                "msg_web_folder_err": "Opening local folders is not supported in web browser mode.",
                "msg_web_file_dialog_err": "File selection dialog is not supported in web browser mode.\\nPlease drag and drop a markdown file onto the screen.",
                "msg_folder_open_success": "Opened library folder in Windows Explorer.",
                "msg_folder_open_failed": "Failed to open folder: ",
                "msg_doc_add_failed": "An error occurred while adding document: ",
                "msg_library_refreshed": "Refreshed My Library.",
                "msg_file_read_failed": "Could not read file: ",
                "msg_undo_done": "Undo completed",
                "msg_redo_done": "Redo completed",
                "msg_math_inserted": "Math symbol inserted to editor.",
                "msg_chem_search_empty": "Please enter a compound name.",
                "msg_chem_backend_err": "Python backend connection not found.",
                "msg_chem_found": "Compound found successfully!",
                "msg_chem_search_failed": "Search error: ",
                "msg_chem_inserted": "Chemical structure inserted to editor!",
                "msg_fullscreen_toast": "Document Fullscreen (Exit: Esc / Double click)",
                "msg_sidebar_collapsed": "Collapsed sidebar.",
                "msg_sidebar_opened": "Opened sidebar.",
                "msg_save_no_file": "No active file to save. Please select or create a file on the left.",
                "msg_save_success": "Saved successfully.",
                "msg_save_failed": "Save error: ",
                "msg_export_no_file": "No active file to export.",
                "msg_export_success": "HTML saved successfully: ",
                "msg_export_failed": "Export failed: ",
                "msg_print_no_file": "No active file to print.",
                "msg_print_success": "Print called, dark theme restored.",
                "msg_create_invalid_name": "Please enter a valid name.",
                "msg_create_success": "Item created successfully.",
                "msg_create_failed": "Failed to create: ",
                "msg_delete_confirm": "Are you sure you want to remove \\\"{fileName}\\\" from My Library?\\n\\n(※ The original file on your disk will NOT be deleted)",
                "msg_delete_success": "Removed from My Library list.",
                "msg_delete_failed": "Failed to remove: ",
                "msg_settings_saved": "Network and security settings saved!",
                "msg_settings_failed": "Failed to save settings: ",
                "msg_settings_err": "Error saving settings: ",
                "msg_drag_drop_desc": "Drop markdown file here to open instantly",
                "msg_external_file_loaded": "External file loaded successfully.",
                "msg_external_file_unsupported": "Unsupported file format. Please drop markdown (.md, .qmd) files only.",
                "msg_editor_placeholder": "Enter markdown text here or select a file from the explorer...",
                "msg_active_file_tooltip": "Saving Path: ",
                "msg_active_file_external": " (External file - will save to workspace)",
                "msg_no_active_file": "No active file",
                
                // Copy Code Block
                "btn_copy_code": "Copy",
                "btn_copy_code_done": "Copied!",
                
                // Mermaid
                "mermaid_zoom_fit": "Fit to Screen",
                "mermaid_zoom_orig": "Original Size",
                "mermaid_fullscreen": "Fullscreen",
                "mermaid_close": "Close (Esc)",
                "mermaid_syntax_error": "Mermaid syntax error",
                "mermaid_syntax_error_desc": "Typo or invalid syntax. Check the error log below:"
            }
        };

        function t(key) {
            if (translations[currentLang] && translations[currentLang][key]) {
                return translations[currentLang][key];
            }
            if (translations["en"] && translations["en"][key]) {
                return translations["en"][key];
            }
            return key;
        }

        function setLanguage(lang, saveConfig = true) {
            currentLang = lang;
            const body = document.body;
            
            if (lang === 'en') {
                body.classList.remove('lang-ko');
                body.classList.add('lang-en');
            } else {
                body.classList.remove('lang-en');
                body.classList.add('lang-ko');
            }
            
            // 1. data-i18n
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (translations[lang] && translations[lang][key]) {
                    const icon = el.querySelector('i[data-lucide]');
                    const svg = el.querySelector('svg');
                    
                    if (icon || svg) {
                        const iconHtml = icon ? icon.outerHTML : (svg ? svg.outerHTML : "");
                        el.innerHTML = iconHtml + ` <span>${translations[lang][key]}</span>`;
                    } else {
                        el.innerText = translations[lang][key];
                    }
                }
            });
            
            // 2. data-i18n-title
            document.querySelectorAll('[data-i18n-title]').forEach(el => {
                const key = el.getAttribute('data-i18n-title');
                if (translations[lang] && translations[lang][key]) {
                    el.setAttribute('title', translations[lang][key]);
                }
            });
            
            // 3. data-i18n-placeholder
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                if (translations[lang] && translations[lang][key]) {
                    el.setAttribute('placeholder', translations[lang][key]);
                }
            });
            
            // 4. Update editor placeholder
            const editorEl = document.getElementById('editor');
            if (editorEl) {
                editorEl.setAttribute('placeholder', t('msg_editor_placeholder'));
            }
            
            // 5. Update active file title if it says "선택된 파일 없음" or similar
            const titleEl = document.getElementById('active-file-title');
            if (titleEl && (!currentFilePath || titleEl.innerText === translations['ko']['msg_no_active_file'] || titleEl.innerText === translations['en']['msg_no_active_file'])) {
                titleEl.innerText = t('msg_no_active_file');
            }
            
            // 6. Update empty state if empty
            const previewContent = document.getElementById('preview-content');
            if (previewContent && (!editorEl || !editorEl.value.trim())) {
                previewContent.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon"><i data-lucide="markdown" style="width: 64px; height: 64px;"></i></div>
                        <div style="font-size: 1.1em; font-weight: 500;">${t('empty_no_file')}</div>
                        <div style="font-size: 0.85em; opacity: 0.8;">${t('empty_no_file_desc')}</div>
                    </div>
                `;
                lucide.createIcons();
            }
            
            lucide.createIcons();
            
            if (window.pywebview && saveConfig) {
                pywebview.api.save_lang(lang);
            }
        }
        
        function toggleLanguage() {
            setLanguage(currentLang === 'ko' ? 'en' : 'ko');
            showToast(t('toast_default'));
        }

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
                }, 500);
            });
            
            textareaEl.addEventListener('blur', () => {
                if (window.undoManager) {
                    window.undoManager.saveState();
                }
            });

            if (window.pywebview) {
                initApp();
            } else {
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
                                    alert(t('msg_web_folder_err'));
                                    return Promise.resolve({ status: 'cancel' });
                                }
                                if (prop === 'add_documents_to_library') {
                                    alert(t('msg_web_file_dialog_err'));
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
                                else if (prop === 'save_lang') { bodyData.lang = args[0]; }
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
                setLanguage(state.lang || 'ko', false);
                renderFileTree(state.files);
                
                if (state.last_file) {
                    openFile(state.last_file);
                }
                
                // 스플래시 화면 페이드아웃 (사용자가 타이틀과 로고 그라데이션 광채를 충분히 감상할 수 있도록 시간을 3초로 지정)
                setTimeout(() => {
                    const splash = document.getElementById('splash-screen');
                    if (splash) {
                        splash.style.opacity = '0';
                        setTimeout(() => { splash.style.display = 'none'; }, 800);
                    }
                }, 3000);
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
                    showToast(t('msg_folder_open_success'));
                } else if (res.status === 'error') {
                    alert(t('msg_folder_open_failed') + res.message);
                }
            }
        }

        // 서재에 외부 문서 추가
        async function addDocumentToLibrary() {
            if (window.pywebview) {
                const res = await pywebview.api.add_documents_to_library();
                if (res.status === 'success') {
                    renderFileTree(res.files);
                    let msg = res.message;
                    if (currentLang === 'en' && msg) {
                        const match = msg.match(/(\\d+)개의 문서/);
                        if (match) {
                            msg = `${match[1]} documents successfully added to the library in their original location.`;
                        }
                    }
                    showToast(msg);
                } else if (res.status === 'error') {
                    alert(t('msg_doc_add_failed') + res.message);
                }
            }
        }

        // 워크스페이스 새로고침
        async function refreshWorkspace() {
            const files = await pywebview.api.list_files();
            renderFileTree(files);
            showToast(t('msg_library_refreshed'));
        }

        // 파일 트리 렌더링
        function renderFileTree(files) {
            const container = document.getElementById('file-tree-container');
            container.innerHTML = "";
            
            if (!files || files.length === 0) {
                container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85em; padding: 10px; text-align: center;">${t('sidebar_no_files')}</div>`;
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
                        <button class="icon-btn" onclick="deleteWorkspaceItem(event, '${item.path}')" title="${t('tooltip_delete')}"><i data-lucide="trash-2" style="width: 12px; height: 12px;"></i></button>
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
                        childrenWrapper.innerHTML = `<div style="color: var(--text-muted); font-size: 0.8em; padding: 4px 16px;">${t('sidebar_empty_folder')}</div>`;
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
                titleEl.title = t('msg_active_file_tooltip') + fullSavingPath;
                
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
                alert(t('msg_file_read_failed') + res.message);
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
                            <div style="font-size: 1.1em; font-weight: 500;">${t('empty_no_content')}</div>
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
                zoomBtn.innerHTML = '<i data-lucide="maximize-2" style="width: 12px; height: 12px;"></i><span>' + t('mermaid_zoom_orig') + '</span>';
                zoomBtn.onclick = () => toggleMermaidZoom(zoomBtn);
                
                // 전체화면 버튼 생성
                const fsBtn = document.createElement('button');
                fsBtn.className = 'mermaid-fs-btn';
                fsBtn.innerHTML = '<i data-lucide="expand" style="width: 12px; height: 12px;"></i><span>' + t('mermaid_fullscreen') + '</span>';
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
                                <span>${t('mermaid_syntax_error')}</span>
                            </div>
                            <div style="font-size: 0.85em; opacity: 0.85; margin-bottom: 8px;">${t('mermaid_syntax_error_desc')}</div>
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
                    btn.querySelector('span').innerText = t('mermaid_zoom_fit');
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
                    btn.querySelector('span').innerText = t('mermaid_zoom_orig');
                    icon.setAttribute('data-lucide', 'maximize-2');
                    
                    // 원래 상태로 환원
                    svg.style.width = '';
                    svg.style.maxWidth = '';
                }
            } else {
                if (isZoomed) {
                    btn.querySelector('span').innerText = t('mermaid_zoom_fit');
                    icon.setAttribute('data-lucide', 'minimize-2');
                } else {
                    btn.querySelector('span').innerText = t('mermaid_zoom_orig');
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
                    showToast(t('msg_undo_done'));
                }
            }
        }

        function redoEditor() {
            if (window.undoManager) {
                const redone = window.undoManager.redo();
                if (redone) {
                    showToast(t('msg_redo_done'));
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
            showToast(t('msg_math_inserted'));
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
                alert(t('msg_chem_search_empty'));
                return;
            }
            
            const loadingEl = document.getElementById('chemistry-search-loading');
            const resultEl = document.getElementById('chemistry-search-result');
            
            loadingEl.style.display = 'flex';
            resultEl.style.display = 'none';
            
            try {
                if (!window.pywebview) {
                    throw new Error(t('msg_chem_backend_err'));
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
                    showToast(t('msg_chem_found'));
                } else {
                    alert(res.message);
                }
            } catch (err) {
                loadingEl.style.display = 'none';
                alert(t('msg_chem_search_failed') + err.message);
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
            
            showToast(t('msg_chem_inserted'));
        }

        function toggleDocumentFullscreen() {
            const pane = document.getElementById('preview-pane');
            if (!document.fullscreenElement) {
                pane.requestFullscreen().then(() => {
                    showToast(t('msg_fullscreen_toast'));
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
                btn.title = t('tooltip_toggle_sidebar');
                showToast(t('msg_sidebar_collapsed'));
            } else {
                icon.setAttribute('data-lucide', 'chevron-left');
                btn.title = t('tooltip_toggle_sidebar');
                showToast(t('msg_sidebar_opened'));
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
                btn.title = t('tooltip_toggle_toc');
                showToast(t('toc_collapsed_msg'));
            } else {
                icon.setAttribute('data-lucide', 'chevron-right');
                btn.title = t('tooltip_toggle_toc');
                showToast(t('toc_opened_msg'));
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
                    copyBtn.innerText = t('btn_copy_code');
                    copyBtn.onclick = () => {
                        navigator.clipboard.writeText(code.textContent);
                        copyBtn.innerText = t('btn_copy_code_done');
                        copyBtn.style.color = '#10b981';
                        setTimeout(() => {
                            copyBtn.innerText = t('btn_copy_code');
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
                if (btn) btn.title = t('tooltip_toggle_toc');
            } else {
                tocPanel.classList.remove('collapsed');
                const icon = document.getElementById('toc-slide-icon');
                const btn = document.getElementById('toc-slide-btn');
                if (icon) icon.setAttribute('data-lucide', 'chevron-right');
                if (btn) btn.title = t('tooltip_toggle_toc');
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
                alert(t('msg_save_no_file'));
                return;
            }
            const content = document.getElementById('editor').value;
            const res = await pywebview.api.save_file(currentFilePath, content);
            if (res.status === 'success') {
                showToast(t('msg_save_success'));
            } else {
                alert(t('msg_save_failed') + res.message);
            }
        }

        // HTML standalone 파일 내보내기
        async function exportToHtml() {
            if (!currentFilePath) {
                alert(t('msg_export_no_file'));
                return;
            }
            const htmlBody = document.getElementById('preview-content').innerHTML;
            const res = await pywebview.api.export_html(currentFilePath, htmlBody, currentFilePath);
            if (res.status === 'success') {
                showToast(t('msg_export_success') + res.dest);
            } else {
                alert(t('msg_export_failed') + res.message);
            }
        }

        // PDF 인쇄 실행 (미리보기 화면만 밝은 테마로 자동 최적화하여 깔끔하게 출력)
        async function printDocument() {
            if (!currentFilePath) {
                alert(t('msg_print_no_file'));
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
                        showToast(t('msg_print_success'));
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
            document.getElementById('modal-card-title').innerText = type === 'folder' ? t('create_modal_title_folder') : t('create_modal_title_file');
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
                alert(t('msg_create_invalid_name'));
                return;
            }
            
            // 현재 활성화된 폴더나 루트에 생성
            const res = await pywebview.api.create_item(name, isCreatingType);
            if (res.status === 'success') {
                renderFileTree(res.files);
                closeCreateModal();
                showToast(t('msg_create_success'));
                if (isCreatingType === 'file') {
                    openFile(name);
                }
            } else {
                alert(t('msg_create_failed') + res.message);
            }
        }

        async function deleteWorkspaceItem(event, relPath) {
            event.stopPropagation();
            const fileName = relPath.substring(relPath.lastIndexOf('/') + 1);
            if (confirm(t('msg_delete_confirm').replace('{fileName}', fileName))) {
                const res = await pywebview.api.delete_item(relPath);
                if (res.status === 'success') {
                    renderFileTree(res.files);
                    if (currentFilePath === relPath) {
                        currentFilePath = "";
                        document.getElementById('active-file-title').innerText = t('msg_no_active_file');
                        document.getElementById('editor').value = "";
                        updateLineNumbers();
                        document.getElementById('preview-content').innerHTML = `
                            <div class="empty-state">
                                <div class="empty-state-icon"><i data-lucide="markdown" style="width: 64px; height: 64px;"></i></div>
                                <div style="font-size: 1.1em; font-weight: 500;">${t('empty_removed')}</div>
                            </div>
                        `;
                        lucide.createIcons();
                    }
                    showToast(t('msg_delete_success'));
                } else {
                    alert(t('msg_delete_failed') + res.message);
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
            publicIpEl.innerText = t('settings_retrieving');
            
            fetch('https://api.ipify.org?format=json')
                .then(res => res.json())
                .then(data => {
                    publicIpEl.innerText = data.ip;
                })
                .catch(err => {
                    publicIpEl.innerText = t('settings_retrieval_failed');
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
                    showToast(t('msg_settings_saved'));
                    closeSettingsModal();
                } else {
                    alert(t('msg_settings_failed') + res.message);
                }
            } catch (err) {
                alert(t('msg_settings_err') + err.message);
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
                            document.getElementById('active-file-title').innerText = file.name + t('msg_active_file_external');
                            document.getElementById('editor').value = evt.target.result;
                            updateLineNumbers();
                            triggerLiveRender();
                            showToast(t('msg_external_file_loaded'));
                        };
                        reader.readAsText(file);
                    } else {
                        alert(t('msg_external_file_unsupported'));
                    }
                }
            });
        }
    </script>
</body>
</html>
"""

def main():
    global window
    api = MdViewerApi()
    
    # Bottle 로컬 서버 백그라운드 구동 (상대 경로 리소스/이미지 서빙용)
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    
    # Base64로 내장된 아이콘 데이터를 임시 파일로 추출하여 사용
    import base64
    import tempfile
    icon_b64 = "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"
    dest_ico = os.path.join(tempfile.gettempdir(), "jmstudio_app_icon.ico")
    try:
        with open(dest_ico, "wb") as f:
            f.write(base64.b64decode(icon_b64))
    except Exception as e:
        dest_ico = None
        print("아이콘 추출 실패:", e)
    
            
    # PNG를 ICO 형식으로 자동 변환 (다중 사이즈 포함)
            
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

if __name__ == "__main__":
    main()
