import io,sys,re
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
ROOT=r'C:\Users\qpalz\Desktop\hyrj2_mod'
src=io.open(ROOT+r'\game-source\project.dec.js',encoding='utf-8',errors='replace').read()
names=re.findall(r'cc\._RF\.push\([^,]+,[^,]+,\s*"([^"]+)"\)',src)
print('module count',len(names))
seen=[]
for n in names:
    if n not in seen: seen.append(n)
print('unique',len(seen))
for i in range(0,len(seen),6):
    print('  '.join('%-24s'%x for x in seen[i:i+6]))
