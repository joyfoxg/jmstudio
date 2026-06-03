import os
import json
import webview
import socket
import urllib.parse
import urllib.request
from .app_config import (
    get_config, save_config, PORT, BIND_IP, VERSION,
    DEFAULT_UI_FONT, DEFAULT_EDITOR_FONT, DEFAULT_EDITOR_FONT_SIZE
)
from .gdrive_sync import GoogleDriveSync

# 전역 window 및 API 레퍼런스 (main.py에서 주입)
window = None
api_instance = None

_latest_version_cache = None

def get_pypi_latest_version():
    global _latest_version_cache
    if _latest_version_cache is not None:
        return _latest_version_cache
        
    import threading
    def fetch_version():
        global _latest_version_cache
        url = "https://pypi.org/pypi/joy-markdown-studio/json"
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=2.0) as response:
                data = json.loads(response.read().decode('utf-8'))
                _latest_version_cache = data.get("info", {}).get("version", "")
        except Exception:
            _latest_version_cache = ""
            
    threading.Thread(target=fetch_version, daemon=True).start()
    return ""

def is_update_available(current_ver, latest_ver):
    if not latest_ver:
        return False
    try:
        def parse_version(v):
            parts = []
            for p in v.split('.'):
                num = ''.join(c for c in p if c.isdigit())
                parts.append(int(num) if num else 0)
            return tuple(parts)
        return parse_version(latest_ver) > parse_version(current_ver)
    except Exception:
        return False

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.2)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def extract_tags_from_file(file_path):
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = []
            for _ in range(30):
                line = f.readline()
                if not line:
                    break
                lines.append(line.strip())
        
        if len(lines) > 1 and lines[0] == "---":
            end_idx = -1
            for i in range(1, len(lines)):
                if lines[i] == "---":
                    end_idx = i
                    break
            if end_idx != -1:
                front_matter_lines = lines[1:end_idx]
                in_tags = False
                tags = []
                for line in front_matter_lines:
                    if line.startswith("tags:"):
                        val = line.split("tags:", 1)[1].strip()
                        if val:
                            if val.startswith("[") and val.endswith("]"):
                                tags.extend([t.strip().strip("'\"") for t in val[1:-1].split(",") if t.strip()])
                            else:
                                tags.extend([t.strip().strip("'\"") for t in val.split(",") if t.strip()])
                        else:
                            in_tags = True
                    elif in_tags:
                        if line.startswith("-"):
                            tags.append(line.split("-", 1)[1].strip().strip("'\""))
                        elif ":" in line:
                            in_tags = False
                return list(set(tags))
    except Exception as e:
        print(f"Error parsing tags from {file_path}: {e}")
    return []

