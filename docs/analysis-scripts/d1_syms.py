import io,sys
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
ROOT=r'C:\Users\qpalz\Desktop\hyrj2_mod'
src=io.open(ROOT+r'\game-source\project.hot.dec.js',encoding='utf-8',errors='replace').read()
pats=['getBaseFight','getFightBuff','getMoveSpeed','getDef:','getMiss','getMaxLoad','calScore','updateDuration','tryPay','tryCostADCoin','checkItem','getFightParams','isPotShow','_checkUnlock','addSkin','updateAttr','setTalent','techSkin','getSkinMaxLevel','trySave','updatedata' ,'updateData','clientlog','checkUpdateInfo','checkWords','querymail','updatemail']
for p in pats:
    print('%-18s %d'%(p,src.count(p)))
