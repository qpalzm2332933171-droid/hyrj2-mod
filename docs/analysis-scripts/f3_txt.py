import io,sys,collections
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
p=r"C:\Users\qpalz\Desktop\hyrj2_mod\game-source\Profiles\item.txt"
b=io.open(p,"rb").read()
print('size',len(b))
c=collections.Counter(b)
print('distinct bytes:',len(c))
print('most common:',c.most_common(12))
print('first 64 bytes hex:',b[:64].hex())
print('has newline:',b.count(10),'has space:',b.count(32))
for f in ['role.txt','technology.txt','shop.txt','Achievement.txt'.lower()]:
    import os
    pp=r"C:\Users\qpalz\Desktop\hyrj2_mod\game-source\Profiles"
    fp=os.path.join(pp,f)
    if os.path.exists(fp):
        bb=io.open(fp,'rb').read()
        cc2=collections.Counter(bb)
        print(f,'size',len(bb),'distinct',len(cc2),'top',cc2.most_common(6))
