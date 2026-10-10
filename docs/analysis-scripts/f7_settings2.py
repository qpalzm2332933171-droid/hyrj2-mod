import io,zipfile,sys,json,xxtea
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
p=r"C:\Users\qpalz\Desktop\hyrj2_mod\work\apk_dec\assets\src\settings.jsc"
b=io.open(p,"rb").read()
z=xxtea.decrypt(b,b"ebf83d12-bc75-4b")
print('dec head',z[:4])
zf=zipfile.ZipFile(io.BytesIO(z))
print(zf.namelist())
for n in zf.namelist():
    d=zf.read(n)
    out=r"C:\Users\qpalz\Desktop\hyrj2_mod\work\device\settings_dec_"+n.replace('/','_')
    io.open(out,'wb').write(d)
    print('saved',out,len(d))
    try:
        j=json.loads(d.decode('utf-8'))
        print('keys:',list(j.keys())[:12])
    except Exception as e: print('not json',e)