class MdViewerApi:
    def __init__(self):
        # active_workspace 관리
        config = get_config()
        self.workspace = os.path.abspath(os.getcwd())
        if "last_workspace" in config and os.path.exists(config["last_workspace"]):
            self.workspace = os.path.abspath(config["last_workspace"])

        # google drive sync 객체 생성
        self.gdrive = GoogleDriveSync(self.workspace)

    def get_initial_state(self):
        files_tree = self.list_files()
        cfg = get_config()
        valid_docs = cfg.get("added_documents", [])
        
        last_file = cfg.get("last_file", "")
        if last_file:
            norm_last_file = os.path.normpath(last_file).replace('\\', '/').lower()
            norm_valid_docs = {os.path.normpath(p).replace('\\', '/').lower() for p in valid_docs}
            if norm_last_file not in norm_valid_docs:
                last_file = ""
                cfg["last_file"] = ""
                save_config(cfg)
                
        # PyPI 버전 업데이트 체크
        latest_ver = get_pypi_latest_version()
        update_available = is_update_available(VERSION, latest_ver)
                
        return {
            "workspace": self.workspace,
            "theme": cfg.get("theme", "dark"),
            "lang": cfg.get("lang", "ko"),
            "last_file": last_file,
            "files": files_tree,
            "port": cfg.get("port", PORT),
            "bind_ip": cfg.get("bind_ip", BIND_IP),
            "access_password": cfg.get("access_password", ""),
            "local_ip": get_local_ip(),
            "ui_font": cfg.get("ui_font", DEFAULT_UI_FONT),
            "editor_font": cfg.get("editor_font", DEFAULT_EDITOR_FONT),
            "editor_font_size": cfg.get("editor_font_size", DEFAULT_EDITOR_FONT_SIZE),
            "update_available": update_available,
            "latest_version": latest_ver,
            "current_version": VERSION
        }

    def get_workspace_tags(self):
        cfg = get_config()
        added_docs = cfg.get("added_documents", [])
        
        tags_map = {}
        for path in added_docs:
            if os.path.isabs(path):
                full_path = path
            else:
                full_path = os.path.join(self.workspace, path)
                
            if os.path.exists(full_path) and os.path.isfile(full_path):
                tags = extract_tags_from_file(full_path)
                filename = os.path.basename(path)
                for tag in tags:
                    if tag not in tags_map:
                        tags_map[tag] = []
                    tags_map[tag].append({
                        "path": path,
                        "name": filename
                    })
        return {"status": "success", "tags": tags_map}

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

    def save_font_settings(self, ui_font, editor_font, editor_font_size):
        try:
            cfg = get_config()
            cfg["ui_font"] = ui_font
            cfg["editor_font"] = editor_font
            cfg["editor_font_size"] = int(editor_font_size)
            save_config(cfg)
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def open_library_folder(self):
        try:
            os.startfile(self.workspace)
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def add_documents_to_library(self):
        global window
        try:
            if window is None:
                return {"status": "error", "message": "Window instance not bound"}
                
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
            
        relative_paths = [p for p in valid_docs if not os.path.isabs(p)]
        tree = self._build_tree_from_paths(relative_paths)
        
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
                    f.write("---\ntags: [새문서]\n---\n\n")
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
            cfg = get_config()
            added_docs = cfg.get("added_documents", [])
            added_docs = [p for p in added_docs if p != rel_path and not p.startswith(rel_path + "/")]
            cfg["added_documents"] = added_docs
            
            last_file = cfg.get("last_file", "")
            if last_file:
                norm_last = os.path.normpath(last_file).replace('\\', '/').lower()
                norm_rel = os.path.normpath(rel_path).replace('\\', '/').lower()
                if norm_last == norm_rel or norm_last.startswith(norm_rel + "/"):
                    cfg["last_file"] = ""
                    
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
            encoded_name = urllib.parse.quote(compound_name.strip())
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
            korean_mapping = {
                "아스피린": "aspirin", "타이레놀": "acetaminophen", "아세트아미노펜": "acetaminophen",
                "카페인": "caffeine", "니코틴": "nicotine", "포도당": "glucose",
                "설탕": "sucrose", "물": "water", "이산화탄소": "carbon dioxide",
                "암모니아": "ammonia", "황산": "sulfuric acid", "염산": "hydrochloric acid",
                "메탄": "methane", "에탄올": "ethanol", "아세톤": "acetone",
                "벤젠": "benzene", "톨루엔": "toluene", "페놀": "phenol",
                "아닐린": "aniline", "글리신": "glycine", "알라닌": "alanine",
                "이부프로펜": "ibuprofen", "페니실린": "penicillin G", "멘톨": "menthol",
                "비타민c": "ascorbic acid", "비타민 c": "ascorbic acid", "구연산": "citric acid",
                "시트르산": "citric acid", "캡사이신": "capsaicin", "도파민": "dopamine",
                "세로토닌": "serotonin", "아드레날린": "epinephrine", "멜라토닌": "melatonin"
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

    def get_graph_data(self):
        import os, re
        nodes = []
        links = []
        node_ids = set()
        ws = self.workspace
        
        cfg = get_config()
        added_docs = cfg.get("added_documents", [])
        saved_positions = cfg.get("graph_node_positions", {})
        
        # 문서 분류에 따른 이모지 아이콘 및 대표 네온 컬러 결정 헬퍼 함수
        def determine_node_icon_and_color(path, content="", is_missing=False):
            if is_missing:
                return "❓", "#ef4444"
                
            icon = "📄"
            color = "#a855f7" # 기본 퍼플
            
            if path:
                path_lower = path.lower()
                if path_lower.startswith(('doc/', 'docs/')):
                    icon = "📖"
                    color = "#0ea5e9" # 청색
                elif path_lower.endswith('.qmd'):
                    icon = "📊"
                    color = "#10b981" # 초록
                    
            tags = []
            fm_match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
            if fm_match:
                fm_text = fm_match.group(1)
                for line in fm_text.split('\n'):
                    if line.strip().startswith('tags:'):
                        val = line.split('tags:', 1)[1].strip()
                        if val.startswith('[') and val.endswith(']'):
                            tags.extend([t.strip().strip("'\"").lower() for t in val[1:-1].split(',') if t.strip()])
                        else:
                            tags.extend([t.strip().strip("'\"").lower() for t in val.split(',') if t.strip()])
                            
            content_lower = content.lower()
            
            # 카테고리 매칭 플래그 계산
            has_project_tag = any(t in tags for t in ['프로젝트', '기획', 'okr', '비즈니스', '목표', '업무', '보고서', 'roadmap', 'project', 'plan', 'business', 'gantt', 'wbs'])
            has_project_content = any(x in content_lower for x in ['gantt', 'wbs', 'okr', '프로젝트'])
            
            has_science_tag = any(t in tags for t in ['수학', '물리', '학술', '논문', '연구', '공식', 'math', 'physics', 'academic', 'paper', 'research', 'formula', 'latex'])
            has_science_content = "$$" in content or "$" in content or "\\frac" in content_lower or "\\hbar" in content_lower
            
            has_chem_tag = any(t in tags for t in ['화학', '실험', '분자', '원소', 'chemistry', 'molecule', 'smiles', 'beaker', 'reaction'])
            has_chem_content = "```smiles" in content_lower or "smilesdrawer" in content_lower
            
            has_stock_tag = any(t in tags for t in ['주식', '매매', '투자', '재무', '금융', '포트폴리오', 'stock', 'trading', 'investment', 'finance', 'portfolio', 'kospi', 'kosdaq'])
            has_stock_content = any(x in content_lower for x in ['매매일지', '포트폴리오', 'kospi', 'kosdaq', '순수익률'])

            has_daily_tag = any(t in tags for t in ['일기', '일상', '저널', '루틴', '일지', '습관', '생활', '살림', '레시피', '식단', '트래커', 'diary', 'journal', 'routine', 'habit', 'lifestyle'])
            
            has_calendar_tag = any(t in tags for t in ['시간표', '스케줄', '달력', '캘린더', '일정', 'schedule', 'calendar', 'timetable'])

            # 매칭 우선순위 적용
            if has_chem_tag or has_chem_content:
                icon = "🧪"
                color = "#a855f7"
            elif has_stock_tag or has_stock_content:
                icon = "📈"
                color = "#f43f5e" # 네온 핑크
            elif has_project_tag or has_project_content:
                icon = "🎯"
                color = "#fbbf24" # 앰버 황색
            elif has_science_tag or has_science_content:
                if any(t in tags for t in ['물리', 'physics']):
                    icon = "⚛️"
                else:
                    icon = "📐"
                color = "#0ea5e9" # 청색 계열
            elif has_calendar_tag:
                icon = "📅"
                color = "#f43f5e"
            elif has_daily_tag:
                icon = "📔"
                color = "#10b981" # 그린 계열
                
            return icon, color

        for path in added_docs:
            if os.path.isabs(path):
                full_path = path
            else:
                full_path = os.path.join(ws, path)
                
            if os.path.exists(full_path) and os.path.isfile(full_path):
                filename = os.path.basename(path)
                filename_lower = filename.lower()
                if filename_lower.endswith(('.md', '.qmd', '.markdown', '.txt')):
                    node_id = os.path.splitext(filename)[0]
                    node_data = {"id": node_id, "name": filename, "path": path}
                    
                    if node_id in saved_positions:
                        pos = saved_positions[node_id]
                        if pos:
                            node_data["fx"] = pos.get("fx")
                            node_data["fy"] = pos.get("fy")
                            
                    try:
                        with open(full_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            
                        # 문서 특징 기반 성격 분석
                        icon, color = determine_node_icon_and_color(path, content=content)
                        node_data["icon"] = icon
                        node_data["color"] = color
                        
                        matches = re.findall(r'\[\[(.*?)\]\]', content)
                        for m in matches:
                            target = m.split('|')[0].strip()
                            target_lower = target.lower()
                            if target_lower.endswith('.markdown'):
                                target = target[:-9]
                            elif target_lower.endswith('.qmd'):
                                target = target[:-4]
                            elif target_lower.endswith('.txt'):
                                target = target[:-4]
                            elif target_lower.endswith('.md'):
                                target = target[:-3]
                            links.append({"source": node_id, "target": target})
                    except:
                        node_data["icon"] = "📄"
                        node_data["color"] = "#a855f7"
                        
                    nodes.append(node_data)
                    node_ids.add(node_id)
                        
        for link in links:
            if link['target'] not in node_ids:
                node_data = {"id": link['target'], "name": link['target'] + ".md", "path": "", "missing": True}
                icon, color = determine_node_icon_and_color("", is_missing=True)
                node_data["icon"] = icon
                node_data["color"] = color
                
                if link['target'] in saved_positions:
                    pos = saved_positions[link['target']]
                    if pos:
                        node_data["fx"] = pos.get("fx")
                        node_data["fy"] = pos.get("fy")
                nodes.append(node_data)
                node_ids.add(link['target'])
                
        return {"nodes": nodes, "links": links}

    def save_graph_node_positions(self, positions):
        try:
            cfg = get_config()
            cfg["graph_node_positions"] = positions
            save_config(cfg)
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def save_lang(self, lang):
        cfg = get_config()
        cfg["lang"] = lang
        save_config(cfg)
        return {"status": "success"}

    def save_graph_image(self, base64_data):
        global window
        try:
            if window is None:
                return {"status": "error", "message": "Window instance not bound"}
            if ',' in base64_data:
                base64_data = base64_data.split(',')[1]
            import base64
            img_bytes = base64.b64decode(base64_data)
            
            file_path = window.create_file_dialog(
                webview.SAVE_DIALOG,
                directory=self.workspace,
                save_filename='zettelkasten_graph.png',
                file_types=('PNG Image (*.png)', 'All files (*.*)')
            )
            if file_path:
                if isinstance(file_path, (list, tuple)):
                    file_path = file_path[0]
                with open(file_path, 'wb') as f:
                    f.write(img_bytes)
                return {"status": "success"}
            return {"status": "cancel"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def export_html(self, rel_path, html_body, title):
        base_no_ext, _ = os.path.splitext(rel_path)
        dest_rel = base_no_ext + ".html"
        dest_full = os.path.abspath(os.path.join(self.workspace, dest_rel))
        
        standalone_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.css">
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

    def open_katex_support(self):
        global window
        try:
            import time
            t_stamp = int(time.time())
            cfg = get_config()
            theme = cfg.get("theme", "dark")
            webview.create_window(
                title="KaTeX Supported Functions & Symbols",
                url=f"http://127.0.0.1:{PORT}/katex_support?theme={theme}&t={t_stamp}",
                js_api=self,
                width=950,
                height=800,
                min_size=(500, 400)
            )
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": str(e)}


    def insert_katex_symbol(self, symbol):
        global window
        try:
            if window:
                escaped_symbol = json.dumps(symbol)
                window.evaluate_js(f"insertMathSymbol({escaped_symbol})")
                return {"status": "success"}
            return {"status": "error", "message": "Main window is not bound"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_external_math_db(self):
        try:
            import sys
            if hasattr(sys, 'frozen'):
                exe_dir = os.path.dirname(sys.executable)
            else:
                exe_dir = os.path.abspath(".")
            
            db_path = os.path.normpath(os.path.join(exe_dir, "math_db.json"))
            if os.path.exists(db_path) and os.path.isfile(db_path):
                with open(db_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return {"status": "success", "data": data}
            return {"status": "not_found"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def gdrive_login(self):
        return self.gdrive.authenticate()

    def gdrive_logout(self):
        return self.gdrive.disconnect()

    def gdrive_get_status(self):
        is_auth = self.gdrive.is_authenticated()
        user_info = self.gdrive.get_user_info() if is_auth else None
        return {
            "status": "success",
            "authenticated": is_auth,
            "user": user_info
        }

    def gdrive_sync_active_file(self, rel_path):
        if not self.gdrive.is_authenticated():
            return {"status": "error", "message": "구글 계정 연동이 필요합니다."}
        
        if os.path.isabs(rel_path):
            full_path = rel_path
        else:
            full_path = os.path.abspath(os.path.join(self.workspace, rel_path))
        
        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            return {"status": "error", "message": "파일을 찾을 수 없습니다."}
            
        try:
            cfg = get_config()
            sync_map = cfg.get("google_drive_sync_map", {})
            file_info = sync_map.get(rel_path, {})
            file_id = file_info.get("file_id")
            
            # Check remote update to detect conflict
            if file_id:
                remote_mtime = self.gdrive.get_remote_modified_time(file_id)
                last_synced_mtime = file_info.get("last_synced_mtime", 0)
                local_mtime = os.path.getmtime(full_path)
                
                # If remote is newer and was modified since last sync
                if remote_mtime > last_synced_mtime + 2:
                    return {
                        "status": "conflict", 
                        "message": "구글 드라이브에 더 최신 버전이 있습니다. 어떻게 하시겠습니까?",
                        "local_mtime": local_mtime,
                        "remote_mtime": remote_mtime
                    }
            
            new_file_id = self.gdrive.upload_file(full_path, file_id)
            
            sync_map[rel_path] = {
                "file_id": new_file_id,
                "last_synced_mtime": os.path.getmtime(full_path),
                "auto_sync": file_info.get("auto_sync", True)
            }
            cfg["google_drive_sync_map"] = sync_map
            save_config(cfg)
            
            return {"status": "success", "file_id": new_file_id}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def gdrive_resolve_conflict(self, rel_path, resolution):
        if not self.gdrive.is_authenticated():
            return {"status": "error", "message": "구글 계정 연동이 필요합니다."}
            
        if os.path.isabs(rel_path):
            full_path = rel_path
        else:
            full_path = os.path.abspath(os.path.join(self.workspace, rel_path))
            
        try:
            cfg = get_config()
            sync_map = cfg.get("google_drive_sync_map", {})
            file_info = sync_map.get(rel_path, {})
            file_id = file_info.get("file_id")
            
            if resolution == "upload":
                new_file_id = self.gdrive.upload_file(full_path, file_id)
                sync_map[rel_path] = {
                    "file_id": new_file_id,
                    "last_synced_mtime": os.path.getmtime(full_path),
                    "auto_sync": file_info.get("auto_sync", True)
                }
                cfg["google_drive_sync_map"] = sync_map
                save_config(cfg)
                return {"status": "success", "action": "uploaded"}
                
            elif resolution == "download":
                if not file_id:
                    return {"status": "error", "message": "구글 드라이브 파일 ID를 찾을 수 없습니다."}
                self.gdrive.download_file(file_id, full_path)
                sync_map[rel_path] = {
                    "file_id": file_id,
                    "last_synced_mtime": os.path.getmtime(full_path),
                    "auto_sync": file_info.get("auto_sync", True)
                }
                cfg["google_drive_sync_map"] = sync_map
                save_config(cfg)
                
                with open(full_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    
                return {"status": "success", "action": "downloaded", "content": content}
            
            return {"status": "cancel"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def gdrive_get_file_sync_status(self, rel_path):
        cfg = get_config()
        sync_map = cfg.get("google_drive_sync_map", {})
        if rel_path in sync_map:
            return {"status": "success", "synced": True, "auto_sync": sync_map[rel_path].get("auto_sync", True)}
        return {"status": "success", "synced": False, "auto_sync": False}

    def gdrive_toggle_file_auto_sync(self, rel_path, enabled):
        cfg = get_config()
        sync_map = cfg.get("google_drive_sync_map", {})
        if rel_path in sync_map:
            sync_map[rel_path]["auto_sync"] = enabled
            cfg["google_drive_sync_map"] = sync_map
            save_config(cfg)
            return {"status": "success"}
        return {"status": "error", "message": "동기화된 파일 기록을 찾을 수 없습니다. 먼저 업로드를 진행해 주세요."}

    def gdrive_list_remote_files(self):
        if not self.gdrive.is_authenticated():
            return {"status": "error", "message": "구글 계정 연동이 필요합니다."}
        try:
            folder_id = self.gdrive.get_or_create_app_folder()
            query = f"'{folder_id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false"
            results = self.gdrive.service.files().list(
                q=query, 
                spaces='drive', 
                fields="files(id, name, modifiedTime, size)"
            ).execute()
            
            files_list = []
            for f in results.get('files', []):
                files_list.append({
                    "id": f.get("id"),
                    "name": f.get("name"),
                    "modifiedTime": f.get("modifiedTime"),
                    "size": int(f.get("size", 0))
                })
            return {"status": "success", "files": files_list}
        except Exception as e:
            return {"status": "error", "message": f"클라우드 목록 조회 실패: {str(e)}"}

    def gdrive_download_remote_file(self, file_id, filename):
        if not self.gdrive.is_authenticated():
            return {"status": "error", "message": "구글 계정 연동이 필요합니다."}
        
        full_path = os.path.abspath(os.path.join(self.workspace, filename))
        if not full_path.startswith(self.workspace):
            return {"status": "error", "message": "Access denied"}
            
        try:
            self.gdrive.download_file(file_id, full_path)
            
            cfg = get_config()
            added_docs = cfg.get("added_documents", [])
            
            rel_path = os.path.relpath(full_path, self.workspace).replace('\\', '/')
            if rel_path not in added_docs:
                added_docs.append(rel_path)
                cfg["added_documents"] = added_docs
            
            sync_map = cfg.get("google_drive_sync_map", {})
            sync_map[rel_path] = {
                "file_id": file_id,
                "last_synced_mtime": os.path.getmtime(full_path),
                "auto_sync": True
            }
            cfg["google_drive_sync_map"] = sync_map
            save_config(cfg)
            
            return {
                "status": "success", 
                "rel_path": rel_path,
                "files": self.list_files()
            }
        except Exception as e:
            return {"status": "error", "message": f"클라우드 파일 다운로드 실패: {str(e)}"}

    def gdrive_import_client_secrets(self):
        global window
        if window is None:
            return {"status": "error", "message": "Window instance not bound"}
        try:
            file_paths = window.create_file_dialog(
                webview.OPEN_DIALOG,
                allow_multiple=False,
                file_types=('JSON Files (*.json)', 'All files (*.*)')
            )
            if not file_paths:
                return {"status": "cancel", "message": "취소되었습니다."}
                
            path = file_paths[0]
            if os.path.exists(path) and os.path.isfile(path):
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                if "installed" not in data or "client_id" not in data["installed"]:
                    return {"status": "error", "message": "올바른 구글 클라이언트 인증키(JSON) 파일이 아닙니다."}
                
                # Save to workspace root
                target_path = os.path.join(self.workspace, "client_secrets.json")
                with open(target_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=4)
                    
                self.gdrive.load_credentials()
                return {"status": "success", "message": "인증키를 성공적으로 가져왔습니다."}
            else:
                return {"status": "error", "message": "파일을 찾을 수 없습니다."}
        except Exception as e:
            return {"status": "error", "message": f"인증키 가져오기 실패: {str(e)}"}
