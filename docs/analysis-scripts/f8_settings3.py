import io,json,sys,re
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
d=io.open(r"C:\Users\qpalz\Desktop\hyrj2_mod\work\device\settings_dec_encrypt.js",encoding="utf-8").read()
i=d.index("=")
j=json.loads(d[i+1:].rstrip().rstrip(";"))
print('keys:',list(j.keys()))
paths=j.get("paths") or {}
print('paths count',len(paths))
hits=[(k,v) for k,v in paths.items() if 'Profiles' in str(v)]
print('Profiles hits:',len(hits))
for k,v in hits[:20]: print(' ',k,v)
uuids=j.get("uuids") or []
print('uuids type',type(uuids), len(uuids) if hasattr(uuids,'__len__') else '')
if hits:
    k,v=hits[0]
    idx=int(k)
    print('first hit idx',idx,'uuid',uuids[idx] if isinstance(uuids,list) else uuids.get(k))
io.open(r"C:\Users\qpalz\Desktop\hyrj2_mod\work\device\settings_dec.json","w",encoding="utf-8").write(json.dumps(j,ensure_ascii=False)[:200])
