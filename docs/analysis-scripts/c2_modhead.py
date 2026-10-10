import io,sys,re
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
p=r'C:\Users\qpalz\Desktop\hyrj_mod\hyqs-island-mod-main\mod\js\mod_native.js'
src=io.open(p,encoding='utf-8').read()
lines=src.split('\n')
print('total lines',len(lines))
print('='*30,'head 120 lines')
for i in range(120): print('%5d| %s'%(i+1,lines[i][:200]))
