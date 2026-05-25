import os
import base64
import tempfile

def main():
    # 1. Read app_icon.ico and convert to base64
    with open('app_icon.ico', 'rb') as f:
        icon_data = f.read()
    b64_icon = base64.b64encode(icon_data).decode('utf-8')

    # 2. Patch setup.py (console_scripts -> gui_scripts, 3.7.2 -> 3.7.3)
    with open('setup.py', 'r', encoding='utf-8') as f:
        setup_content = f.read()
    setup_content = setup_content.replace('version="3.7.2"', 'version="3.7.3"')
    setup_content = setup_content.replace('"console_scripts":', '"gui_scripts":')
    with open('setup.py', 'w', encoding='utf-8') as f:
        f.write(setup_content)
    print("setup.py updated.")

    # 3. Patch jmstudio.py (inject base64, remove hardcoded paths, bump version)
    with open('jmstudio.py', 'r', encoding='utf-8') as f:
        jm_lines = f.readlines()

    # Create the block to replace
    # We will look for: # 생성된 고품격 아이콘 복사 및 바인딩 (Windows의 경우 .ico 포맷 필수)
    # up to: dest_ico = os.path.join(dest_dir, "app_icon.ico")
    
    new_jm_lines = []
    skip = False
    for line in jm_lines:
        if 'APP_NAME = "Joy Markdown Studio v3.7.2"' in line:
            new_jm_lines.append('APP_NAME = "Joy Markdown Studio v3.7.3"\n')
            continue
        if '<title>Joy Markdown Studio v3.7.2</title>' in line:
            new_jm_lines.append(line.replace('3.7.2', '3.7.3'))
            continue

        if '# 생성된 고품격 아이콘 복사 및 바인딩 (Windows의 경우 .ico 포맷 필수)' in line:
            skip = True
            
            # Inject our new logic
            new_jm_lines.append('    # Base64로 내장된 아이콘 데이터를 임시 파일로 추출하여 사용\n')
            new_jm_lines.append('    import base64\n')
            new_jm_lines.append('    import tempfile\n')
            new_jm_lines.append(f'    icon_b64 = "{b64_icon}"\n')
            new_jm_lines.append('    dest_ico = os.path.join(tempfile.gettempdir(), "jmstudio_app_icon.ico")\n')
            new_jm_lines.append('    try:\n')
            new_jm_lines.append('        with open(dest_ico, "wb") as f:\n')
            new_jm_lines.append('            f.write(base64.b64decode(icon_b64))\n')
            new_jm_lines.append('    except Exception as e:\n')
            new_jm_lines.append('        dest_ico = None\n')
            new_jm_lines.append('        print("아이콘 추출 실패:", e)\n')
            continue

        if skip:
            if 'dest_ico =' in line and 'app_icon.ico' in line:
                skip = False
            continue
            
        # For the Pillow conversion block which we don't need anymore since we have an ico
        if 'if os.path.exists(dest_png) and not os.path.exists(dest_ico):' in line:
            # We skip the next 6 lines
            pass

        new_jm_lines.append(line)

    # Note: we need to manually remove the pillow block as it's cleaner
    final_lines = []
    skip_pillow = 0
    for line in new_jm_lines:
        if 'if os.path.exists(src_icon) and not os.path.exists(dest_png):' in line:
            skip_pillow = 4
            continue
        if skip_pillow > 0:
            skip_pillow -= 1
            continue

        if 'if os.path.exists(dest_png) and not os.path.exists(dest_ico):' in line:
            skip_pillow = 6
            continue
        if skip_pillow > 0:
            skip_pillow -= 1
            continue
        final_lines.append(line)

    with open('jmstudio.py', 'w', encoding='utf-8') as f:
        f.writelines(final_lines)
    print("jmstudio.py updated.")

    # 4. Patch READMEs and Manual
    for md_file in ['README.md', 'README_kr.md', 'RELEASE_MANUAL.md']:
        with open(md_file, 'r', encoding='utf-8') as f:
            content = f.read()
        content = content.replace('3.7.2', '3.7.3')
        with open(md_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"{md_file} updated.")

if __name__ == '__main__':
    main()
