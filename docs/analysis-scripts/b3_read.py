import io,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
p=r'C:\Users\qpalz\Desktop\hyrj_mod\hyqs-island-mod-main\README.md'
lines=io.open(p,encoding='utf-8').read().split('\n')
s=None;e=None
for i,l in enumerate(lines):
    if l.startswith('## 6.5'): s=i
    if l.startswith('## 7.') and s is not None: e=i;break
print('\n'.join(lines[s:e]))
