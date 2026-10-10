import io,re,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
ROOT=r"C:\Users\qpalz\Desktop\hyrj2_mod"
src=io.open(ROOT+r"\game-source\project.hot.dec.js",encoding="utf-8",errors="replace").read()
lines=src.split("\n")
cnt=0
for i,l in enumerate(lines):
    if re.search(r'window\.[A-Za-z_$]+ =', l) and cnt<40:
        print('%6d| %s'%(i+1,l.strip()[:160])); cnt+=1
