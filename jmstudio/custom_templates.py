import os
import json
import time
import urllib.request
import zipfile
import shutil
import re
from .api_bridge import MdViewerApi

class CustomTemplateManager:
    def __init__(self):
        self.base_dir = os.path.join(os.getcwd(), 'custom_templates')
        self.local_json = os.path.join(self.base_dir, 'local_templates.json')
        self.sub_json = os.path.join(self.base_dir, 'subscriptions.json')
        self.cache_dir = os.path.join(self.base_dir, 'cache')
        
        os.makedirs(self.base_dir, exist_ok=True)
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Initialize JSON databases if not exist
        if not os.path.exists(self.local_json):
            with open(self.local_json, 'w', encoding='utf-8') as f:
                json.dump([], f, ensure_ascii=False, indent=4)
                
        if not os.path.exists(self.sub_json):
            with open(self.sub_json, 'w', encoding='utf-8') as f:
                json.dump([], f, ensure_ascii=False, indent=4)

    def _load_json(self, path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []

    def _save_json(self, path, data):
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            return True
        except Exception:
            return False

    def save_custom_template(self, title, desc, icon, color, content):
        if not title:
            return {"status": "error", "message": "Title cannot be empty"}
            
        templates = self._load_json(self.local_json)
        template_id = f"custom_template_{int(time.time())}"
        
        new_template = {
            "id": template_id,
            "title": title,
            "desc": desc or "",
            "icon": icon or "file-text",
            "color": color or "#10b981",
            "content": content or "",
            "tags": ["사용자지정"]
        }
        
        templates.append(new_template)
        if self._save_json(self.local_json, templates):
            return {"status": "success", "template_id": template_id}
        else:
            return {"status": "error", "message": "Failed to save template file"}

    def delete_custom_template(self, template_id):
        templates = self._load_json(self.local_json)
        initial_len = len(templates)
        templates = [t for t in templates if t["id"] != template_id]
        
        if len(templates) == initial_len:
            return {"status": "error", "message": "Template not found"}
            
        if self._save_json(self.local_json, templates):
            return {"status": "success"}
        else:
            return {"status": "error", "message": "Failed to delete template file"}

    def get_custom_templates(self):
        # 1. Load local templates
        local_templates = self._load_json(self.local_json)
        
        # 2. Scan cache for subscribed templates
        subscribed_templates = []
        if os.path.exists(self.cache_dir):
            for root, dirs, files in os.walk(self.cache_dir):
                for file in files:
                    if file.endswith('.md'):
                        file_path = os.path.join(root, file)
                        parsed = self._parse_markdown_template(file_path)
                        if parsed:
                            subscribed_templates.append(parsed)
                            
        return {
            "local": local_templates,
            "subscribed": subscribed_templates
        }

    def _parse_markdown_template(self, file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Parse YAML Front Matter
            front_matter_match = re.match(r'^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$', content)
            
            title = os.path.splitext(os.path.basename(file_path))[0]
            desc = "원격 구독 양식 문서"
            icon = "file-text"
            color = "#3b82f6"
            tags = ["원격구독"]
            body = content
            
            if front_matter_match:
                fm_text = front_matter_match.group(1)
                body = front_matter_match.group(2)
                
                # Parse lines in Front Matter
                for line in fm_text.splitlines():
                    line = line.strip()
                    if line.startswith("template_title:"):
                        title = line.split("template_title:", 1)[1].strip().strip("'\"")
                    elif line.startswith("template_desc:"):
                        desc = line.split("template_desc:", 1)[1].strip().strip("'\"")
                    elif line.startswith("template_icon:"):
                        icon = line.split("template_icon:", 1)[1].strip().strip("'\"")
                    elif line.startswith("template_color:"):
                        color = line.split("template_color:", 1)[1].strip().strip("'\"")
                    elif line.startswith("tags:"):
                        tags_raw = line.split("tags:", 1)[1].strip()
                        if tags_raw.startswith("[") and tags_raw.endswith("]"):
                            tags = [t.strip().strip("'\"") for t in tags_raw[1:-1].split(",") if t.strip()]
            else:
                # Fallback if no front matter: clean lines to get heading
                heading_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
                if heading_match:
                    title = heading_match.group(1).strip()
            
            # Safe unique ID based on file path hash
            import hashlib
            file_hash = hashlib.md5(file_path.encode('utf-8')).hexdigest()[:8]
            template_id = f"sub_template_{file_hash}"
            
            return {
                "id": template_id,
                "title": title,
                "desc": desc,
                "icon": icon,
                "color": color,
                "content": body.strip(),
                "tags": tags
            }
        except Exception as e:
            print(f"Error parsing markdown template {file_path}: {e}")
            return None

    def add_subscription(self, url):
        url = url.strip()
        if not (url.startswith("http://") or url.startswith("https://")):
            return {"status": "error", "message": "Invalid URL protocol"}
            
        subs = self._load_json(self.sub_json)
        if url in subs:
            return {"status": "error", "message": "Already subscribed"}
            
        subs.append(url)
        if self._save_json(self.sub_json, subs):
            sync_res = self.sync_subscriptions()
            if sync_res["status"] == "success":
                return {"status": "success", "message": "Subscription added and synchronized!"}
            else:
                return {"status": "success", "message": f"Added, but sync failed: {sync_res['message']}"}
        else:
            return {"status": "error", "message": "Failed to update subscriptions database"}

    def delete_subscription(self, url):
        subs = self._load_json(self.sub_json)
        initial_len = len(subs)
        subs = [s for s in subs if s != url]
        
        if len(subs) == initial_len:
            return {"status": "error", "message": "Subscription not found"}
            
        if self._save_json(self.sub_json, subs):
            # Clean up cache for this subscription
            # Extract user/repo
            try:
                repo_slug = self._get_repo_slug(url)
                if repo_slug:
                    target_cache = os.path.join(self.cache_dir, repo_slug)
                    if os.path.exists(target_cache):
                        shutil.rmtree(target_cache)
            except Exception as e:
                print(f"Error cleaning subscription cache: {e}")
            return {"status": "success"}
        else:
            return {"status": "error", "message": "Failed to delete subscription"}

    def get_subscriptions(self):
        return self._load_json(self.sub_json)

    def _get_repo_slug(self, url):
        # Parses github.com/user/repo into 'user_repo'
        url_clean = url.rstrip('/')
        parts = url_clean.split('/')
        if len(parts) >= 2:
            user = parts[-2]
            repo = parts[-1]
            return f"{user}_{repo}"
        return None

    def sync_subscriptions(self):
        subs = self._load_json(self.sub_json)
        if not subs:
            return {"status": "success", "message": "No subscriptions to sync"}
            
        errors = []
        for url in subs:
            try:
                repo_slug = self._get_repo_slug(url)
                if not repo_slug:
                    errors.append(f"Invalid repository URL structure: {url}")
                    continue
                    
                # Clean up existing cache for this repository before sync
                target_cache = os.path.join(self.cache_dir, repo_slug)
                if os.path.exists(target_cache):
                    shutil.rmtree(target_cache)
                os.makedirs(target_cache, exist_ok=True)
                
                # Fetch Zip Archive
                # Try refs/heads/main.zip, if fails try refs/heads/master.zip
                success = False
                zip_temp = os.path.join(self.base_dir, f"{repo_slug}_temp.zip")
                
                for branch in ['main', 'master']:
                    zip_url = f"{url.rstrip('/')}/archive/refs/heads/{branch}.zip"
                    try:
                        req = urllib.request.Request(zip_url, headers={'User-Agent': 'Mozilla/5.0'})
                        with urllib.request.urlopen(req, timeout=5.0) as response:
                            with open(zip_temp, 'wb') as out_file:
                                out_file.write(response.read())
                        success = True
                        break
                    except Exception:
                        continue
                        
                if not success:
                    errors.append(f"Failed to download repository zip from: {url}")
                    continue
                    
                # Unzip files
                with zipfile.ZipFile(zip_temp, 'r') as zip_ref:
                    # Zip unzips to a root directory inside like repo-main/
                    # We extract all files, then move them to our cache/{repo_slug} folder
                    extract_temp = os.path.join(self.base_dir, f"{repo_slug}_extract")
                    os.makedirs(extract_temp, exist_ok=True)
                    zip_ref.extractall(extract_temp)
                    
                    # Find files and move to target_cache
                    subdirs = os.listdir(extract_temp)
                    if subdirs:
                        root_subdir = os.path.join(extract_temp, subdirs[0])
                        for item in os.listdir(root_subdir):
                            s = os.path.join(root_subdir, item)
                            d = os.path.join(target_cache, item)
                            if os.path.isdir(s):
                                shutil.copytree(s, d, dirs_exist_ok=True)
                            else:
                                shutil.copy2(s, d)
                                
                    shutil.rmtree(extract_temp)
                
                if os.path.exists(zip_temp):
                    os.remove(zip_temp)
                    
            except Exception as e:
                errors.append(f"Error syncing {url}: {str(e)}")
                
        if errors:
            return {"status": "error", "message": "; ".join(errors)}
        return {"status": "success", "message": "All subscriptions synchronized successfully!"}

class ExtendedMdViewerApi(MdViewerApi):
    def __init__(self):
        super().__init__()
        self.template_manager = CustomTemplateManager()

    def save_custom_template(self, title, desc, icon, color, content):
        return self.template_manager.save_custom_template(title, desc, icon, color, content)

    def delete_custom_template(self, template_id):
        return self.template_manager.delete_custom_template(template_id)

    def get_custom_templates(self):
        return self.template_manager.get_custom_templates()

    def add_subscription(self, url):
        return self.template_manager.add_subscription(url)

    def delete_subscription(self, url):
        return self.template_manager.delete_subscription(url)

    def get_subscriptions(self):
        return self.template_manager.get_subscriptions()

    def sync_subscriptions(self):
        return self.template_manager.sync_subscriptions()
