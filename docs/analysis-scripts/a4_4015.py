import io,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8')
ROOT=r'C:\Users\qpalz\Desktop\hyrj2_mod'
src=io.open(ROOT+r'\game-source\project.dec.js',encoding='utf-8',errors='replace').read()
lines=src.split('\n')
def rng(a,b,label):
    print('='*20, label)
    for j in range(a-1,min(b,len(lines))):
        print('%6d| %s'%(j+1,lines[j][:240]))
rng(42860,42910,'error codes')
rng(45480,45720,'_check4015 region')
