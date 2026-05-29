import os
import sys
import json
import io
import datetime
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload

SCOPES = ['https://www.googleapis.com/auth/drive.file']
TOKEN_FILE = 'token.json'
CLIENT_SECRETS_FILE = 'client_secrets.json'

DEFAULT_CLIENT_ID = ""
DEFAULT_CLIENT_SECRET = ""

class GoogleDriveSync:
    def __init__(self, workspace_path):
        self.workspace_path = os.path.abspath(workspace_path)
        if hasattr(sys, '_MEIPASS'):
            self.client_secrets_path = os.path.normpath(os.path.join(sys._MEIPASS, 'client_secrets.json'))
        else:
            self.client_secrets_path = os.path.normpath(os.path.join(self.workspace_path, 'client_secrets.json'))
        self.token_file_path = os.path.normpath(os.path.join(self.workspace_path, 'token.json'))
        self.creds = None
        self.service = None
        self.app_folder_id = None
        self.load_credentials()

    def load_credentials(self):
        if os.path.exists(self.token_file_path):
            try:
                self.creds = Credentials.from_authorized_user_file(self.token_file_path, SCOPES)
            except Exception as e:
                print(f"Error loading credentials: {e}")
                self.creds = None
        
        if self.creds and self.creds.valid:
            try:
                self.service = build('drive', 'v3', credentials=self.creds)
            except Exception as e:
                print(f"Error building service: {e}")
                self.service = None

    def is_authenticated(self):
        if self.creds and self.creds.expired and self.creds.refresh_token:
            try:
                self.creds.refresh(Request())
                with open(self.token_file_path, 'w') as token:
                    token.write(self.creds.to_json())
                self.service = build('drive', 'v3', credentials=self.creds)
                return True
            except Exception as e:
                print(f"Token refresh failed: {e}")
                return False
        return self.creds is not None and self.creds.valid

    def authenticate(self):
        if self.is_authenticated():
            return {"status": "success", "message": "이미 연동되어 있습니다."}

        use_custom_secrets = False
        if os.path.exists(self.client_secrets_path):
            try:
                with open(self.client_secrets_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                client_id = data.get("installed", {}).get("client_id", "")
                if client_id and "YOUR_CLIENT_ID" not in client_id:
                    use_custom_secrets = True
            except:
                pass

        try:
            if use_custom_secrets:
                flow = InstalledAppFlow.from_client_secrets_file(self.client_secrets_path, SCOPES)
            elif DEFAULT_CLIENT_ID and "YOUR_APP_DEFAULT" not in DEFAULT_CLIENT_ID:
                client_config = {
                    "installed": {
                        "client_id": DEFAULT_CLIENT_ID,
                        "client_secret": DEFAULT_CLIENT_SECRET,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                        "redirect_uris": ["http://localhost"]
                    }
                }
                flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
            else:
                if not os.path.exists(self.client_secrets_path):
                    template = {
                        "installed": {
                            "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
                            "project_id": "joy-markdown-studio",
                            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                            "token_uri": "https://oauth2.googleapis.com/token",
                            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                            "client_secret": "YOUR_CLIENT_SECRET",
                            "redirect_uris": ["http://localhost"]
                        }
                    }
                    with open(self.client_secrets_path, 'w', encoding='utf-8') as f:
                        json.dump(template, f, indent=4)
                return {
                    "status": "error",
                    "message": "client_secrets.json 파일이 없습니다. 프로젝트 루트에 발급받은 클라이언트 인증키(client_secrets.json)를 배치해 주세요."
                }

            self.creds = flow.run_local_server(port=0)
            with open(self.token_file_path, 'w') as token:
                token.write(self.creds.to_json())
            self.service = build('drive', 'v3', credentials=self.creds)
            return {"status": "success", "message": "구글 드라이브 연동에 성공했습니다."}
        except Exception as e:
            return {"status": "error", "message": f"구글 드라이브 인증 중 오류 발생: {str(e)}"}

    def disconnect(self):
        if os.path.exists(self.token_file_path):
            try:
                os.remove(self.token_file_path)
            except:
                pass
        self.creds = None
        self.service = None
        self.app_folder_id = None
        return {"status": "success", "message": "구글 드라이브 연동이 해제되었습니다."}

    def get_user_info(self):
        if not self.is_authenticated():
            return None
        try:
            about = self.service.about().get(fields="user").execute()
            user = about.get('user', {})
            return {
                "displayName": user.get('displayName', ''),
                "emailAddress": user.get('emailAddress', '')
            }
        except Exception as e:
            print(f"Error getting user info: {e}")
            return None

    def get_or_create_app_folder(self):
        if not self.is_authenticated():
            raise Exception("구글 계정 연동이 필요합니다.")
        
        if self.app_folder_id:
            return self.app_folder_id

        try:
            query = "name = 'JoyMarkdownStudio' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
            results = self.service.files().list(q=query, spaces='drive', fields="files(id, name)").execute()
            files = results.get('files', [])
            if files:
                self.app_folder_id = files[0]['id']
                return self.app_folder_id
            
            file_metadata = {
                'name': 'JoyMarkdownStudio',
                'mimeType': 'application/vnd.google-apps.folder'
            }
            folder = self.service.files().create(body=file_metadata, fields='id').execute()
            self.app_folder_id = folder.get('id')
            return self.app_folder_id
        except Exception as e:
            raise Exception(f"전용 폴더 생성 실패: {str(e)}")

    def upload_file(self, local_path, file_id=None):
        if not self.is_authenticated():
            raise Exception("구글 계정 연동이 필요합니다.")
        
        if not os.path.exists(local_path):
            raise Exception(f"로컬 파일이 존재하지 않습니다: {local_path}")

        folder_id = self.get_or_create_app_folder()
        filename = os.path.basename(local_path)
        media = MediaFileUpload(local_path, mimetype='text/markdown', resumable=True)

        try:
            if file_id:
                file = self.service.files().update(
                    fileId=file_id,
                    media_body=media
                ).execute()
                return file_id
            else:
                # 중복 생성 방지를 위해 이름으로 재검색
                query = f"name = '{filename}' and '{folder_id}' in parents and trashed = false"
                results = self.service.files().list(q=query, spaces='drive', fields="files(id, name)").execute()
                files = results.get('files', [])
                if files:
                    file_id = files[0]['id']
                    self.service.files().update(
                        fileId=file_id,
                        media_body=media
                    ).execute()
                    return file_id
                else:
                    file_metadata = {
                        'name': filename,
                        'parents': [folder_id]
                    }
                    file = self.service.files().create(
                        body=file_metadata,
                        media_body=media,
                        fields='id'
                    ).execute()
                    return file.get('id')
        except Exception as e:
            raise Exception(f"구글 드라이브 업로드 실패: {str(e)}")

    def download_file(self, file_id, dest_path):
        if not self.is_authenticated():
            raise Exception("구글 계정 연동이 필요합니다.")
        
        try:
            request = self.service.files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()
            
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            with open(dest_path, 'wb') as f:
                f.write(fh.getvalue())
            return True
        except Exception as e:
            raise Exception(f"구글 드라이브 다운로드 실패: {str(e)}")

    def get_remote_modified_time(self, file_id):
        if not self.is_authenticated():
            raise Exception("구글 계정 연동이 필요합니다.")
        try:
            file_meta = self.service.files().get(fileId=file_id, fields="modifiedTime").execute()
            time_str = file_meta.get("modifiedTime")
            if time_str:
                # Remove Z and parse
                dt = datetime.datetime.strptime(time_str.replace('Z', ''), '%Y-%m-%dT%H:%M:%S.%f')
                return dt.timestamp()
            return 0
        except Exception as e:
            print(f"Error getting remote modified time: {e}")
            return 0
