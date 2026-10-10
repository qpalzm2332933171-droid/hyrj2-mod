import io,json,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
d=io.open(r"C:\Users\qpalz\Desktop\hyrj2_mod\work\device\settings_dec_encrypt.js",encoding="utf-8").read()
i=d.index("=")
j=json.loads(d[i+1:].rstrip().rstrip(";"))
ra=j["rawAssets"]["assets"]
hits=[(k,v[0],v[1]) for k,v in ra.items() if 'rof' in v[0]]
print('Profiles hits:',len(hits))
for k,p,t in hits[:30]: print(' %-24s %-46s type=%s'%(k,p,t))
