import io,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
ROOT=r"C:\Users\qpalz\Desktop\hyrj2_mod"
src=io.open(ROOT+r"\game-source\project.hot.dec.js",encoding="utf-8",errors="replace").read()
lines=src.split("\n")
for j in range(54800,55260):
    print('%6d| %s'%(j+1,lines[j][:200]))
