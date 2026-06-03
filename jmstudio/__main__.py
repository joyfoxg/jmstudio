import sys
import os

# 패키지 경로를 sys.path에 수동으로 주입하여 단독 실행/PyInstaller 환경에서 임포트 문제 해결
package_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if package_dir not in sys.path:
    sys.path.insert(0, package_dir)

from jmstudio.main import main

if __name__ == "__main__":
    main()
