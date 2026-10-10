import io,re,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
ROOT=r"C:\Users\qpalz\Desktop\hyrj2_mod"
lines=io.open(ROOT+r"\game-source\project.hot.dec.js",encoding="utf-8",errors="replace").read().split("\n")
# find create/createItems related definitions within 51805..52659
for j in range(51804,52660):
    l=lines[j]
    if re.search(r'(^|\s)(S|b)\s*=\s*function|createItems|createItem|create\b.*function', l) and 'key:' not in l:
        print('%6d| %s'%(j+1,l[:230]))
