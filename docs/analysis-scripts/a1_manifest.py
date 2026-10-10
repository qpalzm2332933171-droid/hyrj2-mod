import io,re,sys,os
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8')
ROOT=r'C:\Users\qpalz\Desktop\hyrj2_mod'
s=io.open(os.path.join(ROOT,'work','apk_dec','AndroidManifest.xml'),encoding='utf-8').read()
i=s.find('<manifest'); print(s[i:i+400])
print()
acts=re.findall(r'<activity[^>]*?android:name="([^"]+)"', s)
print('activities:')
for a in acts: print('  ', a)
