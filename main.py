import sys
import os

# 패키지를 올바르게 임포트하기 위해 현재 디렉터리를 sys.path 최상단에 추가
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from jmstudio.main import main

if __name__ == "__main__":
    main()
