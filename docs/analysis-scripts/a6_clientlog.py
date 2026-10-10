import io,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8')
ROOT=r'C:\Users\qpalz\Desktop\hyrj2_mod'
src=io.open(ROOT+r'\game-source\project.dec.js',encoding='utf-8',errors='replace').read()
lines=src.split('\n')
print('### all lines containing cheat:')
for i,l in enumerate(lines):
    if 'cheat' in l.lower():
        print('%6d| %s'%(i+1,l.strip()[:220]))
print()
print('### clientlog full function:')
for j in range(51120-1, 51200):
    print('%6d| %s'%(j+1,lines[j][:235]))
