import io,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8')
ROOT=r'C:\Users\qpalz\Desktop\hyrj2_mod'
src=io.open(ROOT+r'\game-source\project.dec.js',encoding='utf-8',errors='replace').read()
lines=src.split('\n')
def show(pat, before=1, after=8, limit=20):
    print('#'*12, pat, '(total %d)'%src.count(pat))
    n=0
    for i,l in enumerate(lines):
        if pat in l:
            n+=1
            if n>limit: 
                print('... more than %d matches'%limit); break
            for j in range(max(0,i-before), min(len(lines),i+after)):
                mark='>>' if j==i else '  '
                print('%s%6d| %s'%(mark, j+1, lines[j].strip()[:230]))
            print('-'*50)
show('cheat', 1, 10, 15)
