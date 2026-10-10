import io,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8')
ROOT=r'C:\Users\qpalz\Desktop\hyrj2_mod'
src=io.open(ROOT+r'\game-source\project.dec.js',encoding='utf-8',errors='replace').read()
lines=src.split('\n')
print('### cheat_tick region 50100-50200:')
for j in range(50100-1, 50210):
    print('%6d| %s'%(j+1,lines[j][:235]))
