var out=[];
function mkMock(){
  return {
    mSide:0, mHP:100,
    getSide:function(){return this.mSide;},
    setSide:function(s){this.mSide=s;return this;},
    getHP:function(){return this.mHP;},
    getHPMax:function(){return 100;},
    addHP:function(d){this.mHP+=d;},
    setHP:function(v){this.mHP=v;},
    takeDamage:function(d){this.mHP-=d;},
    getAtk:function(){return 10;},
    getCritRate:function(){return 5;},
    getHurtReduce:function(){return [0,0,0,0];}
  };
}
try{
  var a=mkMock(), b=mkMock(), c=mkMock();
  HYMOD.buff.godMode=false; HYMOD.buff.oneHit=false;
  HYMOD.installWarriorBuff(a);
  HYMOD.buff.godMode=true; HYMOD.buff.oneHit=true;
  HYMOD.installWarriorBuff(b);
  HYMOD.installWarriorBuff(c);
  a.takeDamage(30);
  out.push('off: atk='+a.getAtk()+' hurtRed=['+a.getHurtReduce().join(',')+'] hp(100-30)='+a.getHP());
  out.push('on : atk='+b.getAtk()+' crit='+b.getCritRate()+' hurtRed=['+b.getHurtReduce().join(',')+']');
  b.takeDamage(9999); out.push('on takeDamage(9999)->hp='+b.getHP());
  b.addHP(-9999); out.push('on addHP(-9999)->hp='+b.getHP());
  b.setHP(0); out.push('on setHP(0)->hp='+b.getHP());
  c.setSide(1); c.takeDamage(30); c.addHP(-5);
  out.push('enemy: atk='+c.getAtk()+' hurtRed=['+c.getHurtReduce().join(',')+'] hp(100-30-5)='+c.getHP());
  HYMOD.buff.godMode=false; HYMOD.buff.oneHit=false;
  out.push('off2: atk='+a.getAtk()+' hurtRed=['+a.getHurtReduce().join(',')+']');
  console.log('[HYMOD] T13 | DONE');
}catch(e){ out.push('ERR='+e); }
jsb.fileUtils.writeStringToFile(out.join('\n'), '/data/data/com.dygame.hyrj.nearme.gamecenter/files/hymod_test.txt');
