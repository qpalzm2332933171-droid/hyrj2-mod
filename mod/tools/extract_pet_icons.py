# -*- coding: utf-8 -*-
"""从解密后的 APK 资源里提取宠物头像到 mail-tool/icons, 供 MOD 选择器显示。
   pets 1..9 -> pet_<n>.png ; head_0 -> pet.png (通用兜底, 宠物10-15 无独立图标)"""
import os, shutil, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

SRC = os.path.join(config.APK_DEC, "assets", "res", "raw-assets", "resources", "Texture", "PetIcon")
DST = config.ICONS

def main():
    if not os.path.isdir(SRC):
        print("找不到宠物图标目录: " + SRC); return
    os.makedirs(DST, exist_ok=True)
    n = 0
    for i in range(1, 10):
        f = os.path.join(SRC, "head_%d.png" % i)
        if os.path.exists(f):
            shutil.copyfile(f, os.path.join(DST, "pet_%d.png" % i)); n += 1
    g = os.path.join(SRC, "head_0.png")
    if os.path.exists(g):
        shutil.copyfile(g, os.path.join(DST, "pet.png")); n += 1
    print("宠物图标 %d 个 -> %s" % (n, DST))

if __name__ == "__main__":
    main()
