import io,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8')
ROOT=r'C:\Users\qpalz\Desktop\hyrj2_mod'
src=io.open(ROOT+r'\game-source\project.dec.js',encoding='utf-8',errors='replace').read()
lines=src.split('\n')
def rng(a,b,label):
    print('='*20, label)
    for j in range(a-1,min(b,len(lines))):
        print('%6d| %s'%(j+1,lines[j][:230]))
rng(44070,44200,'cheat region')
print()
print('### 4015 occurrences:')
for i,l in enumerate(lines):
    if '4015' in l:
        print('%6d| %s'%(i+1,l.strip()[:200]))
