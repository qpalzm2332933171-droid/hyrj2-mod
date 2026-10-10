# -*- coding: utf-8 -*-
"""在游戏进程里执行一段 JS (走 ModProvider 的 content call 调试通道), 并回显日志。

用法:
    python js_call.py "HYMOD.diag()"
    python js_call.py --file work/analysis/test.js
    python js_call.py "HYMOD.giveItems(['1001'],10,'warehouse')" --wait 6
"""
import argparse, base64, os, subprocess, sys
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

ADB = os.environ.get("HYRJ_ADB", r"D:\adb\platform-tools-latest-windows\platform-tools\adb.exe")
SERIAL = os.environ.get("HYRJ_SERIAL", "127.0.0.1:16384")
URI = "content://com.dygame.hyrj.nearme.gamecenter.hymod"


def sh(args):
    return subprocess.run([ADB, "-s", SERIAL] + args, capture_output=True, encoding="utf-8", errors="replace").stdout or ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("js", nargs="?")
    ap.add_argument("--file")
    ap.add_argument("--wait", type=float, default=3.0)
    a = ap.parse_args()
    js = open(a.file, encoding="utf-8").read() if a.file else a.js
    if not js:
        sys.exit("需要 JS 代码")
    b64 = base64.b64encode(js.encode("utf-8")).decode("ascii")
    sh(["logcat", "-c"])
    out = sh(["shell", "su", "-c", "content call --uri %s --method js64 --arg %s" % (URI, b64)])
    print("call:", out.strip()[:200])
    import time
    time.sleep(a.wait)
    lg = sh(["logcat", "-d"])
    for line in lg.splitlines():
        if "HYMOD" in line or "jswrapper" in line:
            i = line.find(": ", line.find(": ") + 2)
            print(line.split(" ", 5)[-1][:220])


if __name__ == "__main__":
    main()
