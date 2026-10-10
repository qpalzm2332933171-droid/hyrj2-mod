# -*- coding: utf-8 -*-
"""解密游戏脚本:  assets/src/project.jsc  (xxtea + zip)  ->  game-source/*.js

用法:
    python decrypt_apk_js.py                 # 解 apk_dec 里的 -> game-source/project.dec.js
    python decrypt_apk_js.py --hot           # 额外 adb 拉设备热更版 -> game-source/project.hot.dec.js
    python decrypt_apk_js.py --file X.jsc --out Y.js
说明:
    热更版才是游戏的"当前真实逻辑", 制作 MOD 应以它为基线:
        cp game-source/project.hot.dec.js game-source/project.mod.base.js
"""
import argparse, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config, jsc

ADB = os.environ.get("HYRJ_ADB", r"D:\adb\platform-tools-latest-windows\platform-tools\adb.exe")
SERIAL = os.environ.get("HYRJ_SERIAL", "127.0.0.1:16384")
DEV = "/data/data/com.dygame.hyrj.nearme.gamecenter/files/c98759c9a82b24c176af027949f417b0/src/project.jsc"


def adb_pull(dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    tmp = "/data/local/tmp/hyrj_pull.jsc"
    for cmd in (["shell", "su", "-c", "cp %s %s && chmod 644 %s" % (DEV, tmp, tmp)],
                ["pull", tmp, dst]):
        r = subprocess.run([ADB, "-s", SERIAL] + cmd, capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit("adb 失败: " + " ".join(cmd) + "\n" + (r.stdout + r.stderr)[:600])
    return dst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default=os.path.join(config.APK_DEC, "assets", "src", "project.jsc"))
    ap.add_argument("--out", default=os.path.join(config.GAME_SRC, "project.dec.js"))
    ap.add_argument("--hot", action="store_true", help="再从设备拉热更版一起解密")
    a = ap.parse_args()

    if not os.path.exists(a.file):
        sys.exit("找不到 " + a.file + " (先 apktool d 解包)")
    n = len(jsc.unpack(a.file, a.out))
    print("apk  -> %s  (%d bytes)" % (a.out, n))

    if a.hot:
        raw = os.path.join(config.WORK, "device", "project.hot.jsc")
        adb_pull(raw)
        out = os.path.join(config.GAME_SRC, "project.hot.dec.js")
        n = len(jsc.unpack(raw, out))
        print("hot  -> %s  (%d bytes)" % (out, n))
        print("提示: cp game-source/project.hot.dec.js game-source/project.mod.base.js  (作为打包基线)")


if __name__ == "__main__":
    main()
