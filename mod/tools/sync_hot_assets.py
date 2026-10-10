# -*- coding: utf-8 -*-
"""把热更拉下来的 2 个资源 JSON 覆盖进 apk_dec (让 APK 资源 = 服务器 0.0.8 版)"""
import os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

PAIRS = [
    ("work/device/res_import/98/980b8a6a-d2c0-4642-bdaf-fa3d7572d1f1.json",
     "assets/res/import/98/980b8a6a-d2c0-4642-bdaf-fa3d7572d1f1.json"),
    ("work/device/res_import/cd/cd9d1dd5-6f87-4b36-8660-97f31f30356c.json",
     "assets/res/import/cd/cd9d1dd5-6f87-4b36-8660-97f31f30356c.json"),
]

def main():
    n = 0
    for src, dst in PAIRS:
        s = os.path.join(config.REPO, src)
        d = os.path.join(config.APK_DEC, dst)
        if os.path.exists(s):
            os.makedirs(os.path.dirname(d), exist_ok=True)
            shutil.copyfile(s, d)
            n += 1
            print("sync", dst)
    print("synced %d/%d" % (n, len(PAIRS)))

if __name__ == "__main__":
    main()
