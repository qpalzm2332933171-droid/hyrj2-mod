# -*- coding: utf-8 -*-
"""从 APK 的自动图集里裁出物品图标 -> mail-tool/icons/<id>.png

数据来源 (运行时 dump, 见 work/analysis/dump_icons.js):
    在游戏内执行 dump_icons.js, 它会用 cc.loader.loadRes("Texture/Item/<id>")
    逐个取 SpriteFrame 的 rect 并打印 `[HYMOD] ICO|<id>|<atlas>|<x>,<y>,<w>,<h>`;
    再用 adb logcat 抓出这些行存成文本文件, 交给本脚本裁剪。

为什么不在本地解析图集元数据:
    settings.jsc 里是压缩 uuid (22 字符), import/*.json 是完整 uuid,
    本地反解映射成本高; 运行时拿 rect 最省事且总是与设备实际资源一致。

用法:
    python extract_icons.py                       # 默认读 work/analysis/icons_raw.txt
    python extract_icons.py --raw X.txt --out Y   # 指定输入/输出目录
"""
import argparse, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

ATLAS_DIR = os.path.join(config.APK_DEC, "assets", "res", "raw-assets",
                         "resources", "Texture", "Item")
LINE = re.compile(r"^(\S+)\|(\d+)\|(\d+),(\d+),(\d+),(\d+)\s*$")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=os.path.join(config.WORK, "analysis", "icons_raw.txt"))
    ap.add_argument("--out", default=config.ICONS)
    a = ap.parse_args()

    from PIL import Image
    if not os.path.exists(a.raw):
        sys.exit("找不到 dump 文件 " + a.raw)

    # 收集: atlas -> {id: rect}
    per_atlas = {}
    for ln in open(a.raw, encoding="utf-8", errors="replace"):
        m = LINE.match(ln.strip())
        if not m:
            continue
        g = m.groups()
        iid, atlas = g[0], g[1]
        x, y, w, h = int(g[2]), int(g[3]), int(g[4]), int(g[5])
        per_atlas.setdefault(atlas, {})[iid] = (x, y, w, h)

    os.makedirs(a.out, exist_ok=True)
    total = 0
    for atlas, items in sorted(per_atlas.items()):
        png = os.path.join(ATLAS_DIR, "AutoAtlas-%s.png" % atlas)
        if not os.path.exists(png):
            print("缺图集文件, 跳过: " + png)
            continue
        img = Image.open(png).convert("RGBA")
        for iid, (x, y, w, h) in items.items():
            img.crop((x, y, x + w, y + h)).save(os.path.join(a.out, iid + ".png"))
            total += 1
        print("AutoAtlas-%s.png %dx%d -> %d 个图标" % (atlas, img.width, img.height, len(items)))
    print("共写出 %d 个图标 -> %s" % (total, a.out))


if __name__ == "__main__":
    main()
