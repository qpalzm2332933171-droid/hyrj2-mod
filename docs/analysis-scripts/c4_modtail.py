import io,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
p=r'C:\Users\qpalz\Desktop\hyrj_mod\hyqs-island-mod-main\mod\js\mod_native.js'
lines=io.open(p,encoding='utf-8').read().split('\n')
for i in range(2200,2313): print('%5d| %s'%(i+1,lines[i][:200]))
