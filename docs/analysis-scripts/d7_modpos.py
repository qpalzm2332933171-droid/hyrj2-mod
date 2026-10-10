import io,re,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
ROOT=r"C:\Users\qpalz\Desktop\hyrj2_mod"
src=io.open(ROOT+r"\game-source\project.hot.dec.js",encoding="utf-8",errors="replace").read()
lines=src.split("\n")
# find module start lines for given names
def find_mod(name):
    for i,l in enumerate(lines):
        if re.match(r'^\s*'+name+r': \[ function', l):
            return i
    return None
for name in ["HYTime","HYTechnology","HYItem","HYContainer","PetMgr","HYBuild","HYAchievement","HYHttpMgr","ModelShop","DYIAPMgr","HYMail","HYFight","HYData","HYCommon","HYPlayer","HYGlobalBag","HYStat","HYSkillBuff","HYWarrior","PanelAtlas","SceneAtlas"]:
    i=find_mod(name)
    if i is not None:
        # find the class method list until cc._RF.pop()
        j=i
        end=i
        while j<len(lines) and end==i+0:
            if 'cc._RF.pop()' in lines[j]: end=j
            j+=1
            if j-i>6000: break
        n=end-i if end>i else 0
        print('%-16s line %6d  len %d'%(name,i+1,n))
