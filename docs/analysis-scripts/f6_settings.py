import io,zipfile,sys,json
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
p=r"C:\Users\qpalz\Desktop\hyrj2_mod\work\apk_dec\assets\src\settings.jsc"
b=io.open(p,"rb").read()
print('size',len(b),'head',b[:4].hex())
try:
    z=zipfile.ZipFile(io.BytesIO(b))
    print('plain zip ok:',z.namelist()[:10])
    names=z.namelist()
    for n in names:
        if n.endswith('.json'):
            d=z.read(n)
            print('---',n,len(d))
            io.open(r"C:\Users\qpalz\Desktop\hyrj2_mod\work\device\settings."+n.replace('/','_'),'wb').write(d)
except Exception as e:
    print('not plain zip:',e)
