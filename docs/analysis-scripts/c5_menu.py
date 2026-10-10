import io,sys,re
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
p=r'C:\Users\qpalz\Desktop\hyrj_mod\hyqs-island-mod-main\mod\java\com\hymod\ModMenu.java'
src=io.open(p,encoding='utf-8').read()
lines=src.split('\n')
for i,l in enumerate(lines):
    s=l.strip()
    if re.match(r'^(public|private|protected|static|class|final)', s) and '(' in s and ')' in s and ';' not in s[:len(s)-1] or s.startswith('class ') or s.startswith('public class'):
        print('%5d| %s'%(i+1,s[:160]))
