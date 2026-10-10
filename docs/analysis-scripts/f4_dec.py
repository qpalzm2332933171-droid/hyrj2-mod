import io,sys,zlib,gzip,time
sys.setrecursionlimit(10000)
sys.set_int_max_str_digits(0)
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
p=r"C:\Users\qpalz\Desktop\hyrj2_mod\game-source\Profiles\item.txt"
s=io.open(p,encoding="ascii").read().strip()
t0=time.time()
n=int(s)
print('int ok %.1fs digits=%d'%(time.time()-t0,len(s)))
for endian in ("big","little"):
    b=n.to_bytes((n.bit_length()+7)//8, endian)
    print(endian, len(b), 'head:', b[:24].hex(), repr(b[:24]))
    for tag,fn in [("zlib",lambda x: zlib.decompress(x)), ("gzip",lambda x: gzip.decompress(x)), ("raw",lambda x:x)]:
        try:
            d=fn(b); print('  ',tag,'ok',len(d),repr(d[:100]))
        except Exception as e: print('  ',tag,'fail',str(e)[:60])
