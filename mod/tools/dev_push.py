# -*- coding: utf-8 -*-
"""JS 快速迭代: 打包 -> push 到设备热更目录 -> 重启游戏 -> 抓 [HYMOD] 日志。

用法:
    python dev_push.py                # 全流程
    python dev_push.py --no-launch    # 只推送不重启
    python dev_push.py --log 40       # 只看最近 40 行 MOD 日志
说明:
    走这条通道调试 JS 不需要重打包 APK (秒级)。最终仍然要用 build_apk.py 出成品。
"""
import argparse, os, re, subprocess, sys, time
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

ADB = os.environ.get("HYRJ_ADB", r"D:\adb\platform-tools-latest-windows\platform-tools\adb.exe")
SERIAL = os.environ.get("HYRJ_SERIAL", "127.0.0.1:16384")
PKG = "com.dygame.hyrj.nearme.gamecenter"
ACT = "com.dygame.common.DYGame"
HOT_SRC = "/data/data/%s/files/c98759c9a82b24c176af027949f417b0/src/project.jsc" % PKG


def adb(*args, **kw):
    kw.setdefault("encoding", "utf-8")
    kw.setdefault("errors", "replace")
    return subprocess.run([ADB, "-s", SERIAL] + list(args), capture_output=True, **kw)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-launch", action="store_true")
    ap.add_argument("--log", type=int, default=25, help="显示最近 N 行 MOD 日志")
    a = ap.parse_args()

    r = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "build_mod.py"),
                        "--check"], capture_output=True, encoding="utf-8", errors="replace")
    print(r.stdout.strip()[-500:])
    if r.returncode != 0:
        sys.exit("打包/语法检查失败")

    jsc = os.path.join(config.BUILD, "project.jsc")
    for cmd in (["push", jsc, "/data/local/tmp/hyrj_dev.jsc"],
                ["shell", "su", "-c",
                 "cp /data/local/tmp/hyrj_dev.jsc %s && chown u0_a80:u0_a80 %s && chmod 600 %s" % (HOT_SRC, HOT_SRC, HOT_SRC)]):
        rr = adb(*cmd)
        if rr.returncode != 0:
            sys.exit("adb 失败: " + (rr.stdout + rr.stderr)[:400])
    print("pushed -> " + HOT_SRC)

    if a.no_launch:
        return
    adb("shell", "am", "force-stop", PKG)
    adb("logcat", "-c")
    adb("shell", "am", "start", "-n", "%s/%s" % (PKG, ACT))
    print("game restarting ...")
    time.sleep(35)
    lg = adb("logcat", "-d").stdout or ""
    hits = [l for l in lg.splitlines() if "HYMOD" in l and "audit" not in l]
    for l in hits[-a.log:]:
        print(re.sub(r"^\S+\s+\S+\s+\S+\s+\S+\s+", "", l)[:200])
    errs = [l for l in lg.splitlines() if ("FATAL" in l or "AndroidRuntime: " in l) and PKG in l]
    if errs:
        print("!!! 崩溃:")
        for l in errs[:6]:
            print("   " + l[:180])


if __name__ == "__main__":
    main()
