import io,json,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
d=io.open(r"C:\Users\qpalz\Desktop\hyrj2_mod\work\device\settings_dec_encrypt.js",encoding="utf-8").read()
i=d.index("=")
j=json.loads(d[i+1:].rstrip().rstrip(";"))
ra=j["rawAssets"]
print('rawAssets keys:',list(ra.keys()))
for kk in ra: 
    v=ra[kk]
    print(' ',kk, type(v), (len(v) if hasattr(v,'__len__') else ''))
# find Profiles in the dict
for kk,v in ra.items():
    if isinstance(v,dict):
        hits=[(k,val) for k,val in v.items() if 'rofiel' in str(k) or 'profile' in str(k).lower()]
        print(kk,'profile-ish hits',len(hits), hits[:5])
        hits2=[(k,val) for k,val in v.items() if 'item' in str(k).lower()]
        print(kk,'item hits',len(hits2), hits2[:5])
