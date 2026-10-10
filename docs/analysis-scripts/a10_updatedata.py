import io,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8')
ROOT=r'C:\Users\qpalz\Desktop\hyrj2_mod'
src=io.open(ROOT+r'\game-source\project.dec.js',encoding='utf-8',errors='replace').read()
lines=src.split('\n')
print('### updateData fn 50740-50880:')
for j in range(50740-1, 50880):
    print('%6d| %s'%(j+1,lines[j][:235]))
print()
print('### _requestCommon region:')
for i,l in enumerate(lines):
    if '_requestCommon: function' in l:
        for j in range(i-5, i+70):
            print('%6d| %s'%(j+1,lines[j][:235]))
        break
