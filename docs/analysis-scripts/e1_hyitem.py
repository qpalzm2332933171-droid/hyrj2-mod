import io,re,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
ROOT=r"C:\Users\qpalz\Desktop\hyrj2_mod"
lines=io.open(ROOT+r"\game-source\project.hot.dec.js",encoding="utf-8",errors="replace").read().split("\n")
# print all t.exports blocks inside HYItem module range 51805..52659
for j in range(51804,52660):
    if "t.exports" in lines[j]:
        for k in range(j, min(j+40,len(lines))):
            print('%6d| %s'%(k+1,lines[k][:220]))
            if '}' == lines[k].strip() or '};' == lines[k].strip():
                print('...')
                break
        print('-'*50)
