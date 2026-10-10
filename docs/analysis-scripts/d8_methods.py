import io,re,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
ROOT=r"C:\Users\qpalz\Desktop\hyrj2_mod"
src=io.open(ROOT+r"\game-source\project.hot.dec.js",encoding="utf-8",errors="replace").read()
lines=src.split("\n")
def find_mod(name):
    for i,l in enumerate(lines):
        if re.match(r'^\s*'+name+r': \[ function', l):
            return i
    return None
def mod_range(name):
    i=find_mod(name)
    if i is None: return None
    j=i+1
    while j<len(lines):
        if 'cc._RF.pop()' in lines[j]: break
        j+=1
        if j-i>8000: break
    return i,j
for name in ["HYTime","HYTechnology","HYData","HYGlobalBag","HYMail","HYFight","DYIAPMgr"]:
    r=mod_range(name)
    print('='*8,name,'lines',r[0]+1,'-',r[1]+1)
    for j in range(r[0],r[1]):
        s=lines[j].strip()
        m=re.match(r'^([A-Za-z_$][\w$]*): function', s)
        if m: print('   %-32s L%d'%(m.group(1),j+1))
