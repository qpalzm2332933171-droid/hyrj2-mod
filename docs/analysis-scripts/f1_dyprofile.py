import io,re,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
ROOT=r"C:\Users\qpalz\Desktop\hyrj2_mod"
lines=io.open(ROOT+r"\game-source\project.hot.dec.js",encoding="utf-8",errors="replace").read().split("\n")
start=None
for i,l in enumerate(lines):
    if re.match(r'^\s*DYProfile: \[ function', l): start=i; break
print('DYProfile at', start+1)
for j in range(start, start+140):
    print('%6d| %s'%(j+1,lines[j][:215]))
