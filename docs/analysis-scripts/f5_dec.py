import io,sys,zlib,gzip
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
p=r"C:\Users\qpalz\Desktop\hyrj2_mod\game-source\Profiles\item.txt"
s=io.open(p,encoding="ascii").read().strip()
print('len',len(s),'div3',len(s)/3)
vals=[int(s[i:i+3]) for i in range(0,len(s)-2,3)]
mx=max(vals); mn=min(vals)
print('triple decode: count',len(vals),'min',mn,'max',mx)
if mx<=255:
    b=bytes(vals)
    print('head hex',b[:32].hex())
    for tag,fn in [("zlib",zlib.decompress),("gzip",gzip.decompress)]:
        try: print(tag,'ok',len(fn(b)))
        except Exception as e: print(tag,'fail',str(e)[:50])
# maybe 2-digit groups
val2=None
rest=(len(s))%2
print('even?',rest)
if rest==0:
    v2=[int(s[i:i+2]) for i in range(0,len(s),2)]
    print('2-digit: count',len(v2),'min',min(v2),'max',max(v2))
