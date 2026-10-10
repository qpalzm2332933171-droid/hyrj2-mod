# -*- coding: utf-8 -*-
import io, re, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
prev = r"C:\Users\qpalz\Desktop\hyrj_mod\hyqs-island-mod-main\mod\js\mod_native.js"
s = io.open(prev, encoding="utf-8").read()
out = []
for m in re.finditer(r'title:\s*"([^"]{2,40})"\s*,\s*items', s):
    out.append("TAB: " + m.group(1))
btns = re.findall(r'\{\s*type:\s*"button"\s*,\s*id:\s*"([A-Za-z0-9_]+)"\s*,\s*title:\s*"([^"]*)"', s)
out.append("--- BUTTONS (%d) ---" % len(btns))
for i, t in btns:
    out.append("%-24s | %s" % (i, t))
sw = re.findall(r'\{\s*type:\s*"switch"\s*,\s*id:\s*"([A-Za-z0-9_]+)"\s*,\s*title:\s*"([^"]*)"', s)
out.append("--- SWITCHES (%d) ---" % len(sw))
for i, t in sw:
    out.append("%-24s | %s" % (i, t))
io.open(r"C:\Users\qpalz\Desktop\hyrj2_mod\work\analysis\g1_prev_menu.out.txt", "w", encoding="utf-8").write("\n".join(out))
print("\n".join(out))
