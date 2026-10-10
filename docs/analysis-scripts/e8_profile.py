import io,re,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
ROOT=r"C:\Users\qpalz\Desktop\hyrj2_mod"
lines=io.open(ROOT+r"\game-source\project.hot.dec.js",encoding="utf-8",errors="replace").read().split("\n")
start=None
for i,l in enumerate(lines):
    if re.match(r'^\s*HYProfile: \[ function', l): start=i; break
print('HYProfile at', start+1)
for j in range(start, min(start+300,len(lines))):
    s=lines[j].strip()
    m=re.match(r'^([A-Za-z_$][\w$]*): function', s)
    if m: print('   %-30s L%d'%(m.group(1),j+1))
