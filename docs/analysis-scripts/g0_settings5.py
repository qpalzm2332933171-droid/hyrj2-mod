import io,json,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
d=io.open(r"C:\Users\qpalz\Desktop\hyrj2_mod\work\device\settings_dec_encrypt.js",encoding="utf-8").read()
i=d.index("=")
j=json.loads(d[i+1:].rstrip().rstrip(";"))
ra=j["rawAssets"]["assets"]
ks=list(ra.keys())
print('count',len(ks))
print('sample keys:',ks[:20])
vals=list(ra.values())
print('sample vals:',vals[:8])
# type field?
print('sample tuple len', [len(v) if hasattr(v,'__len__') else v for v in vals[:8]])
