import io,sys,re
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
p=r'C:\Users\qpalz\Desktop\hyrj_mod\hyqs-island-mod-main\mod\js\mod_native.js'
src=io.open(p,encoding='utf-8').read()
lines=src.split('\n')
pat=re.compile(r'^\s*(/\*|//|function |var [A-Za-z_$]+ =|M\.[A-Za-z_$]+ =|install|setMenu|openMenu)')
for i,l in enumerate(lines):
    s=l.strip()
    if s.startswith('/*') or s.startswith('// ---') or (s.startswith('function ') and '{' in s) or re.match(r'^(var|M\.)', s):
        print('%5d| %s'%(i+1,s[:150]))
