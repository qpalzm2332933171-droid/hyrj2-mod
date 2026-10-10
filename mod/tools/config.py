# -*- coding: utf-8 -*-
"""公共路径配置 (荒野日记 第二代 MOD)"""
import os, shutil, glob, sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WORK = os.environ.get("HYRJ_WORK", os.path.join(REPO, "work"))
APK_DEC = os.path.join(WORK, "apk_dec")
APKTOOL = os.environ.get("HYRJ_APKTOOL", os.path.join(WORK, "apktool.jar"))
BUILD = os.path.join(WORK, "build")
MOD_JS = os.path.join(REPO, "mod", "js")
GAME_SRC = os.path.join(REPO, "game-source")
ICONS = os.path.join(REPO, "mail-tool", "icons")
JAVA_SRC = os.path.join(REPO, "mod", "java")
DEX_DIR = os.path.join(WORK, "mod_java", "dex")
CLASSES_DEX = os.path.join(DEX_DIR, "classes.dex")
BASE_JS = os.path.join(GAME_SRC, "project.mod.base.js")

def find_sdk():
    for k in ("ANDROID_SDK_ROOT", "ANDROID_HOME"):
        if os.environ.get(k) and os.path.isdir(os.environ[k]):
            return os.environ[k]
    for p in (r"D:\\Android\\AndroidSDK", os.path.expanduser("~/Android/Sdk"),
              os.path.expanduser("~/Library/Android/sdk")):
        if os.path.isdir(p):
            return p
    return None

def build_tools(sdk=None):
    sdk = sdk or find_sdk()
    if not sdk:
        raise SystemExit("找不到 Android SDK, 请设置 ANDROID_SDK_ROOT 或用 --sdk 指定")
    bt = sorted(glob.glob(os.path.join(sdk, "build-tools", "*")))
    exe_name = "zipalign.exe" if os.name == "nt" else "zipalign"
    bt = [b for b in bt if os.path.exists(os.path.join(b, exe_name))]
    if not bt:
        raise SystemExit("SDK 里没有 build-tools")
    bt = sorted(bt, key=lambda p: [int(x) if x.isdigit() else 0 for x in os.path.basename(p).split(".")])[-1]
    plats = sorted(glob.glob(os.path.join(sdk, "platforms", "android-*")))
    if not plats:
        raise SystemExit("SDK 里没有 platforms/android-*")
    jar = os.path.join(plats[-1], "android.jar")
    return bt, jar

def exe(name):
    bt, _ = build_tools()
    for cand in (os.path.join(bt, name + ".bat"), os.path.join(bt, name + ".exe"), os.path.join(bt, name)):
        if os.path.exists(cand):
            return cand
    raise SystemExit("找不到 " + name)

def javac():
    jh = os.environ.get("JAVA_HOME")
    if jh:
        c = os.path.join(jh, "bin", "javac.exe" if os.name == "nt" else "javac")
        if os.path.exists(c):
            return c
    c = shutil.which("javac")
    if c:
        return c
    raise SystemExit("找不到 javac, 请设置 JAVA_HOME (需要 JDK 8+)")

def keystore():
    ks = os.environ.get("HYRJ_KEYSTORE") or os.path.expanduser("~/.android/debug.keystore")
    return ks, os.environ.get("HYRJ_KS_PASS", "android"), os.environ.get("HYRJ_KS_ALIAS", "androiddebugkey")
