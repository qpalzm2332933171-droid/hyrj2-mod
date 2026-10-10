import io,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8')
ROOT=r'C:\Users\qpalz\Desktop\hyrj2_mod'
src=io.open(ROOT+r'\game-source\project.dec.js',encoding='utf-8',errors='replace').read()
lines=src.split('\n')
def rng(a,b,label):
    print('='*20, label)
    for j in range(a-1,min(b,len(lines))):
        print('%6d| %s'%(j+1,lines[j][:235]))
rng(77940,78130,'_checkIfCheat region (77969,78092)')
rng(12190 if False else 122170,122260,'account_cheat caller (122213)')
