import io,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8')
ROOT=r'C:\Users\qpalz\Desktop\hyrj2_mod'
src=io.open(ROOT+r'\game-source\project.dec.js',encoding='utf-8',errors='replace').read()
lines=src.split('\n')
print('### seal occurrences:')
for i,l in enumerate(lines):
    if 'seal' in l.lower():
        print('%6d| %s'%(i+1,l.strip()[:220]))
print()
print('### updatedata occurrences:')
for i,l in enumerate(lines):
    if 'updatedata' in l.lower():
        print('%6d| %s'%(i+1,l.strip()[:220]))
