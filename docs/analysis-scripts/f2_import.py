import zipfile,json,io,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
z=zipfile.ZipFile(r"C:\Users\qpalz\Desktop\hyrj2_mod\荒野日记_0.0.7.0.apk")
names=[n for n in z.namelist() if n.startswith('assets/res/import/') and n.endswith('.json')]
print('import json count',len(names))
hits=0
for n in names:
    try:
        s=z.read(n)
        if b'"cc.JsonAsset"' in s or b'_name": "item"' in s or b"profiles" in s.lower():
            head=s[:220]
            print(n, len(s), head[:160])
            hits+=1
            if hits>12: break
    except Exception as e: pass
print('hits',hits)
