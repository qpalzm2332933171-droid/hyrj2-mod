/* =========================================================================
 *  荒野日记 (二代) —— 内置 MOD v0.3
 *  载体: 追加在 project.mod.base.js 末尾 -> 加密为 project.jsc
 *  UI  : com.hymod.ModMenu (原生 Android View, 打包在 APK 内)
 *  通信: jsb.reflection.callStaticMethod("com/hymod/ModBridge","setMenu","(Ljava/lang/String;)V",json)
 *  基线: 0.0.8.070501 (OPPO 渠道)
 *  原则: 优先 hook 返回值(纯本地不上传) > 走游戏原生接口; 绝不手写存档键
 * ========================================================================= */
(function () {
  if (window.HYMOD && window.HYMOD.ver === "1.0.6") return;
  var M = window.HYMOD = { ver: "1.0.6", ready: false };

  /* ================= 模块访问 (require 是 project.js 顶部定义的全局) ================= */
  var modCache = {};
  function R(name) {
    var v = modCache[name];
    if (v) return v;
    try {
      var rq = (typeof require !== "undefined" && require) ? require : (window.require || null);
      if (!rq) return null;
      v = rq(name) || null;
      if (v) modCache[name] = v;
      return v;
    } catch (e) { return null; }
  }
  M.R = R;

  /* ================= 基础工具 ================= */
  function log(s) { try { console.log("[HYMOD] " + s); } catch (e) {} }
  function T(msg) {
    try { var C = R("HYCommon"); if (C && C.toast) C.toast(String(msg)); } catch (e) { log("toast fail " + e); }
    try { bridge("setStatus", "(Ljava/lang/String;)V", String(msg)); } catch (e) {}
  }
  function ok(fn, tag) { try { return fn(); } catch (e) { log((tag || "err") + ": " + e); return null; } }
  M.log = log; M.T = T; M.ok = ok;

  function bridge(method, sig, arg) {
    try {
      var r;
      if (arg === undefined) r = jsb.reflection.callStaticMethod("com/hymod/ModBridge", method, "()V");
      else r = jsb.reflection.callStaticMethod("com/hymod/ModBridge", method, sig, arg);
      return r;
    } catch (e) { log("bridge " + method + " 失败: " + e); return null; }
  }
  M.bridge = bridge;
  function jstr(o) { try { return JSON.stringify(o); } catch (e) { return null; } }

  /* ================= 配置 ================= */
  var cfg = {
    safeLog: true,      // 拦截作弊上报 (clientlog / setCheat / DDREPORT / 4015 弹窗)
    noHotfix: true,     // 拦截热更(防 MOD 被覆盖)
    autoSave: true,     // 修改后自动存档
    safeUpdate: true,   // 过滤 updatedata 上传里的可疑键
    safeCoin: true      // 拦截 MOD 发放货币时的 saveCoinChange 上报
  };
  function persistOn() { try { return cc.sys.localStorage.getItem("hymod_persist") === "1"; } catch (e) { return false; } }
  M.persist = persistOn();
  ok(function () {
    var s = M.persist ? cc.sys.localStorage.getItem("hymod_cfg2") : null;
    if (s) { var o = JSON.parse(s); for (var k in o) cfg[k] = o[k]; }
  }, "cfg");
  M.cfg = cfg;
  function saveCfg() { if (!M.persist) return; ok(function () { cc.sys.localStorage.setItem("hymod_cfg2", JSON.stringify(cfg)); }); }
  function setPersist(on) {
    M.persist = !!on;
    ok(function () {
      cc.sys.localStorage.setItem("hymod_persist", on ? "1" : "0");
      if (!on) { cc.sys.localStorage.removeItem("hymod_vals2"); cc.sys.localStorage.removeItem("hymod_cfg2"); }
    }, "persist");
    if (on) ok(function () {
      cc.sys.localStorage.setItem("hymod_vals2", JSON.stringify(M.vals));
      cc.sys.localStorage.setItem("hymod_cfg2", JSON.stringify(cfg));
    }, "persistSave");
    log("保存功能首选项 = " + M.persist);
  }
  M.persistOn = persistOn; M.setPersist = setPersist;

  /* ================= 本地增益 (全部纯 hook, 不上传) ================= */
  var buff = {
    godMode: false,    // 无敌
    oneHit: false,     // 一击必杀
    moveOn: false,     // 移速
    moveMul: 300,
    lockAttrs: false,  // 锁定四维(不掉)
    freePay: false,    // 商店免费
    rbLock: false      // 数值锁定(防服务器刷新)
  };
  M.buff = buff;

  /* ================= 安全层 1: 作弊上报总闸 ================= */
  var hooksSafe = false;
  function installSafeHooks() {
    if (hooksSafe) return;
    var HH = R("HYHttpMgr"), HC = R("HYCommon");
    if (!HH || !HC) return;
    hooksSafe = true;

    /* 1) clientlog — 一切作弊上报的总出口(内部会 setCheat 再上传) */
    if (HH.clientlog) {
      var rawLog = HH.clientlog;
      HH.clientlog = function () {
        if (cfg.safeLog) {
          log("clientlog 已拦截: " + ok(function () { return JSON.stringify([].slice.call(arguments)).substr(0, 200); }));
          return;
        }
        return rawLog.apply(this, arguments);
      };
      log("已挂钩 HYHttpMgr.clientlog");
    }
    /* 2) logError — 过滤 REPORT_ERROR / 4015 相关 */
    if (HH.logError) {
      var rawErr = HH.logError;
      HH.logError = function (code, msg) {
        try {
          var s = String(code || "") + "|" + String(msg || "");
          if (cfg.safeLog && /REPORT_ERROR|RGE_|4015|cheat|Error/i.test(s) && /REPORT_ERROR|4015|cheat/i.test(s)) {
            log("logError 已拦截: " + s.substr(0, 160)); return;
          }
        } catch (e) {}
        return rawErr.apply(this, arguments);
      };
      log("已挂钩 HYHttpMgr.logError");
    }
    /* 3) setCheat 置空 (不再写 base.cheat) */
    if (HC.setCheat) {
      HC.setCheat = function (t) { log("setCheat 已拦截: " + t); };
      log("HYCommon.setCheat 已置空");
    }
    /* 4) sealTip 置空 */
    if (HC.sealTip) { HC.sealTip = function () { log("sealTip 已拦截"); }; log("HYCommon.sealTip 已置空"); }
    /* 5) alert / alertError 过滤 4015 */
    if (HC.alert) {
      var rawAlert = HC.alert;
      HC.alert = function (title, msg) {
        var s = String(title || "") + String(msg || "");
        if (cfg.safeLog && /4015|封号|作弊|外挂/.test(s)) { log("alert 已拦截: " + s.substr(0, 120)); return; }
        return rawAlert.apply(this, arguments);
      };
    }
    if (HC.alertError) {
      var rawAErr = HC.alertError;
      HC.alertError = function (code) {
        if (cfg.safeLog && String(code) === "4015") { log("alertError(4015) 已拦截"); return; }
        return rawAErr.apply(this, arguments);
      };
      log("HYCommon.alert/alertError 4015 过滤已安装");
    }
    /* 6) window.DDREPORT 改道 */
    if (window.DDREPORT) {
      window.DDREPORT = function () { try { log("[DDREPORT拦截] " + [].slice.call(arguments).join(" ").substr(0, 300)); } catch (e) {} };
      log("window.DDREPORT 已改道");
    }
    /* 7) 热更拦截 */
    if (HH.checkUpdateInfo) {
      var rawChk = HH.checkUpdateInfo;
      HH.checkUpdateInfo = function (cb) {
        if (cfg.noHotfix) {
          log("热更检查已拦截 -> 伪造 EVENT_NO_UPDATE");
          try { cb && cb(!0, { errorCode: 0, data: { ver: "", event: "0" } }); } catch (e) {}
          return;
        }
        return rawChk.apply(this, arguments);
      };
      log("HYHttpMgr.checkUpdateInfo 已挂钩");
    }
    /* 8) saveCoinChange — MOD 发币时不上报 */
    if (HH.saveCoinChange) {
      var rawCoin = HH.saveCoinChange;
      HH.saveCoinChange = function (a, info) {
        if (cfg.safeCoin && info) {
          if (info.type === "hycmod" || info.reasonId === "hycmod"
              || (parseInt(info.curGold, 10) || 0) >= 3e4
              || (parseInt(info.costGold, 10) || 0) >= 14257) {
            log("saveCoinChange 已拦截 (大额/MOD 发币) cur=" + info.curGold + " cost=" + info.costGold);
            return;
          }
        }
        return rawCoin.apply(this, arguments);
      };
      log("HYHttpMgr.saveCoinChange 已挂钩");
    }
    /* 9) updateData — 过滤可疑上传键 */
    if (HH.updateData) {
      var rawUpd = HH.updateData;
      HH.updateData = function (cb, uid, modify) {
        if (cfg.safeUpdate && typeof modify === "string" && modify.length > 2) {
          try {
            var o = JSON.parse(modify), n = 0, k;
            for (k in o) {
              if (/cheat/i.test(k)) { delete o[k]; n++; }
            }
            if (n) { log("updateData 已过滤 " + n + " 个可疑键"); modify = JSON.stringify(o); }
          } catch (e) {}
        }
        return rawUpd.call(this, cb, uid, modify);
      };
      log("HYHttpMgr.updateData 已挂钩 (safeUpdate)");
    }
    /* 10) 成就上报改道 (只做统计上报, 不参与封号判定) */
    var HA = R("HYAchievement");
    if (HA && HA._reportAchieve) {
      var rawRep = HA._reportAchieve;
      HA._reportAchieve = function () {
        if (cfg.safeLog) { log("_reportAchieve 已拦截"); return; }
        return rawRep.apply(this, arguments);
      };
      log("HYAchievement._reportAchieve 已挂钩");
    }
    /* 11) getDiamondNum — 解除 >=3e4 强制归零 (修复金币超过阈值被清零) */
    if (HC.getDiamondNum && !HC.__hymodDiamondFix) {
      HC.__hymodDiamondFix = 1;
      HC.getDiamondNum = function () {
        var t = ok(function () { return R("HYData").get("base.diamondInfo") || {}; }) || {};
        var n = 0;
        if (t.total) {
          var dec = ok(function () { return R("DY").utils.decodePrice(t.total); });
          n = parseInt(dec || "0", 10) || 0;
        }
        if (!isFinite(n) || n < 0) { log("getDiamondNum 异常值 " + n + " -> 0"); return 0; }
        return n;
      };
      log("HYCommon.getDiamondNum 已解除 3e4 归零限制");
    }
    /* 12) base.cheat 清零 */
    ok(function () {
      var HD = R("HYData");
      var v = HD.get("base.cheat");
      if (v) { HD.set("base.cheat", 0); HD.trySave(); log("base.cheat 已清零 (原值 " + v + ")"); }
    }, "clearCheat");
  }
  M.installSafeHooks = installSafeHooks;

  /* ================= 安全层 2: 去掉本地封号校验 ================= */
  var noBan = {};
  function installNoBanHooks() {
    try {
      if (!noBan.scenemain) {
        var cls = null;
        try { cls = cc.js && cc.js.getClassByName && cc.js.getClassByName("SceneMain"); } catch (e) {}
        if (cls && cls.prototype && cls.prototype._checkMainJs) {
          cls.prototype._checkMainJs = function () { log("本地 main.js 校验已移除"); return !0; };
          noBan.scenemain = 1;
          log("SceneMain._checkMainJs 已覆写");
        }
      }
      if (!noBan.scenemain2) {
        ok(function () {
          var sc = cc.director.getScene();
          if (!sc) return;
          var st = [sc], n = 0;
          while (st.length && n < 400) {
            var nd = st.pop(); n++;
            var cs = nd._components || [];
            for (var i = 0; i < cs.length; i++) {
              var c = cs[i];
              if (c && typeof c._checkMainJs === "function" && c.__classname__ === "SceneMain") {
                c._checkMainJs = function () { return !0; };
                noBan.scenemain2 = 1;
              }
            }
            var ch = nd._children || [];
            for (var j = 0; j < ch.length; j++) st.push(ch[j]);
          }
        }, "scenemainWalk");
      }
      /* PanelShop.onDestroy 加固: 游戏自身在此处有空指针 (mGoodsMgr 未初始化时)
         崩溃会中断节点销毁 -> 面板卡死 + 每帧刷错误日志 (对封号风控非常显眼) */
      if (!noBan.shopdestroy) {
        try {
          var PSC = cc.js && cc.js.getClassByName && cc.js.getClassByName("PanelShop");
          if (PSC && PSC.prototype && PSC.prototype.onDestroy && !PSC.prototype.__hymodSafeOD) {
            PSC.prototype.__hymodSafeOD = 1;
            PSC.prototype.onDestroy = function () {
              try { var n = this.mGoodsMgr && this.mGoodsMgr.getOneGoods(1); n && n.delPropListen("isShowRed", this, this.onRedPointChg); } catch (e) {}
              try { var ev = R("ShopEvent"); ev && ev.clear && ev.clear(); } catch (e) {}
              try { this.mGoodsMgr && this.mGoodsMgr.clear && this.mGoodsMgr.clear(); } catch (e) {}
              try { if ("InGame" == this.mEnterType) { var TM = R("HYTime"); TM && TM.lockResume && TM.lockResume("Shop"); } } catch (e) {}
            };
            noBan.shopdestroy = 1;
            log("PanelShop.onDestroy 已加固 (绕过游戏空指针 bug)");
          }
        } catch (e) { log("shopDestroy " + e); }
      }
      installCombatHooks();
      installMoveHooks();
      installStateHooks();
    } catch (e) { log("installNoBanHooks " + e); }
  }
  M.installNoBanHooks = installNoBanHooks;

  /* ================= 战斗 hook (只作用于我方) ================= */
  var combat = {};
  function installCombatHooks() {
    var HW = R("HYWarrior");
    if (!HW || combat.done) return;
    combat.done = 1;

    /* 只在 getter 层动手, 且每次都判 getSide()==0 (我方)。
       原因: HYFight.createNew 里 PVP 模式的敌方也用 PlayerWarrior/Pet 工厂
       (49951 行 setSide(1)), 若直接改配置对象 t, 敌方会一起变强。
       伤害公式 = this.getAtk(target) - target.getDef(this), 所以包 getAtk 即可。*/
    function installWarriorBuff(w) {
      if (!w || w.__hymodBuff) return w;
      w.__hymodBuff = 1;
      function mine(self) { try { return (self.getSide ? self.getSide() : 0) === 0; } catch (e) { return false; } }
      var rawAdd = w.addHP;
      if (rawAdd) w.addHP = function (d) { if (buff.godMode && d < 0 && mine(this)) return; return rawAdd.call(this, d); };
      var rawSet = w.setHP;
      if (rawSet) w.setHP = function (v) { if (buff.godMode && v <= 0 && mine(this)) return; return rawSet.call(this, v); };
      var rawAtk = w.getAtk;
      if (rawAtk) w.getAtk = function (e) {
        var v = rawAtk.call(this, e);
        if (buff.oneHit && mine(this) && typeof v === "number" && v > 0) return v * 50 + 50;
        return v;
      };
      var rawCrit = w.getCritRate;
      if (rawCrit) w.getCritRate = function (e) {
        var v = rawCrit.call(this, e);
        if (buff.oneHit && mine(this) && typeof v === "number") return Math.max(v, 100);
        return v;
      };
      var rawHurt = w.getHurtReduce;
      if (rawHurt) w.getHurtReduce = function (e) {
        var v = rawHurt.call(this, e);
        /* 返回的是 [平摊减伤, 百分比1, 百分比2, 百分比3] 数组 (57793 getProp("decHurt"))。
           旧实现按 number 判断 → 从未生效, 真实战斗实测纠正。 */
        if (buff.godMode && mine(this) && v && v.length >= 1) {
          var r = v.slice();
          r[0] = (r[0] || 0) + 1e9;
          return r;
        }
        return v;
      };
      /* 关键: 引擎扣血在 takeDamage 里直接 `l -= e` (58071), 不经 addHP/setHP,
         必须单独拦截, 否则无敌无效 (真实战斗实测发现, 敌方 1 点伤害穿透过)。 */
      var rawTake = w.takeDamage;
      if (rawTake) w.takeDamage = function (dmg, it, arr, res, src) {
        if (buff.godMode && mine(this)) return;
        return rawTake.call(this, dmg, it, arr, res, src);
      };
      return w;
    }
    M.installWarriorBuff = installWarriorBuff;

    function wrap(kind) {
      var K = HW[kind];
      if (!K || !K.createNew || K.__hymod) return;
      var raw = K.createNew;
      K.createNew = function (t, n) {
        var self = this;
        var w = raw.call(self, t, n);
        try { installWarriorBuff(w); } catch (e) { log("combat wrap " + e); }
        return w;
      };
      K.__hymod = 1;
      log("已挂钩 HYWarrior." + kind + ".createNew (按阵营生效)");
    }
    wrap("PlayerWarrior");
    wrap("Pet");
  }
  M.installCombatHooks = installCombatHooks;

  /* ================= 移速 hook ================= */
  /* 注意: getTeamBaseSpeed(roles, cb) / getTeamSpeed(roles, cb) 是回调式,
     返回值恒为 undefined, 必须包装最后一个函数参数才能放大实际数值 */
  var move = {};
  function installMoveHooks() {
    var HP = R("HYPlayer");
    if (!HP || move.done) return;
    move.done = 1;
    var fns = ["getTeamBaseSpeed", "getTeamSpeed"];
    for (var i = 0; i < fns.length; i++) {
      (function (fn) {
        if (!HP[fn]) return;
        var raw = HP[fn];
        HP[fn] = function () {
          var args = Array.prototype.slice.call(arguments);
          /* getTeamSpeed 内部会再调用 getTeamBaseSpeed, 两者都挂钩会叠加倍率,
             用 move.inTeam 标记避免内层重复乘 */
          var inner = (fn === "getTeamBaseSpeed" && move.inTeam);
          var mul = (buff.moveOn && buff.moveMul > 0 && !inner) ? (buff.moveMul / 100) : 0;
          var last = args.length ? args[args.length - 1] : null;
          if (mul && typeof last === "function") {
            args[args.length - 1] = function (v) {
              if (typeof v === "number" && v > 0) v = v * mul;
              return last.call(this, v);
            };
          }
          if (fn === "getTeamSpeed") move.inTeam = 1;
          var r;
          try { r = raw.apply(this, args); } finally { if (fn === "getTeamSpeed") move.inTeam = 0; }
          if (mul && typeof r === "number" && r > 0) r = r * mul;
          return r;
        };
        log("已挂钩 HYPlayer." + fn);
      })(fns[i]);
    }
  }
  M.installMoveHooks = installMoveHooks;

  /* ================= 属性 hook (锁定四维, 纯拦截不上传) ================= */
  var STATE_ATTRS = { hunger: 1, health: 1, mentality: 1, waterPlague: 0, hp: 1, mood: 1 };
  var stateH = {};
  function installStateHooks() {
    var HP = R("HYPlayer");
    if (!HP || stateH.done) return;
    stateH.done = 1;
    if (HP.updateState) {
      var raw = HP.updateState;
      HP.updateState = function (attr, delta, role) {
        try {
          /* 战斗结算会把战斗中受到的伤害写回持久存档:
             PanelFightLogV2.fightItem (90463) -> HYPlayer.updateRoleAttr("hp", -point)
             -> updateState("hp", -point)。无敌时必须在这里再拦一道, 否则
             即使战斗内 takeDamage 被拦, 结算仍会扣血 (真实战斗实测: 每场漏 1~2 点)。 */
          if (buff.godMode && attr === "hp" && delta < 0) return;
          if (buff.lockAttrs && delta < 0 && STATE_ATTRS[attr] && attr !== "hp") {
            return;
          }
        } catch (e) {}
        return raw.apply(this, arguments);
      };
      log("已挂钩 HYPlayer.updateState (锁四维 + 无敌结算拦截)");
    }
    if (HP.isWeak) {
      var rawW = HP.isWeak;
      HP.isWeak = function () {
        if (buff.godMode) return false;
        return rawW.apply(this, arguments);
      };
      log("已挂钩 HYPlayer.isWeak");
    }
    /* 宠物受伤结算同样走 writeback (fightItem 90460/90470 -> setHpRelative(-point)),
       无敌时一并拦截; getCarriedPet 返回单例, 首次取到时就地包一层。 */
    try {
      var PM = R("PetMgr");
      if (PM && PM.getCarriedPet && !PM.__hymodPetHook) {
        PM.__hymodPetHook = 1;
        var rawGetPet = PM.getCarriedPet;
        PM.getCarriedPet = function () {
          var p = rawGetPet.apply(this, arguments);
          try {
            if (p && p.setHpRelative && !p.__hymodPetBuff) {
              p.__hymodPetBuff = 1;
              var rawRel = p.setHpRelative;
              p.setHpRelative = function (d) {
                if (buff.godMode && d < 0) return;
                return rawRel.apply(this, arguments);
              };
            }
          } catch (e) {}
          return p;
        };
        log("已挂钩 PetMgr.getCarriedPet (无敌宠物结算拦截)");
      }
    } catch (e) { log("petHook " + e); }
  }
  M.installStateHooks = installStateHooks;

  /* ================= 通用: 遍历 profile ================= */
  function profiles(key) {
    var HP = R("HYProfile");
    if (!HP) return null;
    var p = HP.mProfiles && HP.mProfiles[key];
    if (p) return p;
    return null;
  }
  function allProfiles(key, cb) {
    var HP = R("HYProfile");
    if (!HP) { cb && cb(null); return; }
    var direct = profiles(key);
    if (direct) { cb && cb(direct); return; }
    ok(function () { HP.getAll(key, function (t) { cb && cb(t); }, 0, 1); }, key);
  }
  function nameOf(key, p, id) {
    try {
      if (!p) return "ID " + id;
      var s = p.name || p.title || p.buildName || p.id || id;
      var DY = R("DY");
      if (DY && DY.i18n && DY.i18n.t) { var tr = DY.i18n.t(s); if (tr) return tr; }
      return String(s);
    } catch (e) { return "ID " + id; }
  }
  M.profiles = profiles; M.allProfiles = allProfiles;

  /* ================= 词典补丁 (修复 name 键缺失导致名字为空) ================= */
  var dictP = { item_name_4000: "石块" };
  function patchDict() {
    ok(function () {
      var cn = R("cn");
      if (!cn) return;
      var n = 0;
      for (var k in dictP) { if (!cn[k]) { cn[k] = dictP[k]; n++; } }
      if (n) log("词典补丁已写入 " + n + " 项");
    }, "patchDict");
  }
  M.patchDict = patchDict;

  /* ================= 物品 ================= */
  function itemName(p) { return nameOf("item", p); }
  function itemNameById(id) {
    var p = ok(function () { return R("HYItem").getItemProfile(id); });
    return itemName(p) || ("ID " + id);
  }
  /* 与其它 picker 保持一致: 统一走 allProfiles 回调 (item 表虽在 mProfiles 中,
     但首次进入标题页时可能尚未装载, 同步取会拿到空表导致选择器不弹) */
  function pickerItems(cb) {
    allProfiles("item", function (cur) {
      var arr = [];
      for (var k in (cur || {})) {
        var p = cur[k];
        if (p && p.type == 18) continue; /* R6: 宠物道具(17103-17105)不参与全物品发放 */
        arr.push([String(k), nameOf("item", p, k), p.icon || ""]);
      }
      cb && cb(arr);
    });
  }
  M.itemNameById = itemNameById; M.pickerItems = pickerItems;

  /** 发放物品: target = "bag" | "warehouse" */
  function giveItems(ids, count, target) {
    var HC = R("HYCommon"), Const = R("Const");
    if (!HC || !Const) { T("模块未就绪"); return; }
    var st = (target === "bag") ? Const.ITEM_DROP_STORAGE.bag : Const.ITEM_DROP_STORAGE.warehouse;
    var done = 0, total = ids.length, c = parseInt(count, 10) || 1;
    if (!total) return;
    for (var i = 0; i < ids.length; i++) {
      (function (id) {
        HC.changeItemNum(String(id), c, st, function () {
          done++;
          if (done === total) { T("已发放 " + total + " 种物品 x" + c); if (cfg.autoSave) ok(function () { R("HYData").trySave(); }); }
        });
      })(ids[i]);
    }
  }
  M.giveItems = giveItems;

  /* ================= 货币 =================
     R1: 走游戏原生邮件通道 — HYHttpMgr.addMail 创建邮件 -> HYMail.updateReceiveState
     领取(服务端状态) -> HYCommon.addItemNum(同游戏 _doReceive 的本地发放路径)。
     失败时回退到旧的直连发放, 保证功能可用。 */
  function grantCurrencyDirect(gold, silver, why) {
    var HC = R("HYCommon");
    if (!HC) return;
    if (gold > 0) ok(function () { HC.updateDiamondNum(gold, !0, { type: "hycmod", reasonId: "hycmod" }, null); }, "gold");
    if (silver > 0) ok(function () { HC.updateShellNum(silver, !0, { type: "hycmod", reasonId: "hycmod" }, null); }, "silver");
    T("已直接发放 金币+" + (gold || 0) + " 银币+" + (silver || 0) + (why ? " [" + why + "]" : ""));
    if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
  }
  function grantCurrencyByMail(gold, silver) {
    var HH = R("HYHttpMgr"), DY = R("DY"), HC = R("HYCommon"), HD = R("HYData"), HM = R("HYMail");
    if (!HH || !DY || !HC || !HM || !HH.addMail) { grantCurrencyDirect(gold, silver, "邮件模块不可用"); return; }
    var goods = [];
    if (gold > 0) goods.push("5000," + gold);
    if (silver > 0) goods.push("5001," + silver);
    var mail = {
      channel: "_",
      to: DY.cache.uid,
      title: "物资补给",
      message: "补给已送达, 请查收",
      goods: goods.join(";"),
      deadline: Date.now() + 2592e6,
      from: 0,
      nick: "系统",
      type: 1
    };
    T("邮件发放中 金币+" + gold + " 银币+" + silver + " ...");
    HH.addMail(mail, function (err, res) {
      var id = res && res.data && (res.data.id || res.data.mailId);
      if (err || !res || (res.errorCode !== undefined && res.errorCode !== 0) || !id) {
        log("addMail 失败: err=" + err + " res=" + jstr(res));
        grantCurrencyDirect(gold, silver, "建邮件失败");
        return;
      }
      var mid = String(id);
      log("邮件已创建 id=" + mid + ", 走原生领取流程");
      ok(function () {
        HM.updateReceiveState([mid], function (succ) {
          if (!succ) { grantCurrencyDirect(gold, silver, "领取失败"); return; }
          if (gold > 0) ok(function () { HC.addItemNum("5000", gold, 1, null, { type: "receiveMail", reasonId: mid }); }, "mailGold");
          if (silver > 0) ok(function () { HC.addItemNum("5001", silver, 1, null, { type: "receiveMail", reasonId: mid }); }, "mailSilver");
          T("邮件领取成功: 金币+" + gold + " 银币+" + silver);
          if (cfg.autoSave) ok(function () { HD.trySave(); });
        });
      }, "recvMail");
    });
  }
  function grantCurrency(gold, silver) {
    grantCurrencyByMail(parseInt(gold, 10) || 0, parseInt(silver, 10) || 0);
  }
  M.grantCurrency = grantCurrency;
  M.grantCurrencyDirect = grantCurrencyDirect;

  /* ================= 背包 / 仓库 ================= */
  /* R5 修复: getBagObj()/getWareHouseObj() 每次 new 一个空容器(副本), 不是游戏真身;
     真实单例是 HYContainer.HYBag / HYContainer.HYWarehouse (游戏内所有背包逻辑都用它) */
  function containers() {
    var HC = R("HYContainer");
    if (!HC) return null;
    var bag = HC.HYBag, wh = HC.HYWarehouse;
    if (!bag || !wh) return null;
    return { bag: bag, wh: wh };
  }
  function bagToWarehouse() {
    /* R23: 统一走 MOD 入仓 (背包 -> 仓库), 仓库侧按键合并为"包";
       背包条目搬入后从背包删除, 维护存档与信号, 保证负重/索引一致。 */
    var c = containers();
    if (!c) { T("容器未就绪 (请先进入游戏)"); return; }
    var bag = c.bag, wh = c.wh;
    var all = ok(function () { return bag.getAllItemNotCheck(); }) || {};
    var keys = Object.keys(all);
    if (!keys.length) { T("背包是空的, 无需搬运"); return; }
    var moved = 0, left = 0, delta = 0;
    for (var i = 0; i < keys.length; i++) (function (k) {
      var it = all[k];
      if (!it) return;
      var cnt = parseInt(ok(function () { return it.getCount(); }) || 1, 10) || 1;
      var one = {}; one[k] = it;
      ok(function () { wh.addItems(one); }, "r23move");
      var nk = null;
      ok(function () { nk = it.getId(); });
      if (nk && wh.mItems[nk]) {
        ok(function () {
          delete bag.mItems[k];
          try { bag._onDelItem(k, it.getItemId()); } catch (e) {}
          bag._saveData(k);
          bag.emit(bag.SIGNAL.DELITEM, it);
        }, "r23del");
        moved++; delta += cnt;
      } else left++;
    })(keys[i]);
    T("已搬入仓库 " + moved + " 种" + (left ? (", 留背包 " + left + " 种") : "") + ", 共 " + delta + " 件");
    if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
  }

  function clearBag() {
    var c = containers();
    if (!c) { T("容器未就绪 (请先进入游戏)"); return; }
    var ids = [], all = ok(function () { return c.bag.getAllItemNotCheck(); }) || {};
    for (var k in all) ids.push(k);
    for (var i = 0; i < ids.length; i++) ok(function () { c.bag.delItem(ids[i], 999999); });
    T("背包已清空 (" + ids.length + " 种)");
    if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
  }
  function grantAllItems(count) {
    allProfiles("item", function (cur) {
      if (!cur) { T("物品表未就绪"); return; }
      var ids = [];
      for (var k in cur) {
        var p = cur[k];
        if (p && p.type == 18) continue; /* R6: 宠物道具不补发到仓库 */
        ids.push(String(k));
      }
      giveItems(ids, count, "warehouse");
    });
  }
  M.bagToWarehouse = bagToWarehouse; M.clearBag = clearBag;

  /* ================= R23: 仅仓库内堆叠 (装备/火把/钓竿/药剂/信件) =================
     R7 旧实现把 5 类物品原型直接改成"可堆叠 + 共享键", 背包/装备/采矿等场景也走数量
     语义, 于是装备武器/采矿使用工具时把堆叠实例当单件 -> 报错。
     R23 改为: 只有"仓库里的包条目"带数量语义, 其余场景 100% 与游戏原版一致。
       - 物品实例带 __hyWh 标记时才走数量语义 (共享键/getCount=数量/可堆叠...);
         没有标记时原型方法一律回落原版实现 (装备 copy() 返回自身等原版特性保持不变);
       - 仓库容器 (mKey=core.warehouse/base.warehouse) 的 addItem/addItems/delItem/
         delItems/moveTo/load 由 MOD 接管: 入仓按 stackKey 合并成一条 count=N 的"包",
         出仓(移动/装备/使用)自动拆成原版单件 (新唯一 id, 清洁标记);
       - 背包加保护: 任何"包"进入背包都会被拆成原版单件;
       - 存档: 包条目 save 多写一个 count, load 时恢复 (兼容 R7 版旧存档);
       - 启动清尾: 背包里遗留的旧"包"拆散, 放不下的件退回仓库。 */
  var HYWH = { cls: false, cont: false };
  var WH_KEYS = { "core.warehouse": 1, "base.warehouse": 1 };
  var BAG_KEYS = { "core.bag": 1, "base.bag.itemInfo": 1 };
  function isWhC(c) { return !!(c && WH_KEYS[c.mKey]); }
  function isBagC(c) { return !!(c && BAG_KEYS[c.mKey]); }
  function stackKey(it) {
    var HI = R("HYItem"), base = String(it.mItemId);
    try {
      if (HI && HI.potion && it instanceof HI.potion) {
        return base + "@" + [it.mQuality, it.mAppearance, it.mDuration, it.mEffect, it.mAlchemyLv].join(",");
      }
      if (HI && HI.pole && it instanceof HI.pole) return base + "@" + (parseInt(it.mDuration, 10) || 0);
      if (HI && (it instanceof HI.equipment || it instanceof HI.firebrand)) {
        var aff = "";
        try {
          var ks = [];
          for (var a in (it.mAffix || {})) if (it.mAffix[a] != null) ks.push(a + ":" + it.mAffix[a]);
          ks.sort();
          aff = ks.join(",");
        } catch (e) {}
        return base + "@" + (parseInt(it.mDuration, 10) || 0) + "#" + aff;
      }
    } catch (e) {}
    return base;
  }
  function packable(it) {
    var HI = R("HYItem");
    if (!HI || !it) return false;
    try {
      if (HI.equipment && it instanceof HI.equipment) return true;
      if (HI.firebrand && it instanceof HI.firebrand) return true;
      if (HI.pole && it instanceof HI.pole) return true;
      if (HI.potion && it instanceof HI.potion) return true;
      if (HI.letter && it instanceof HI.letter) return true;
    } catch (e) {}
    return false;
  }
  function packCnt(it) { if (!it) return 0; var c = it.mHyCnt; return c == null ? 1 : (parseInt(c, 10) || 0); }
  function copyAffixTo(dst, src) { try { for (var k in (src || {})) dst[k] = src[k]; } catch (e) {} }
  function fEquip(c, s) { c.mDuration = s.mDuration; c.mAffix = {}; copyAffixTo(c.mAffix, s.mAffix); }
  function fTorch(c, s) { fEquip(c, s); c.mUseTime = s.mUseTime || 0; }
  function fPole(c, s) { c.mDuration = s.mDuration; }
  function fPotion(c, s) { c.mQuality = s.mQuality; c.mAppearance = s.mAppearance; c.mDuration = s.mDuration; c.mEffect = s.mEffect; c.mAlchemyLv = s.mAlchemyLv; }
  function fLetter(c, s) { c.mObtainTime = s.mObtainTime || c.mObtainTime; }
  function copyFields(dst, src) {
    var HI = R("HYItem");
    try {
      if (HI && HI.potion && src instanceof HI.potion) { fPotion(dst, src); return; }
      if (HI && HI.pole && src instanceof HI.pole) { fPole(dst, src); return; }
      if (HI && HI.letter && src instanceof HI.letter) { fLetter(dst, src); return; }
      if (HI && HI.firebrand && src instanceof HI.firebrand) { fTorch(dst, src); return; }
      if (HI && HI.equipment && src instanceof HI.equipment) { fEquip(dst, src); return; }
    } catch (e) {}
  }
  /* 新建同类实例: pack=true -> 仓库"包"(共享键 + 数量); false -> 原版单件(唯一 id) */
  function makeItem(src, count, pack) {
    var Ctor = src.constructor, c = new Ctor(src.mItemId);
    copyFields(c, src);
    if (pack) { c.__hyWh = 1; c.mHyCnt = count; c.mId = stackKey(src); }
    else { c.__hyWh = 0; c.mHyCnt = null; c.mId = ""; }
    return c;
  }
  function makePack(src, count) { return makeItem(src, count, true); }
  function makeSingle(src) { return makeItem(src, 1, false); }
  function purify(obj, mId) { obj.__hyWh = 0; obj.mHyCnt = null; obj.mId = mId || ""; return obj; }

  /* ---- 1) 原型层: 有 __hyWh 标记才走数量语义, 否则完全回落原版 ---- */
  function gateClass(C) {
    if (!C || !C.prototype || C.prototype.__hyGate) return false;
    var P = C.prototype;
    P.__hyGate = 1;
    var oGetId = P.getId, oGetCount = P.getCount, oSetCount = P.setCount, oAdd = P.add,
        oReduce = P.reduce, oCopy = P.copy, oStack = P.isStackable, oWeight = P.getWeight,
        oSave = P.save, oLoad = P.load;
    P.getId = function () {
      if (this.__hyWh) { if (!this.mId) this.mId = stackKey(this); return this.mId; }
      return oGetId ? oGetId.call(this) : this.mItemId;
    };
    P.getCount = function () {
      if (this.__hyWh) return this.mHyCnt == null ? 1 : (parseInt(this.mHyCnt, 10) || 0);
      return oGetCount ? oGetCount.call(this) : 1;
    };
    P.setCount = function (n) {
      if (this.__hyWh) { this.mHyCnt = parseInt(n, 10) || 0; return; }
      if (oSetCount) return oSetCount.call(this, n);
    };
    P.add = function (n) {
      if (this.__hyWh) {
        this.mHyCnt = (this.mHyCnt == null ? 1 : this.mHyCnt) + (parseInt(n, 10) || 0);
        return this.mHyCnt;
      }
      if (oAdd) return oAdd.call(this, n);
    };
    P.reduce = function (n) {
      if (!this.__hyWh) return oReduce ? oReduce.call(this, n) : this;
      var have = this.mHyCnt == null ? 1 : this.mHyCnt;
      var take = Math.min(have, parseInt(n, 10) || 0);
      this.mHyCnt = have - take;
      return makePack(this, take);
    };
    P.copy = function () {
      if (!this.__hyWh) return oCopy ? oCopy.call(this) : this;
      return makePack(this, this.mHyCnt == null ? 1 : this.mHyCnt);
    };
    P.isStackable = function () {
      if (this.__hyWh) return true;
      return oStack ? !!oStack.call(this) : false;
    };
    /* 包的重量按"单件"计 (装备校验/背包容量判断都按一件算), 总负重仍由容器 getCurLoad 按数量统计 */
    P.getWeight = function () {
      if (this.__hyWh) return this.getBaseWeight();
      return oWeight ? oWeight.call(this) : (this.getBaseWeight() * this.getCount());
    };
    P.save = function () {
      var o = null;
      try { o = oSave ? oSave.call(this) : null; } catch (e) { o = null; }
      if (this.__hyWh) {
        if (!o) o = { baseId: this.mItemId, id: this.mId || stackKey(this) };
        o.count = this.mHyCnt == null ? 1 : this.mHyCnt;
      }
      return o;
    };
    P.load = function (e) {
      if (oLoad) oLoad.call(this, e);
      if (e && e.count != null) {
        this.__hyWh = 1;
        this.mHyCnt = parseInt(e.count, 10) || 0;
        if (!this.mId && e.id) this.mId = e.id;
      }
    };
    return true;
  }
  function installItemGates() {
    var HI = R("HYItem");
    if (!HI || !HI.create) return false;
    if (!HI.letter) {
      /* exports 里没有 letter 类: 用类型 8 的实例反推构造器 */
      try {
        var tbl = null; ok(function () { tbl = R("HYProfile").mProfiles && R("HYProfile").mProfiles.item; });
        var lid = null;
        if (tbl) for (var k8 in tbl) { if (tbl[k8] && tbl[k8].type == 8) { lid = k8; break; } }
        if (lid) {
          var li = HI.create(String(lid), 1);
          if (li instanceof Array) li = li[0];
          var C = li && li.constructor;
          if (C && C !== Object && C.prototype) { HI.letter = C; log("R23 letter 类已从实例反推 (" + lid + ")"); }
        }
      } catch (e) { log("R23 letter 类探测失败: " + e); }
    }
    var n = 0;
    if (gateClass(HI.equipment)) n++;
    if (gateClass(HI.firebrand)) n++;
    if (gateClass(HI.pole)) n++;
    if (gateClass(HI.potion)) n++;
    if (gateClass(HI.letter)) n++;
    if (n && !HYWH.cls) { HYWH.cls = true; log("R23 原型分流补丁已安装 (" + n + " 类: 仅仓库包走数量语义)"); }
    return n > 0;
  }

  /* ---- 2) 容器层: 仓库合并/拆件, 背包拒绝存放"包" ---- */
  var WH_ORIG = null;
  function whAddItem(wh, t) {
    if (!t) return null;
    if (!packable(t)) return WH_ORIG.addItem.call(wh, t);
    if (t.__hyWh && wh.mItems[t.getId()] === t) return null;   /* 已经在仓库里 */
    var total = packCnt(t);
    if (total <= 0) return null;
    var key = stackKey(t);
    /* 负重上限: 与原版 l.addItem 一致 (放不下原样退回) */
    var bw = t.getBaseWeight() || 0;
    var cur = parseInt(wh.getCurLoad(), 10) || 0, max = parseInt(wh.getMaxLoad(), 10) || 0;
    var fit = total;
    if (bw && max > 0) {
      if (cur >= max) return t;
      fit = Math.min(total, Math.floor((max - cur) / bw));
    }
    if (fit <= 0) return t;
    var exist = wh.mItems[key];
    if (exist && exist !== t) {
      exist.__hyWh = 1;
      exist.mHyCnt = packCnt(exist) + fit;
      exist.mId = key;
      try { wh._saveData(key, exist.save()); } catch (e) {}
      try { wh.emit(wh.SIGNAL.ADDITEM, exist); } catch (e) {}
    } else {
      /* 就地转成"包" (保留对象身份, 装备面板等调用方继续持有该引用) */
      t.__hyWh = 1;
      t.mHyCnt = fit;
      t.mId = key;
      wh.mItems[key] = t;
      try { wh._onAddItem(key, t.getItemId()); } catch (e) {}
      try { wh._saveData(key, t.save()); } catch (e) {}
      try { wh.emit(wh.SIGNAL.ADDITEM, t); } catch (e) {}
    }
    if (fit < total) return makePack(t, total - fit);   /* 剩余 (调用方可回置) */
    return null;
  }
  function whAddItems(wh, map) {
    if (!map) return;
    if (wh.mDepentContainer) { try { wh.mDepentContainer.addItems(map); } catch (e) {} }
    var HI = R("HYItem"), GB = R("HYGlobalBag"), out = {};
    for (var i in map) {
      var a = map[i];
      if (!a) continue;
      try {
        if (HI && HI.isToken && HI.isToken(a) && a.getLock && !a.getLock()) {
          a.setLock(!0);
          GB && GB.changeItemNum(a.getItemId(), a.getCount());
        }
      } catch (e) {}
      if (!packable(a)) {
        /* 原版语义 (按 map 键合并数量) */
        try {
          if (wh.mItems[i]) {
            wh.mItems[i].add(a.getCount());
            wh._saveData(i, wh.mItems[i].save());
            out[i] = wh.mItems[i];
          } else {
            wh.mItems[i] = a.copy();
            wh._saveData(i, a.save());
            wh._onAddItem(a.getId(), a.getItemId());
            out[i] = a;
          }
        } catch (e) { log("r23add " + i + ": " + e); }
        continue;
      }
      var key = stackKey(a), total = packCnt(a);
      if (total <= 0) continue;
      var exist = wh.mItems[key];
      if (exist) {
        exist.__hyWh = 1;
        exist.mHyCnt = packCnt(exist) + total;
        exist.mId = key;
        try { wh._saveData(key, exist.save()); } catch (e) {}
        out[key] = exist;
      } else {
        a.__hyWh = 1; a.mHyCnt = total; a.mId = key;
        wh.mItems[key] = a;
        try { wh._onAddItem(key, a.getItemId()); } catch (e) {}
        try { wh._saveData(key, a.save()); } catch (e) {}
        out[key] = a;
      }
    }
    try { if (Object.keys(out).length) wh.emit(wh.SIGNAL.ADDITEMS, out); } catch (e) {}
  }
  function whDrop(wh, key, it, have, taken, silent) {
    delete wh.mItems[key];
    try { wh._saveData(key); } catch (e) {}
    try { wh._onDelItem(key, it.getItemId()); } catch (e) {}
    if (!silent) {
      try { wh.emit(wh.SIGNAL.DELITEM, taken || makePack(it, have || packCnt(it))); } catch (e) {}
    }
  }
  function whTake(wh, key, n) {
    var it = wh.mItems[key];
    if (!it || !it.__hyWh) return 0;
    var have = packCnt(it), take = Math.min(have, parseInt(n, 10) || 0);
    if (take <= 0) return 0;
    var taken = makePack(it, take);
    if (take >= have) whDrop(wh, key, it, have, taken, false);
    else {
      it.mHyCnt = have - take;
      try { wh._saveData(key, it.save()); } catch (e) {}
      try { wh.emit(wh.SIGNAL.DELITEM, taken); } catch (e) {}
    }
    return take;
  }
  function whDelItem(wh, args) {
    if (wh.mDepentContainer) { try { wh.mDepentContainer.delItem.apply(wh.mDepentContainer, args); } catch (e) {} }
    if (args.length === 1) {
      var i = args[0];
      if (!i) return 0;
      var key = null;
      try { key = i.getId(); } catch (e) { key = null; }
      var stored = key != null ? wh.mItems[key] : null;
      if (stored && stored.__hyWh) {
        var have = packCnt(stored);
        if (stored === i) return have <= 1 ? (whDrop(wh, key, stored, have, makePack(stored, 1), false), have) : whTake(wh, key, 1);
        return whTake(wh, key, Math.max(1, packCnt(i)));
      }
      return WH_ORIG.delItem.apply(wh, args);
    }
    if (args.length === 2) {
      var k = args[0], n = parseInt(args[1], 10) || 0;
      if (n <= 0) return 0;
      var it = wh.mItems[k];
      if (it && it.__hyWh) return whTake(wh, k, n);
      return WH_ORIG.delItem.apply(wh, args);
    }
    return WH_ORIG.delItem.apply(wh, args);
  }
  function whDelItems(wh, map) {
    if (wh.mDepentContainer) { try { wh.mDepentContainer.delItems(map); } catch (e) {} }
    var out = {}, any = false;
    for (var n in (map || {})) {
      var i = map[n];
      if (!i) continue;
      var key = n, stored = wh.mItems[n] || null;
      if (!stored) { try { key = i.getId(); stored = wh.mItems[key] || null; } catch (e) { stored = null; } }
      if (!stored) continue;
      if (stored.__hyWh) {
        var have = packCnt(stored);
        var want = Math.min(have, (stored === i) ? have : Math.max(1, packCnt(i)));
        if (want <= 0) continue;
        var taken = makePack(stored, want);
        if (want >= have) whDrop(wh, key, stored, have, taken, true);
        else { stored.mHyCnt = have - want; try { wh._saveData(key, stored.save()); } catch (e) {} }
        out[taken.getId()] = taken; any = true;
      } else {
        try {
          if (stored === i) {
            delete wh.mItems[key]; wh._saveData(key); wh._onDelItem(i.getId(), i.getItemId()); out[i.getId()] = i; any = true;
          } else {
            var a = stored.reduce(i.getCount());
            if (!stored.getCount()) { delete wh.mItems[i.getId()]; wh._onDelItem(i.getId(), key); }
            wh._saveData(key, stored.save()); out[a.getId()] = a; any = true;
          }
        } catch (e) {}
      }
    }
    if (any) { try { wh.emit(wh.SIGNAL.DELITEMS, out); } catch (e) {} }
  }
  function whMoveTo(wh, dst, map) {
    if (wh.mDepentContainer === dst) return {};
    if (!map) map = wh.mItems;
    var left = {};
    for (var i in (map || {})) {
      var o = map[i];
      if (!o) continue;
      var key = null;
      try { key = o.getId(); } catch (e) { key = null; }
      var stored = key != null ? (wh.mItems[key] || null) : null;
      var real = (stored && stored.__hyWh) ? stored : (o.__hyWh && stored === o ? o : null);
      if (!real) {
        /* 原版路径 */
        if (WH_ORIG.delItem.call(wh, o)) {
          var a = dst.addItem(o);
          if (a) { left[a.getId()] = a; WH_ORIG.addItem.call(wh, a); }
        }
        continue;
      }
      /* 出仓: 拆成原版单件 */
      var avail = packCnt(real);
      var want = (o === real) ? 1 : Math.max(1, packCnt(o));
      if (want > avail) want = avail;
      var movedN = 0, firstSingle = null;
      for (var j = 0; j < want; j++) {
        var single = makeSingle(real);
        var res = null;
        try { res = dst.addItem(single); } catch (e) { res = single; }
        if (res) break;   /* 目标容器放不下, 剩下的保留在仓库 */
        movedN++;
        if (j === 0) firstSingle = single;
      }
      if (movedN <= 0) { left[real.getId()] = real; continue; }
      var taken = makePack(real, movedN);
      var remain = avail - movedN;
      if (remain > 0) {
        var rep = makePack(real, remain);
        wh.mItems[key] = rep;
        try { wh._saveData(key, rep.save()); } catch (e) {}
        try { wh.emit(wh.SIGNAL.DELITEM, taken); } catch (e) {}
        if (o === real) purify(o, firstSingle ? firstSingle.getId() : "");   /* 调用方引用 = 搬出去的那件 */
      } else {
        whDrop(wh, key, real, avail, taken, true);
        try { wh.emit(wh.SIGNAL.DELITEM, taken); } catch (e) {}
        if (o === real) purify(o, firstSingle ? firstSingle.getId() : "");
      }
      if (movedN < want) left[key] = wh.mItems[key] || real;
    }
    return left;
  }
  /* 背包保护: "包"进入背包一律拆成原版单件 */
  function bagFlatten(bag, bundle) {
    var cnt = packCnt(bundle);
    if (cnt <= 0) return null;
    var added = 0;
    for (var i = 0; i < cnt; i++) {
      var single = makeSingle(bundle);
      var res = null;
      try { res = WH_ORIG.addItem.call(bag, single); } catch (e) { res = single; }
      if (res) return makePack(bundle, cnt - added);   /* 放不下的部分返回, 调用方可回置 */
      added++;
    }
    return null;
  }
  function bagAddItems(bag, map) {
    var rest = {}, any = false;
    for (var i in (map || {})) {
      var it = map[i];
      if (!it) continue;
      if (it.__hyWh) {
        var r = bagFlatten(bag, it);
        if (r) { rest[r.getId()] = r; any = true; }
      } else {
        var one = {}; one[i] = it;
        try { WH_ORIG.addItems.call(bag, one); } catch (e) {}
      }
    }
    return any ? rest : undefined;
  }
  /* 仓库已有条目合并 (兼容旧存档: 老版每件一条 / R7 版 count 条目) */
  function mergeWhBundles(wh) {
    var groups = {}, keys = [];
    for (var k in wh.mItems) { if (wh.mItems[k] && packable(wh.mItems[k])) keys.push(k); }
    if (!keys.length) return 0;
    for (var i = 0; i < keys.length; i++) {
      var it = wh.mItems[keys[i]];
      if (!it) continue;
      var sig = stackKey(it);
      (groups[sig] || (groups[sig] = [])).push(keys[i]);
    }
    var merged = 0;
    for (var sig2 in groups) {
      var ks = groups[sig2], total = 0, first = null, itemId = null;
      for (var j = 0; j < ks.length; j++) {
        var o = wh.mItems[ks[j]];
        if (!o) continue;
        total += packCnt(o);
        if (!first) { first = o; itemId = o.getItemId(); }
      }
      if (!first || total <= 0) continue;
      var keepKey = null;
      for (var j2 = 0; j2 < ks.length; j2++) if (ks[j2] === sig2) { keepKey = sig2; break; }
      if (keepKey == null) keepKey = ks[0];
      for (var j3 = 0; j3 < ks.length; j3++) {
        var kk = ks[j3];
        if (kk === keepKey) continue;
        var other = wh.mItems[kk];
        if (!other) continue;
        delete wh.mItems[kk];
        try { wh._saveData(kk); } catch (e) {}
        try { wh._onDelItem(kk, other.getItemId()); } catch (e) {}
      }
      var keep = wh.mItems[keepKey];
      keep.__hyWh = 1; keep.mHyCnt = total; keep.mId = sig2;
      if (keepKey !== sig2) {
        delete wh.mItems[keepKey];
        wh.mItems[sig2] = keep;
        try { wh._saveData(keepKey); } catch (e) {}
        keepKey = sig2;
      }
      try { wh._saveData(keepKey, keep.save()); } catch (e) {}
      if (ks.length > 1) merged += ks.length - 1;
    }
    /* 重建 mItemID2Id 索引 */
    var idx = {};
    for (var k4 in wh.mItems) {
      var o4 = wh.mItems[k4];
      if (!o4 || !o4.getItemId) continue;
      var g4 = idx[o4.getItemId()] || (idx[o4.getItemId()] = []);
      g4.push(k4);
    }
    wh.mItemID2Id = idx;
    return merged;
  }
  /* 背包里的旧"包"拆散 (R7 版存档遗留); 放不下的退回仓库 */
  function fixBagBundles(bag) {
    var keys = [];
    for (var k in bag.mItems) if (bag.mItems[k] && bag.mItems[k].__hyWh) keys.push(k);
    if (!keys.length) return 0;
    var fixed = 0, toWh = 0;
    for (var i = 0; i < keys.length; i++) {
      var kk = keys[i], it = bag.mItems[kk];
      if (!it) continue;
      var n = packCnt(it);
      delete bag.mItems[kk];
      try { bag._saveData(kk); } catch (e) {}
      try { bag._onDelItem(kk, it.getItemId()); } catch (e) {}
      try { bag.emit(bag.SIGNAL.DELITEM, it); } catch (e) {}
      var rest = 0;
      for (var j = 0; j < n; j++) {
        var single = makeSingle(it);
        var res = null;
        try { res = WH_ORIG.addItem.call(bag, single); } catch (e) { res = single; }
        if (res) rest++;
      }
      if (rest > 0) {
        var HC = R("HYContainer"), wh = HC && HC.HYWarehouse;
        if (wh) { try { whAddItem(wh, makePack(it, rest)); } catch (e) { log("R23 退回仓库失败: " + e); } }
        toWh += rest;
      }
      fixed++;
    }
    var idx = {};
    for (var k2 in bag.mItems) {
      var o2 = bag.mItems[k2];
      if (!o2 || !o2.getItemId) continue;
      var g2 = idx[o2.getItemId()] || (idx[o2.getItemId()] = []);
      g2.push(k2);
    }
    bag.mItemID2Id = idx;
    log("R23 背包拆包: " + fixed + " 条, 退回仓库 " + toWh + " 件");
    return fixed;
  }
  function installContainerPatch() {
    var HC = R("HYContainer");
    if (!HC || !HC.CommonContainer || !HC.HYBag) return false;
    if (HYWH.cont) return true;
    var S = HC.CommonContainer.prototype;                 /* CommonContainer */
    var bagProto = Object.getPrototypeOf(HC.HYBag);       /* d.prototype */
    var L = bagProto && Object.getPrototypeOf(bagProto);  /* l.prototype (重量容器) */
    if (!S || !L || S === L) { log("R23 容器原型获取失败"); return false; }
    if (!L.addItem || !S.addItems || !S.delItem || !S.moveTo || !L.load) return false;
    WH_ORIG = { addItem: L.addItem, addItems: S.addItems, delItem: S.delItem, delItems: S.delItems, moveTo: S.moveTo, load: L.load };
    L.addItem = function (t) {
      if (isWhC(this)) return whAddItem(this, t);
      if (isBagC(this) && t && t.__hyWh) return bagFlatten(this, t);
      return WH_ORIG.addItem.call(this, t);
    };
    S.addItems = function (map) {
      if (isWhC(this)) return whAddItems(this, map);
      if (isBagC(this)) return bagAddItems(this, map);
      return WH_ORIG.addItems.call(this, map);
    };
    S.delItem = function () {
      if (isWhC(this)) return whDelItem(this, arguments);
      return WH_ORIG.delItem.apply(this, arguments);
    };
    S.delItems = function (map) {
      if (isWhC(this)) return whDelItems(this, map);
      return WH_ORIG.delItems.call(this, map);
    };
    S.moveTo = function (dst, map) {
      if (isWhC(this)) return whMoveTo(this, dst, map);
      return WH_ORIG.moveTo.apply(this, arguments);
    };
    L.load = function () {
      var r = WH_ORIG.load.apply(this, arguments);
      if (isWhC(this)) { try { mergeWhBundles(this); } catch (e) { log("R23 仓库合并失败: " + e); } }
      return r;
    };
    HYWH.cont = true;
    log("R23 容器补丁已安装 (仓库合并/拆件 + 背包保护)");
    return true;
  }
  function installStackPatch() {
    var HI = R("HYItem"), HP = R("HYProfile"), HC = R("HYContainer");
    if (!HI || !HP || !HI.create) return;
    if (!HYWH.cls) {
      var tbl = null;
      ok(function () { tbl = HP.mProfiles && HP.mProfiles.item; });
      if (!tbl || !instReady(HI, tbl)) return;   /* 建表完成前 create 会抛错/给空, 下一次 interval 重试 */
      installItemGates();
      installContainerPatch();
    } else {
      installContainerPatch();
    }
    var wh = HC && HC.HYWarehouse;
    if (wh && !wh.__hyMerged) { wh.__hyMerged = 1; ok(function () { mergeWhBundles(wh); }, "r23merge"); }
    var bag = HC && HC.HYBag;
    if (bag && !bag.__hyFixed) { bag.__hyFixed = 1; ok(function () { fixBagBundles(bag); }, "r23fix"); }
  }
  function instReady(HI, tbl) {
    var ids3 = [], poleId = null, potionId = null, letterId = null, normalId = null;
    for (var k in tbl) {
      var p = tbl[k];
      if (!p) continue;
      if (p.type == 3) { if (ids3.length < 60) ids3.push(k); }
      else if (p.type == 11 && !poleId) poleId = k;
      else if (p.type == 14 && !potionId) potionId = k;
      else if (p.type == 8 && !letterId) letterId = k;
      else if (!normalId && [0, 1, 2, 4, 6, 7, 9, 10, 13, 15, 16].indexOf(p.type) >= 0) normalId = k;
    }
    function inst(id) {
      if (!id) return null;
      var r = null;
      try { r = HI.create(String(id), 1); } catch (e) { r = null; }
      if (r instanceof Array) r = r[0];
      return r || null;
    }
    if (!inst(normalId)) return false;
    if (ids3.length && !inst(ids3[0])) return false;
    if (poleId && !inst(poleId)) return false;
    if (potionId && !inst(potionId)) return false;
    if (letterId && !inst(letterId)) return false;
    return true;
  }
  M.installStackPatch = installStackPatch;
  M.HYWH = HYWH;
  M.r23dbg = function () {
    var HI = R("HYItem"), HP = R("HYProfile"), HC = R("HYContainer");
    var tbl = null; ok(function () { tbl = HP.mProfiles && HP.mProfiles.item; });
    var ready = null;
    try { ready = instReady(HI, tbl); } catch (e) { ready = "ERR " + e.message; }
    var cnt = 0; if (tbl) for (var k in tbl) cnt++;
    var g = [];
    var cs = [HI.equipment, HI.firebrand, HI.pole, HI.potion, HI.letter];
    for (var i = 0; i < cs.length; i++) g.push(cs[i] ? (cs[i].prototype.__hyGate ? 1 : 0) : "x");
    return "cls=" + HYWH.cls + " cont=" + HYWH.cont + " tbl=" + cnt + " ready=" + ready +
      " gates=" + g.join(",") + " orig=" + (WH_ORIG ? 1 : 0) + " bag=" + !!(HC && HC.HYBag) + " wh=" + !!(HC && HC.HYWarehouse);
  };
  /* 把仓库里已有的同名条目合并为一格 (兼容旧存档), 顺带拆散背包里的旧"包" */
  function compactStacks() {
    var c = containers();
    if (!c) { T("容器未就绪 (请先进入游戏)"); return; }
    var n = 0, f = 0;
    ok(function () { n = mergeWhBundles(c.wh); }, "r23compact");
    ok(function () { f = fixBagBundles(c.bag); }, "r23fix2");
    T((n || f) ? ("堆叠整理完成: 仓库合并 " + n + " 组, 背包拆散 " + f + " 条") : "没有可整理的堆叠");
    if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
  }
  M.compactStacks = compactStacks;

  /* ================= 科技 =================
     R11: 按面板四大类(工具20100/医药20400/厨房20300/负重10000)分别解锁
     R12: 写入 base.technology.product.<pid>.<tid>=最高级 — 游戏 techItem/techFight
          都是实时读存档, 写入即真实生效; 负重类额外刷新背包/仓库容量缓存
     R13: 解锁后调用 PanelTechnology._layProduct 刷新进度条 (r/总数) 同步 */
  function findComponentByClass(name) {
    var out = null;
    ok(function () {
      var sc = cc.director.getScene();
      if (!sc) return;
      var st = [sc], n = 0;
      while (st.length && n < 4000) {
        var nd = st.pop(); n++;
        var cs = nd._components || [];
        for (var i = 0; i < cs.length; i++) {
          var c = cs[i];
          var cn = null;
          try { cn = cc.js && cc.js.getClassName ? cc.js.getClassName(c) : c.__classname__; } catch (e) { cn = c.__classname__; }
          if (cn === name) { out = c; return; }
        }
        var ch = nd._children || [];
        for (var j = 0; j < ch.length; j++) st.push(ch[j]);
      }
    }, "findCmp");
    return out;
  }
  M.findComponentByClass = findComponentByClass;

  function refreshLoadMax() {
    ok(function () {
      var HC = R("HYContainer"), HP = R("HYPlayer"), HB = R("HYBuild");
      if (HC && HC.HYBag && HP && HP.getMaxLoad) HP.getMaxLoad(null, function (v) { ok(function () { HC.HYBag.setMaxLoad(v); }); });
      if (HC && HC.HYWarehouse && HB && HB.getWareHouseMaxLoad) HB.getWareHouseMaxLoad(function (v) { ok(function () { HC.HYWarehouse.setMaxLoad(v); }); });
      log("背包/仓库负重上限已按新科技刷新");
    }, "refreshLoad");
  }
  /* R13: 面板自带的 r/总数 分母是含等级变体的行数(永远到不了), 改为行级进度:
     分子 = 已满足的科技行数(存档等级 >= 该行等级), 分母 = 该 tag 全部行数 */
  function techRowStat(tag, pids, cur) {
    var sat = 0, tot = 0;
    var save = ok(function () { return R("HYData").get("base.technology.product") || {}; }) || {};
    for (var i = 0; i < pids.length; i++) {
      var pid = String(pids[i]);
      var lv = save[pid] || {};
      for (var k in cur) {
        var p = cur[k];
        if (!p || String(p.productId) !== pid) continue;
        var parts = String(p.id || k).split("_");
        var tid = parts[0], need = parseInt(parts[1] || "1", 10) || 1;
        tot++;
        if ((parseInt(lv[tid], 10) || 0) >= need) sat++;
      }
    }
    return [sat, tot];
  }
  function refreshTechLabel(p) {
    ok(function () {
      if (!p || !p.labTag || !p.mCurTag) return;
      var cur = profiles("technology");
      if (!cur) return;
      var HT = R("HYTechnology");
      if (!HT || !HT.getTechByTag) return;
      HT.getTechByTag(p.mCurTag, function (pids) {
        var st = techRowStat(p.mCurTag, pids || [], cur);
        p.__hmStatCache = st;
        try { p.labTag.string = st[0] + "/" + st[1]; } catch (e) {}
      }, 1);
    }, "techLabel");
  }
  function techLabelHook(self) {
    ok(function () {
      var lab = self && self.labTag;
      if (!lab || lab.__hmLabHooked) return;
      var desc = null;
      for (var o = lab; o && !desc; o = Object.getPrototypeOf(o)) {
        var d = Object.getOwnPropertyDescriptor(o, "string");
        if (d && d.set) desc = d;
      }
      if (!desc || !desc.set) return;
      var protoSet = desc.set;
      var stored = lab.string;
      Object.defineProperty(lab, "string", {
        configurable: true,
        get: function () { return stored; },
        set: function (v) {
          var s = String(v == null ? "" : v);
          var c = self.__hmStatCache;
          if (c && /^\d+\s*\/\s*\d+$/.test(s)) s = c[0] + "/" + c[1];
          stored = s;
          return protoSet.call(this, s);
        }
      });
      lab.__hmLabHooked = 1;
      log("科技进度标签写入已拦截");
    }, "techLabHook");
  }
  var techPanelHooked = false;
  function installTechPanelHook() {
    if (techPanelHooked) return;
    ok(function () {
      var cls = cc.js && cc.js.getClassByName && cc.js.getClassByName("PanelTechnology");
      if (!cls || !cls.prototype || !cls.prototype._layProduct) return;
      var raw = cls.prototype._layProduct;
      cls.prototype._layProduct = function (t) {
        var res = raw.apply(this, arguments);
        var self = this;
        techLabelHook(self);
        setTimeout(function () { refreshTechLabel(self); }, 500);
        setTimeout(function () { refreshTechLabel(self); }, 1800);
        return res;
      };
      techPanelHooked = true;
      log("PanelTechnology 进度栏已挂钩 (行级进度显示)");
    }, "techPanelHook");
  }
  M.installTechPanelHook = installTechPanelHook;

  function refreshTechPanel() {
    var p = findComponentByClass("PanelTechnology");
    if (!p) return false;
    var idx = { "20100": 0, "20400": 1, "20300": 2, "10000": 3 }[p.mCurTag];
    if (idx === undefined) idx = 0;
    ok(function () { if (p._layProduct) p._layProduct({ currIndex: idx }); }, "layProduct");
    setTimeout(function () { refreshTechLabel(p); }, 600);
    log("科技面板已刷新");
    return true;
  }
  M.refreshLoadMax = refreshLoadMax; M.refreshTechPanel = refreshTechPanel;

  function techMaxByTag(tag, label, done) {
    var HT = R("HYTechnology");
    if (!HT || !HT.getTechByTag) { T("科技模块未就绪"); done && done(0); return; }
    allProfiles("technology", function (cur) {
      if (!cur) { T("科技表未就绪"); done && done(0); return; }
      HT.getTechByTag(tag, function (pids, total) {
        var n = 0;
        for (var i = 0; i < (pids || []).length; i++) {
          (function (pid) {
            pid = String(pid);
            var best = {}, k;
            for (k in cur) {
              var p = cur[k] || {};
              if (String(p.productId) !== pid) continue;
              var parts = String(p.id || k).split("_");
              var tid = parts[0], lv = parseInt(parts[1] || "1", 10) || 1;
              if (!best[tid] || lv > best[tid]) best[tid] = lv;
            }
            for (var tid2 in best) {
              (function (t2) {
                ok(function () { HT.setTechnology(pid, t2 + "_" + best[t2]); n++; });
              })(tid2);
            }
          })(pids[i]);
        }
        if (label) T(label + " 已解锁 " + n + " 条 (面板上限 " + total + ")");
        if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
        done && done(n);
      }, 1);
    });
  }
  function techMaxAll() {
    var tags = [["20100", "工具科技"], ["20400", "医药科技"], ["20300", "厨房科技"], ["10000", "负重科技"]];
    var left = tags.length, sum = 0;
    for (var i = 0; i < tags.length; i++) {
      (function (tg) {
        techMaxByTag(tg[0], null, function (n) {
          sum += n; left--;
          if (left === 0) {
            T("四类科技已全部拉满 (" + sum + " 条)");
            refreshLoadMax(); refreshTechPanel();
          }
        });
      })(tags[i]);
    }
  }
  function techUnlockTag(tag, label) {
    techMaxByTag(tag, label, function () {
      refreshLoadMax();
      if (!refreshTechPanel()) log("科技面板未打开, 进度将在下次打开时重算");
    });
  }
  M.techMaxByTag = techMaxByTag; M.techUnlockTag = techUnlockTag;

  /* ================= 建筑 ================= */
  function buildComIds(cb) {
    var coms = {}, k;
    var builds = ok(function () { return R("HYData").get("base.builds"); }) || {};
    for (k in builds) coms[String(Math.floor(parseInt(k, 10) / 100) * 100)] = 1;
    allProfiles("build", function (cur) {
      for (k in (cur || {})) coms[String(Math.floor(parseInt(k, 10) / 100) * 100)] = 1;
      var arr = [];
      for (k in coms) if (k !== "NaN" && k !== "0") arr.push(k);
      cb(arr, cur);
    });
  }
  function buildMaxAll() {
    var HB = R("HYBuild");
    if (!HB) return;
    buildComIds(function (coms) {
      var n = 0;
      for (var i = 0; i < coms.length; i++) {
        (function (com) {
          ok(function () { HB.unlockBuild(com); });
          ok(function () {
            HB.getBuildMaxLevel(com, function (lv) {
              if (lv > 0) ok(function () { HB.updateBuildLevel(com, lv); n++; });
            });
          });
        })(coms[i]);
      }
      T("建筑解锁+满级已下发 (" + n + " 处)");
      setTimeout(function () { ok(function () { HB.restoreAllBuildDuration(); }); }, 900);
      if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
    });
  }
  function buildRepairAll() {
    var HB = R("HYBuild");
    if (!HB) return;
    ok(function () { HB.restoreAllBuildDuration(function () { T("全部建筑耐久已修复"); }); });
    if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
  }
  /* ================= R18: 建筑等级越界自愈 (迷宫出口卡关根因) =================
     根因: 建筑选择器把 "数量" 直接当等级写入 (默认 99), 而部分建筑(如 20100)
     的 build 档案只有 1..10 级 -> base.builds.20100.level = 99。
     游戏每次进入迷宫关卡都会执行 HYBuild.restoreAllBuildDuration()
     -> getBuildMaxDuration() -> HYProfile.getById("build", 20199) 回调收到 undefined
     -> 读 t.duration 抛 "Cannot read property 'duration' of undefined":
        * 迷宫出口确认回调 mgr.nextLevel() 中断 -> transitionTo 不执行 -> 卡在当关;
        * 回主界面点继续挑战 -> mgr.init() 同样抛错 -> mIsClickContinue 卡 true -> 无反应。
     修复: 1) 启动自愈: 越界等级钳到该建筑档案最大等级(落盘);
           2) 包装 restoreAllBuildDuration, 异常时自愈并重试 (兜底);
           3) 建筑选择器写入前钳位 (防止再写坏)。 */
  function buildProfileMaxMap(cb) {
    var HP = R("HYProfile");
    if (!HP || !HP.getAll) { cb && cb({}); return; }
    HP.getAll("build", function (all) {
      var maxOf = {};
      for (var id in (all || {})) {
        var n = parseInt(id, 10);
        if (!(n > 0)) continue;
        var com = 100 * Math.floor(n / 100), lv = n % 100;
        if (!maxOf[com] || lv > maxOf[com]) maxOf[com] = lv;
      }
      cb && cb(maxOf);
    }, 0, 1);
  }
  function fixBuildLevels(cb) {
    var HB = R("HYBuild"), HD = R("HYData");
    if (!HB || !HD) { cb && cb([]); return; }
    buildProfileMaxMap(function (maxOf) {
      var builds = {};
      ok(function () { builds = HD.get("base.builds") || {}; });
      var fixed = [];
      for (var k in builds) {
        var com = 100 * Math.floor(parseInt(k, 10) / 100);
        var lv = parseInt((builds[k] || {}).level, 10) || 0;
        var mx = maxOf[com] || 0;
        if (lv > 0 && mx > 0 && lv > mx) {
          ok(function () {
            HD.set("base.builds." + k + ".level", mx);
            ok(function () { HB.restoreBuildDuration(k); });
            fixed.push(k + " " + lv + "->" + mx);
          }, "buildFix");
        }
      }
      if (fixed.length) {
        log("R18 建筑等级越界自愈: " + fixed.join(", "));
        T("建筑等级越界已修复: " + fixed.join(", "));
        ok(function () { HD.trySave(); });
      }
      cb && cb(fixed);
    });
  }
  M.fixBuildLevels = fixBuildLevels;

  function installBuildPatch() {
    var HB = R("HYBuild");
    if (!HB || HB.__hymodBuildPatch) return;
    HB.__hymodBuildPatch = 1;
    if (HB.getBuildMaxDuration) {
      var rawGBM = HB.getBuildMaxDuration;
      if (!HB.__hymodGBM) {
        HB.__hymodGBM = 1;
        HB.getBuildMaxDuration = function (build, cb) {
          var self = this;
          try { return rawGBM.call(this, build, cb); }
          catch (e) {
            log("getBuildMaxDuration 防护 (build=" + build + "): " + e);
            fixBuildLevels(function () {
              try { rawGBM.call(self, build, cb); }
              catch (e2) { log("getBuildMaxDuration 重试失败: " + e2); cb && cb(-1); }
            });
          }
        };
        log("HYBuild.getBuildMaxDuration 已加防护");
      }
    }
    if (HB.restoreAllBuildDuration) {
      var rawRestore = HB.restoreAllBuildDuration;
      HB.restoreAllBuildDuration = function (cb) {
        var self = this;
        try { return rawRestore.call(this, cb); }
        catch (e) {
          log("restoreAllBuildDuration 异常, 自愈后重试: " + e);
          fixBuildLevels(function () {
            try { rawRestore.call(self, cb); }
            catch (e2) { log("restoreAllBuildDuration 重试仍失败(已跳过): " + e2); cb && cb(); }
          });
        }
      };
      log("HYBuild.restoreAllBuildDuration 已加防护 (R18)");
    }
    fixBuildLevels(function () {});
  }
  M.installBuildPatch = installBuildPatch;

  /* ================= R19: 容器容量修改 (背包 / 仓库) =================
     背包: 走游戏原生扩容键 base.bag.extraLoad (原生 getMaxLoad 重算即得目标值),
           写入即落盘, 重启后依然有效。
     仓库: 原生容量 = 仓库建筑 param + 月卡加成, 无扩容存档键 ->
           在 MOD 侧 hook HYBuild.getWareHouseMaxLoad 返回指定值;
           数值存于 MOD 首选项(需开启「保存功能首选项」才能跨重启保留)。
     点选数值 = 当前容器内物品总重量 (curLoad) 及其变体。 */
  function capInfo() {
    var c = containers();
    if (!c) { T("容器未就绪 (请先进入游戏)"); return; }
    T("背包 " + c.bag.getCurLoad() + "/" + c.bag.getMaxLoad()
      + "  |  仓库 " + c.wh.getCurLoad() + "/" + c.wh.getMaxLoad());
  }
  function refreshCapUI() {
    ok(function () {
      var DM = R("HYDialogMgr");
      var d = DM && DM.getDialog("PanelWareHouse");
      if (d && d.getComponent) { var c = d.getComponent(d.name || "PanelWareHouse"); c && c.updateWeight && c.updateWeight(); }
    }, "capUI");
  }
  /* ---- 背包 ---- */
  function applyBagCap(target) {
    var HP = R("HYPlayer"), HD = R("HYData"), HC = R("HYContainer");
    if (!HP || !HD || !HC || !HC.HYBag) { T("背包未就绪 (请先进入游戏)"); return; }
    var applied = 0;
    function apply(nat) {
      if (applied++) return;
      ok(function () {
        var extra = parseInt(HD.get("base.bag.extraLoad"), 10) || 0;
        HD.set("base.bag.extraLoad", extra + (target - nat));
        HC.HYBag.setMaxLoad(target);
        M.vals.cap_bag_val = String(target); saveVals();
        T("背包容量 = " + target + " (原生 " + nat + ")");
        refreshCapUI();
        if (cfg.autoSave) HD.trySave();
      }, "setBagCap");
    }
    ok(function () { HP.getMaxLoad(null, apply); }, "bagNat");
    setTimeout(function () { if (!applied) apply(HC.HYBag.getMaxLoad()); }, 400);
  }
  function restoreBagCap() {
    var HD = R("HYData"), HC = R("HYContainer"), HP = R("HYPlayer");
    if (!HD || !HC || !HC.HYBag) { T("背包未就绪"); return; }
    ok(function () { HD.set("base.bag.extraLoad", 0); });
    ok(function () {
      HP.getMaxLoad(null, function (nat) {
        ok(function () { HC.HYBag.setMaxLoad(nat); });
        T("背包容量已恢复原生: " + nat);
        refreshCapUI();
      });
    });
    if (cfg.autoSave) ok(function () { HD.trySave(); });
  }
  /* ---- 仓库 ---- */
  function installWhCapHook() {
    var HB = R("HYBuild");
    if (!HB || HB.__hymodWhCap || !HB.getWareHouseMaxLoad) return;
    HB.__hymodWhCap = 1;
    var raw = HB.getWareHouseMaxLoad;
    HB.getWareHouseMaxLoad = function (cb) {
      var want = parseInt(M.vals.wh_cap, 10) || 0;
      if (!(want > 0)) return raw.apply(this, arguments);
      return raw.call(this, function (nat) {
        log("仓库容量 hook: 原生 " + nat + " -> " + want);
        try { cb && cb(want); } catch (e) { log("whCap cb " + e); }
      });
    };
    log("HYBuild.getWareHouseMaxLoad 已挂钩 (R19 仓库容量)");
  }
  M.installWhCapHook = installWhCapHook;
  function applyWhCap(target) {
    var HC = R("HYContainer");
    M.vals.wh_cap = String(target); saveVals();
    installWhCapHook();
    if (HC && HC.HYWarehouse) { ok(function () { HC.HYWarehouse.setMaxLoad(target); }); }
    T("仓库容量 = " + target + " (MOD 侧, 重启需开启「保存功能首选项」)");
    refreshCapUI();
  }
  function restoreWhCap() {
    var HC = R("HYContainer"), HB = R("HYBuild");
    delete M.vals.wh_cap; saveVals();
    ok(function () {
      HB.getWareHouseMaxLoad(function (nat) {
        if (HC && HC.HYWarehouse) ok(function () { HC.HYWarehouse.setMaxLoad(nat); });
        T("仓库容量已恢复原生: " + nat);
        refreshCapUI();
      });
    });
  }
  /* ---- 点选数值 (含当前总重量) ---- */
  function capPickItems(wh, cb) {
    var c = containers();
    if (!c) { T("容器未就绪 (请先进入游戏)"); return; }
    var box = wh ? c.wh : c.bag;
    var cur = parseInt(ok(function () { return box.getCurLoad(); }) || 0, 10) || 0;
    var max = parseInt(ok(function () { return box.getMaxLoad(); }) || 0, 10) || 0;
    var cand = [cur, cur + 1000, cur * 2, max, 10000, 99999];
    var arr = [], seen = {};
    for (var i = 0; i < cand.length; i++) {
      if (!(cand[i] > 0)) continue;
      var v = Math.floor(cand[i]);
      if (seen[v]) continue;
      seen[v] = 1;
      var tag = (v === cur) ? "  <= 当前" + (wh ? "仓库" : "背包") + "总重量" : "";
      arr.push([String(v), (wh ? "仓库" : "背包") + "容量 " + v + tag, ""]);
    }
    cb(arr);
  }
  M.capInfo = capInfo; M.applyBagCap = applyBagCap; M.applyWhCap = applyWhCap; M.capPickItems = capPickItems;
  M.restoreBagCap = restoreBagCap; M.restoreWhCap = restoreWhCap;

  function buildPickerItems(cb) {
    buildComIds(function (coms, cur) {
      var arr = [];
      for (var i = 0; i < coms.length; i++) {
        var com = coms[i], lv = 0, nm = null;
        try { lv = R("HYData").get("base.builds." + com + ".level") || 0; } catch (e) {}
        if (cur) for (var k in cur) {
          if (Math.floor(parseInt(k, 10) / 100) * 100 == parseInt(com, 10)) { nm = nameOf("build", cur[k], k); break; }
        }
        arr.push([com, (nm || ("建筑 " + com)) + "  [当前 " + lv + " 级]", ""]);
      }
      cb(arr);
    });
  }

  /* ================= 成就 =================
     R15: 旧的 _handleSingle(1e9) 不会伪造进度(实测回调仍是真实进度), 完全无效。
     现改为直接完成: 写 base.achievement.detail.<id> = finish(与面板 _doReceive 同编码),
     补发未领阶段的金币(updateDiamondNum)/积分(_setTotalScore)/exReward, 并刷新面板。 */
  function achLastProgress(p) {
    var out = 0;
    ok(function () {
      var HPr = R("HYProfile"), HA = R("HYAchievement");
      var conds = p.cond || [];
      var cid = conds[conds.length - 1];
      var row = (HPr && HPr.getByIdDirect) ? HPr.getByIdDirect("cond", cid) : null;
      if (row && HA && HA.truncSubBrackets) out = parseInt(HA.truncSubBrackets(row), 10) || 0;
    }, "lastProg");
    return out;
  }
  function refreshAchPanel() {
    var p = findComponentByClass("PanelAchieve");
    if (!p) return false;
    ok(function () {
      var n = (p.mGroups && p.mGroups.length) || 3;
      for (var i = 0; i < n; i++) { try { p._initAchieve(i); } catch (e) {} }
      if (p._refreshTotalDots) p._refreshTotalDots();
    }, "achRefresh");
    log("成就面板已刷新");
    return true;
  }
  M.refreshAchPanel = refreshAchPanel;
  function finishAchievements(ids, cur) {
    var HA = R("HYAchievement"), HD = R("HYData"), HC = R("HYCommon"), MS = R("ModelShop");
    if (!HA || !HD || !cur) { T("成就表未就绪"); return; }
    var done = 0, coinSum = 0, ptSum = 0, exN = 0;
    for (var i = 0; i < ids.length; i++) {
      (function (id) {
        var p = cur[id];
        if (!p) return;
        var st = HA.decode(HD.get("base.achievement.detail." + id) || "0000");
        if (st.achieveState === "finish") return;
        var conds = p.cond || [];
        var last = conds.length - 1;
        if (last < 0) return;
        var idx = Math.max(0, Math.min(st.stageIndex || 0, last));
        var coins = 0, u;
        for (u = idx; u <= last; u++) coins += parseInt((p.coin || [])[u], 10) || 0;
        var from = (st.stageState === "toreceive") ? idx + 1 : idx;
        var pts = 0;
        for (u = from; u <= last; u++) pts += parseInt((p.point || [])[u], 10) || 0;
        var prog = achLastProgress(p) || st.progress || 1;
        var enc = HA.encrypt({ achieveState: "finish", stageIndex: last, stageState: "finish", progress: prog });
        HD.set("base.achievement.detail." + id, enc);
        if (pts) HA._setTotalScore(pts);
        if (p.exReward) { exN++; ok(function () { MS.ShopGetter.addGoodsToPlayer(null, 1, { successGet: [p.exReward] }, "achievement"); }); }
        done++; coinSum += coins; ptSum += pts;
      })(ids[i]);
    }
    if (!done) { T("所选成就均已完成"); return; }
    if (coinSum > 0) ok(function () { HC.updateDiamondNum(coinSum, !0, { type: "achievement", reasonId: "hycmod_ach" }, null); }, "achCoin");
    T("成就已解锁 " + done + " 个 (金币+" + coinSum + " 积分+" + ptSum + (exN ? " 额外奖励x" + exN : "") + ")");
    if (cfg.autoSave) ok(function () { HD.trySave(); });
    setTimeout(refreshAchPanel, 300);
  }
  M.finishAchievements = finishAchievements;
  function achieveAll() {
    allProfiles("achievement", function (cur) {
      if (!cur) { T("成就表未就绪"); return; }
      var ids = [];
      for (var k in cur) ids.push(String(k));
      finishAchievements(ids, cur);
    });
  }
  function HA_decode(id) {
    var HA = R("HYAchievement");
    if (!HA) return null;
    var v = R("HYData").get("base.achievement.detail." + id);
    if (!v) return null;
    var d = HA.decode(v);
    return d && d.achieveState === "finish" ? 1 : 0;
  }
  function achievePickerItems(cb) {
    allProfiles("achievement", function (cur) {
      var arr = [];
      for (var k in (cur || {})) {
        var got = 0;
        try { got = HA_decode(k); } catch (e) {}
        arr.push([String(k), nameOf("achievement", cur[k], k) + (got ? "  [已完成]" : ""), ""]);
      }
      cb(arr);
    });
  }

  /* ================= 图鉴 ================= */
  function atlasAll() {
    allProfiles("atlas", function (cur) {
      var HS = R("HYStat");
      if (!HS || !cur) { T("图鉴表未就绪"); return; }
      var groups = 0, n = 0;
      for (var g in cur) {
        groups++;
        var ids = [];
        for (var k in cur[g]) ids.push(k);
        if (ids.length) { ok(function () { HS.setAtlas(g, ids); }); n += ids.length; }
      }
      T("图鉴已解锁 " + groups + " 组 / " + n + " 项");
      if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
    });
  }

  /* ================= 宠物 ================= */
  function petAll() {
    var PM = R("PetMgr");
    if (!PM) { T("宠物模块未就绪"); return; }
    ok(function () { PM.unlockPetSystem(); });
    allProfiles("pet", function (cur) {
      if (!cur) { T("已解锁宠物系统 (无宠物表)"); return; }
      var ids = [], k;
      for (k in cur) ids.push(String(k));
      var n = 0;
      for (var i = 0; i < ids.length; i++) {
        (function (id) { ok(function () { PM.gainPet(id, function () { n++; }); }); })(ids[i]);
      }
      setTimeout(function () { T("已解锁宠物系统 + 获得 " + n + " 只宠物"); }, 900);
      if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
    });
  }

  /* ================= 角色 / 皮肤 ================= */
  function roleAll() {
    allProfiles("role", function (cur) {
      if (!cur) { T("角色表未就绪"); return; }
      var DS = R("RoleDataServer"), n = 0;
      for (var k in cur) {
        (function (id) {
          ok(function () {
            if (DS && DS.addToDisplay) DS.addToDisplay(parseInt(id, 10));
            else R("HYStat").setRoleUnlock(id);
            n++;
          });
        })(k);
      }
      T("已解锁角色 " + n + " 个");
      if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
    });
  }
  function applyRoles(ids) {
    var DS = R("RoleDataServer"), n = 0;
    for (var i = 0; i < ids.length; i++) (function (id) {
      ok(function () { if (DS && DS.addToDisplay) DS.addToDisplay(parseInt(id, 10)); n++; });
    })(ids[i]);
    T("已解锁 " + n + " 个角色");
    if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
  }
  function skinPickerItems(cb) {
    allProfiles("skin", function (cur) {
      var arr = [];
      for (var k in (cur || {})) {
        var p = cur[k];
        arr.push([String(k), nameOf("skin", p, k) + (p.role ? "  (角色 " + p.role + ")" : ""), ""]);
      }
      cb(arr);
    });
  }
  function applySkin(skinId) {
    allProfiles("skin", function (cur) {
      var p = cur && cur[skinId];
      if (!p) { T("皮肤不存在"); return; }
      var roleId = p.role;
      ok(function () { R("HYPlayer").setSkin(roleId, skinId); });
      setTimeout(function () {
        var got = ok(function () { return R("HYPlayer").getSkin(roleId); });
        if (got != skinId) {
          ok(function () { R("HYData").set("base.skin." + roleId, skinId); });
          ok(function () { var DYN = R("DYNotify"), K = R("HYKey"); if (DYN && K) DYN.post(K.KChangeSkin, roleId); });
          log("皮肤绕过解锁条件直写: " + roleId + " -> " + skinId);
        }
        T("皮肤已应用: " + nameOf("skin", p, skinId));
        if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
      }, 150);
    });
  }

  /* ================= 商店 ================= */
  function shopPickerItems(cb) {
    allProfiles("shop", function (cur) {
      var arr = [];
      for (var k in (cur || {})) {
        var p = cur[k];
        arr.push([String(k), nameOf("shop", p, k) + (p.priceType ? "  [" + p.priceType + "]" : ""), ""]);
      }
      cb(arr);
    });
  }
  function shopBuy(ids) {
    var MS = R("ModelShop");
    if (!MS) { T("商店模块未就绪"); return; }
    var n = 0;
    for (var i = 0; i < ids.length; i++) {
      (function (id) { ok(function () { MS.buyGoods(String(id), 1, function () { n++; }, true); }); })(ids[i]);
    }
    setTimeout(function () {
      T("已免费购买 " + n + " 个商品");
      if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
    }, 1500);
  }

  /* ================= 状态 / 信息 ================= */
  function stateInfo() {
    var HP = R("HYPlayer"), HD = R("HYData");
    if (!HP || !HD) return "未就绪";
    var out = [], n = HP.getRoleNum ? HP.getRoleNum() : 0;
    for (var i = 1; i <= n; i++) {
      var rid = ok(function () { return HP.getRoleIdByIndex(i); });
      if (!rid) continue;
      var name = ok(function () { return HP.getRoleNameById(rid); }) || rid;
      var ss = [];
      ["health", "hunger", "mentality", "waterPlague"].forEach(function (a) {
        var v = ok(function () { return Math.round(HP.getState(a, i)); });
        var m = ok(function () { return Math.round(HP.getState(a + "Max", i)); });
        if (v !== null && v !== undefined) ss.push(a + " " + v + "/" + m);
      });
      out.push(name + ": " + ss.join(" "));
    }
    return out.join("  ") || "无角色";
  }
  function worldInfo() {
    var HY = R("HYTime"), HW = R("HYWorld"), HD = R("HYData");
    var out = [];
    ok(function () { out.push("天数 " + HY.day() + " (" + HY.hour() + " 时)"); });
    ok(function () { out.push("模式 " + HD.getCurMode()); });
    ok(function () {
      var d = HW.getCurDungeon && HW.getCurDungeon();
      if (d) out.push("副本 " + (d.id || d));
    });
    ok(function () { out.push("金币 " + R("HYCommon").getDiamondNum() + " 银币 " + R("HYCommon").getShellNum()); });
    return out.join("  ");
  }
  function refillAttrs() {
    var HP = R("HYPlayer"), HD = R("HYData");
    if (!HP || !HD) return;
    var attrs = ["health", "hunger", "mentality"];
    var n = HP.getRoleNum ? HP.getRoleNum() : 1;
    for (var i = 1; i <= n; i++) {
      for (var a = 0; a < attrs.length; a++) {
        (function (attr, idx) {
          var mx = ok(function () { return HP.getState(attr + "Max", idx); });
          if (mx > 0) ok(function () { HD.set("core.role." + idx + "." + attr, mx); });
        })(attrs[a], i);
      }
      (function (idx) {
        var mx = ok(function () { return HP.getState("hpMax", idx); });
        if (mx > 0) ok(function () { HD.set("core.role." + idx + ".hp", mx); });
      })(i);
    }
    T("状态已回满");
    if (cfg.autoSave) ok(function () { HD.trySave(); });
  }

  /* ---- R9: 状态细化 (饱食/健康/精力 单项回满 + HP 值/上限设置, 支持指定角色) ---- */
  var STATE_CN = { hunger: "饱食", health: "健康", mentality: "精力" };
  function roleNameByIndex(idx) {
    var HP = R("HYPlayer");
    var rid = ok(function () { return HP.getRoleIdByIndex(idx); });
    var p = null;
    ok(function () { p = R("HYProfile").getByIdDirect("role", rid); });
    if (p) return nameOf("role", p, rid);
    return rid ? String(rid) : String(idx);
  }
  function stateTargets() {
    var HP = R("HYPlayer");
    if (!HP) return [];
    var all = [], n = HP.getRoleNum ? HP.getRoleNum() : 0;
    for (var i = 1; i <= n; i++) all.push(String(i));
    var sel = M.vals.st_roles;
    if (sel && sel.length) {
      var out = [];
      for (var j = 0; j < sel.length; j++) if (all.indexOf(String(sel[j])) >= 0) out.push(String(sel[j]));
      if (out.length) return out;
    }
    return all;
  }
  function stateTargetsText() {
    var HP = R("HYPlayer");
    var all = HP && HP.getRoleNum ? HP.getRoleNum() : 0;
    var t = stateTargets();
    if (!t.length) return "无可用角色";
    if (t.length === all) return "全部角色(" + all + ")";
    var names = [];
    for (var i = 0; i < t.length; i++) names.push(t[i] + ":" + roleNameByIndex(t[i]));
    return "指定 " + names.join(", ");
  }
  function finishStateChange(ts) {
    var HD = R("HYData"), DYN = R("DYNotify"), K = R("HYKey");
    if (cfg.autoSave) ok(function () { HD.trySave(); });
    for (var i = 0; i < ts.length; i++) (function (idx) {
      ok(function () { DYN && K && DYN.post(K.kRoleState, { role: parseInt(idx, 10) }); });
    })(ts[i]);
  }
  function refillAttrOne(attr) {
    var HP = R("HYPlayer"), HD = R("HYData");
    if (!HP || !HD) return;
    var ts = stateTargets(), n = 0;
    for (var i = 0; i < ts.length; i++) (function (idx) {
      var mx = ok(function () { return HP.getState(attr + "Max", idx); });
      if (mx > 0) { ok(function () { HD.set("core.role." + idx + "." + attr, mx); }); n++; }
    })(ts[i]);
    T(STATE_CN[attr] + " 已回满 (" + n + " 个角色)");
    finishStateChange(ts);
  }
  function setHpValue(v) {
    var HP = R("HYPlayer"), HD = R("HYData");
    if (!HP || !HD) return;
    v = parseInt(v, 10);
    if (isNaN(v) || v < 0) { T("请输入有效 HP 数值"); return; }
    var ts = stateTargets(), n = 0, clamp = 0;
    for (var i = 0; i < ts.length; i++) (function (idx) {
      var mx = parseInt(ok(function () { return HP.getState("hpMax", idx); }) || 0, 10) || 0;
      var to = (mx > 0 && v > mx) ? (clamp++, mx) : v;
      ok(function () { HD.set("core.role." + idx + ".hp", to); }); n++;
    })(ts[i]);
    T("HP 已设为 " + v + " (" + n + " 个角色" + (clamp ? ", " + clamp + " 个被上限截断" : "") + ")");
    finishStateChange(ts);
  }
  function setHpMax(v) {
    var HP = R("HYPlayer"), HD = R("HYData");
    if (!HP || !HD) return;
    v = parseInt(v, 10);
    if (isNaN(v) || v <= 0) { T("请输入有效的 HP 上限"); return; }
    var ts = stateTargets(), n = 0;
    for (var i = 0; i < ts.length; i++) (function (idx) {
      ok(function () {
        HD.set("core.role." + idx + ".hpMax", v);
        var hp = parseInt(HD.get("core.role." + idx + ".hp") || 0, 10) || 0;
        if (hp > v) HD.set("core.role." + idx + ".hp", v);
      });
      n++;
    })(ts[i]);
    T("HP 上限已设为 " + v + " (" + n + " 个角色)");
    finishStateChange(ts);
  }
  function stateRolePickerItems(cb) {
    var HP = R("HYPlayer");
    var arr = [];
    var n = HP && HP.getRoleNum ? HP.getRoleNum() : 0;
    for (var i = 1; i <= n; i++) (function (idx) {
      var info = "";
      ok(function () {
        var h = Math.round(HP.getState("hunger", idx) || 0), hm = Math.round(HP.getState("hungerMax", idx) || 0);
        var hp = Math.round(HP.getState("hp", idx) || 0), hpm = Math.round(HP.getState("hpMax", idx) || 0);
        var exp = HP.isExploring && HP.isExploring(idx);
        info = "饱食" + h + "/" + hm + " HP" + hp + "/" + hpm + (exp ? " 出战中" : " 在家");
      });
      arr.push([String(idx), roleNameByIndex(idx) + "  " + info, ""]);
    })(i);
    cb && cb(arr);
  }
  M.refillAttrOne = refillAttrOne; M.setHpValue = setHpValue; M.setHpMax = setHpMax;
  M.stateRolePickerItems = stateRolePickerItems; M.stateTargetsText = stateTargetsText;

  /* ---- R25: 战斗属性细项 (FIGHT_ATTR 31 项 + BASE_ATTR 6 项, 按目标角色精确修改) ----
     写入走游戏原生 HYPlayer.addRoleAttr(idx, attr, delta): core.role.<idx>.<attr> += delta
     并累计到 exAttr, 升级/属性重算后不丢失; 战斗创建时 HYPlayer._RoleFightParams clone
     core.role -> HYWarrior._getProp(base) 真实生效 (decHurt 为 getDamage 内平摊减伤 m)。
     输入框语义: 填数值 = 设为该绝对值 (按 目标值-当前值 求 delta); 留空 = 不改。 */
  var FIGHT_ATTR_LIST = [
    ["atk", "攻击力"], ["def", "防御力"], ["atkDis", "攻击距离"], ["atkSp", "攻击速度"],
    ["hit", "命中率"], ["dodge", "闪避率"], ["moveSp", "移动速度"], ["crit", "暴击率"],
    ["critNum", "暴击伤害"], ["antiHurt", "反伤率"], ["antiHurtNum", "反伤值"], ["decHurt", "减伤"],
    ["misfire", "哑火率"], ["antiCrit", "抗暴击率"], ["defCritNum", "抗暴击值"],
    ["cow", "恐慌率"], ["poison", "中毒率"], ["dizzy", "眩晕率"], ["froze", "冰冻率"],
    ["repel", "击退率"], ["suckBd", "吸血率"], ["suckBdNum", "吸血值"],
    ["defCow", "抗恐慌"], ["defPoison", "抗中毒"], ["defDizzy", "抗眩晕"], ["defFroze", "抗冰冻"],
    ["defRepel", "抗击退"], ["defSuckBd", "抗吸血率"], ["defSuckBdNum", "抗吸血值"],
    ["defAntiHurt", "抗反伤率"], ["defAntiHurtNum", "抗反伤值"]
  ];
  var BASE_ATTR_LIST = [ ["str", "力量"], ["agi", "敏捷"], ["int", "智力"], ["end", "耐力"], ["cha", "魅力"], ["luc", "幸运"] ];
  function fightAttrAll() { return FIGHT_ATTR_LIST.concat(BASE_ATTR_LIST); }
  function fightAttrNow(key, idx) {
    var HD = R("HYData");
    var v = ok(function () { return HD.get("core.role." + idx + "." + key); });
    if (v === undefined || v === null || v === "") return null;
    var n = parseFloat(v);
    return isNaN(n) ? null : (Math.round(n * 1000) / 1000);
  }
  function fightAttrInputItems(list) {
    var ts = stateTargets(), idx = ts.length ? ts[0] : null;
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var key = list[i][0], cn = list[i][1];
      var now = (idx === null) ? null : fightAttrNow(key, idx);
      out.push({
        type: "input", id: "fa_" + key,
        title: cn + " (" + key + ")" + (now === null ? "" : "  当前 " + now),
        val: String(pv("fa_" + key, "")),
        hint: now === null ? "留空=不改" : String(now)
      });
    }
    return out;
  }
  function fightAttrsRead() {
    var HD = R("HYData");
    if (!HD) { T("数据模块未就绪"); return; }
    var ts = stateTargets();
    if (!ts.length) { T("没有可编辑的角色"); return; }
    var idx = ts[0], all = fightAttrAll(), n = 0;
    for (var i = 0; i < all.length; i++) {
      var v = fightAttrNow(all[i][0], idx);
      M.vals["fa_" + all[i][0]] = (v === null) ? "" : String(v);
      if (v !== null) n++;
    }
    T("已读取 " + roleNameByIndex(idx) + " 的 " + n + " 项属性到输入框, 改完点「应用」");
    /* R25: fa_* 不写入首选项 (saveVals), 仅本次运行内有效 */
    setTimeout(function () { pushMenu(); }, 200);
  }
  function fightAttrsApply() {
    var HP = R("HYPlayer"), HD = R("HYData");
    if (!HP || !HD) { T("角色模块未就绪"); return; }
    var ts = stateTargets();
    if (!ts.length) { T("没有可编辑的角色"); return; }
    var all = fightAttrAll(), filled = 0, bad = 0, changed = 0;
    for (var i = 0; i < all.length; i++) {
      var key = all[i][0];
      var raw = M.vals["fa_" + key];
      if (raw === undefined || raw === null || String(raw).replace(/\s+/g, "") === "") continue;
      var want = parseFloat(raw);
      if (isNaN(want)) { bad++; continue; }
      filled++;
      for (var j = 0; j < ts.length; j++) (function (idx, key, want) {
        var now = fightAttrNow(key, idx);
        if (now === null) now = 0;
        var delta = Math.round((want - now) * 1000) / 1000;
        if (delta !== 0) { ok(function () { HP.addRoleAttr(idx, key, delta); }, "fa"); changed++; }
      })(ts[j], key, want);
    }
    if (!filled) { T("没有填写任何属性: 先点「读取当前属性」, 再改要修改的项"); return; }
    T("战斗属性已应用 (" + filled + " 项 x " + ts.length + " 角色, 实际改动 " + changed + " 处" + (bad ? ", " + bad + " 项数值无效被跳过" : "") + ")");
    if (changed) { finishStateChange(ts); setTimeout(function () { pushMenu(); }, 200); }
  }
  M.fightAttrInputItems = fightAttrInputItems; M.fightAttrsRead = fightAttrsRead; M.fightAttrsApply = fightAttrsApply;

  /* ---- R8: 角色单选/多选解锁 ---- */
  function rolePickerItems(cb) {
    allProfiles("role", function (cur) {
      var arr = [];
      var unlocked = ok(function () { return R("HYData").get("base.roleUnlock") || []; }) || [];
      for (var k in (cur || {})) {
        var p = cur[k];
        if (!p) continue;
        var has = false;
        for (var i = 0; i < unlocked.length; i++) if (String(unlocked[i]) === String(k)) { has = true; break; }
        arr.push([String(k), nameOf("role", p, k) + (has ? "  [已解锁]" : ""), p.job ? ("职业 " + p.job) : ""]);
      }
      cb(arr);
    });
  }
  M.rolePickerItems = rolePickerItems;

  /* ---- R16: 宠物 ---- */
  function petUnlockSystem() {
    var PM = R("PetMgr");
    if (!PM) { T("宠物模块未就绪"); return; }
    if (PM.isUnlockPetSystem && PM.isUnlockPetSystem()) { T("宠物系统已是解锁状态"); return; }
    ok(function () { PM.unlockPetSystem(); });
    T("宠物系统已解锁 (含初始宠物)");
    if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
  }
  function petPickerItems(cb) {
    allProfiles("pet", function (cur) {
      var arr = [];
      for (var k in (cur || {})) {
        var p = cur[k];
        if (!p) continue;
        arr.push(["pet_" + k, nameOf("pet", p, k) + (p.rarity ? "  ★" + p.rarity : ""), ""]);
      }
      arr.sort(function (a, b) { return (parseInt(String(a[0]).slice(4), 10) || 0) - (parseInt(String(b[0]).slice(4), 10) || 0); });
      cb(arr);
    });
  }
  function petGrant(ids) {
    var PM = R("PetMgr");
    if (!PM) { T("宠物模块未就绪"); return; }
    if (PM.isUnlockPetSystem && !PM.isUnlockPetSystem()) ok(function () { PM.unlockPetSystem(); });
    var n = 0;
    for (var i = 0; i < ids.length; i++) {
      var pid = String(ids[i]).replace("pet_", "");
      (function (id) { ok(function () { PM.gainPet(id, function () { n++; }); }); })(pid);
    }
    setTimeout(function () {
      T("已添加 " + n + " 只宠物到兽栏宠室");
      if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
    }, 800);
  }
  M.petUnlockSystem = petUnlockSystem; M.petPickerItems = petPickerItems; M.petGrant = petGrant;

  M.techMaxAll = techMaxAll; M.buildMaxAll = buildMaxAll; M.buildRepairAll = buildRepairAll;
  M.achieveAll = achieveAll; M.atlasAll = atlasAll; M.petAll = petAll; M.roleAll = roleAll;
  M.applySkin = applySkin; M.applyRoles = applyRoles; M.shopBuy = shopBuy;
  M.stateInfo = stateInfo; M.worldInfo = worldInfo; M.refillAttrs = refillAttrs;
  M.buildPickerItems = buildPickerItems; M.achievePickerItems = achievePickerItems;
  M.skinPickerItems = skinPickerItems; M.shopPickerItems = shopPickerItems;

  /* ================= 控件状态记忆 ================= */
  M.vals = {};
  ok(function () {
    var s = M.persist ? cc.sys.localStorage.getItem("hymod_vals2") : null;
    if (s) M.vals = JSON.parse(s) || {};
  }, "vals");
  function saveVals() { if (!M.persist) return; ok(function () { cc.sys.localStorage.setItem("hymod_vals2", JSON.stringify(M.vals)); }); }
  function pv(id, def) { var v = M.vals[id]; return (v === undefined || v === null || v === "") ? def : v; }
  function sv(id, def) { var v = M.vals[id]; if (v === undefined) return def; return v === "1" || v === true || v === 1; }
  function nv(id, def) { var n = parseInt(pv(id, def), 10); return isNaN(n) ? def : n; }
  M.pv = pv; M.sv = sv; M.nv = nv; M.saveVals = saveVals;
  M.pickMode = "grant";

/* ================= 菜单 ================= */
function buildMenu() {
  var tabs = [];

  /* ---- 物品 ---- */
  tabs.push({ title: "物品", items: [
    { type: "text", title: "默认数量(物品选择器内可直接改; 给仓库补发全部物品也用它)" },
    { type: "input", id: "all_cnt", title: "默认数量", val: String(pv("all_cnt", "99")), hint: "99" },
    { type: "button", id: "open_picker", title: "选择物品 -> 发放到仓库" },
    { type: "button", id: "open_picker_bag", title: "选择物品 -> 发放到背包" },
    { type: "button", id: "all_wh", title: "给仓库补发全部物品" },
    { type: "button", id: "bag_to_wh", title: "背包 -> 仓库 (全部搬入)" },
    { type: "button", id: "clear_bag", title: "清空背包" },
    { type: "button", id: "compact", title: "整理堆叠 (合并仓库内同状态的装备/药剂等)" },
    { type: "button", id: "coin_add", title: "金币 +99999 / 银币 +99999 (邮件领取)" },
    { type: "text", title: "货币通过游戏原生邮件接口创建并领取(与「货币恢复」邮件同通道); 大额金币已修复归零问题" },
    { type: "button", id: "cap_info", title: "查看当前 背包/仓库 容量与总重量" },
    { type: "input", id: "cap_bag_val", title: "背包容量 (0 或空=恢复原生自动)", val: String(pv("cap_bag_val", "")), hint: "如 5000" },
    { type: "button", id: "cap_bag_set", title: "应用 -> 背包容量" },
    { type: "button", id: "cap_bag_pick", title: "点选数值 -> 背包容量 (含当前总重量)" },
    { type: "input", id: "cap_wh_val", title: "仓库容量 (0 或空=恢复原生自动)", val: String(pv("cap_wh_val", "")), hint: "如 20000" },
    { type: "button", id: "cap_wh_set", title: "应用 -> 仓库容量" },
    { type: "button", id: "cap_wh_pick", title: "点选数值 -> 仓库容量 (含当前总重量)" },
    { type: "text", title: "背包容量写入游戏存档(永久); 仓库容量为 MOD 侧加成, 跨重启需开启「保存功能首选项」" }
  ]});

  /* ---- 角色 ---- */
  tabs.push({ title: "角色", items: [
    { type: "button", id: "role_all", title: "一键解锁全部角色" },
    { type: "button", id: "role_picker", title: "选择角色 -> 单独解锁(可多选)" },
    { type: "button", id: "skin_picker", title: "选择皮肤并应用(全皮肤)" },
    { type: "text", title: "皮肤会绕过解锁条件直接应用; 角色解锁走游戏原生 RoleDataServer" }
  ]});

  /* ---- 状态 ---- */
  tabs.push({ title: "状态", items: [
    { type: "button", id: "st_role_picker", title: "选择目标角色 当前: " + stateTargetsText() },
    { type: "button", id: "refill_hunger", title: "一键回满 饱食" },
    { type: "button", id: "refill_health", title: "一键回满 健康" },
    { type: "button", id: "refill_mentality", title: "一键回满 精力" },
    { type: "input", id: "hp_val", title: "HP 值(点下方按钮应用)", val: String(pv("hp_val", "100")), hint: "100" },
    { type: "button", id: "set_hp", title: "应用 HP 值" },
    { type: "input", id: "hp_max_val", title: "HP 上限(点下方按钮应用)", val: String(pv("hp_max_val", "100")), hint: "100" },
    { type: "button", id: "set_hp_max", title: "应用 HP 上限" },
    { type: "switch", id: "lockAttrs", title: "锁定状态(不再下降)", val: sv("lockAttrs", false) },
    { type: "text", title: "多角色时可先选目标角色(不选=全部); 操作后自动存档并刷新状态面板" }
  ]});

  /* ---- 战斗 ---- (R25: 战斗属性细项全部可自定义, 按目标角色写入) */
  var fightItems = [
    { type: "button", id: "st_role_picker", title: "选择目标角色 当前: " + stateTargetsText() },
    { type: "switch", id: "godMode", title: "无敌(HPx50 + 免疫伤害)", val: sv("godMode", false) },
    { type: "switch", id: "oneHit", title: "一击必杀(攻击x50 + 必暴击)", val: sv("oneHit", false) },
    { type: "switch", id: "moveOn", title: "加速移动(队伍移速倍率)", val: sv("moveOn", false) },
    { type: "input", id: "moveMul", title: "移速倍率 (%)", val: String(pv("moveMul", "300")), hint: "300" },
    { type: "text", title: "以上开关只作用于我方单位(HYWarrior.PlayerWarrior), 纯本地不上传" },
    { type: "text", title: "— 战斗属性 31 项 (同原版口径, 0.01=1%): 填数值=设为目标值, 留空=不改 —" }
  ];
  fightItems = fightItems.concat(fightAttrInputItems(FIGHT_ATTR_LIST));
  fightItems.push({ type: "text", title: "— 基础六维 (会随等级重算; MOD 加成记入 exAttr, 升级后保留) —" });
  fightItems = fightItems.concat(fightAttrInputItems(BASE_ATTR_LIST));
  fightItems.push({ type: "button", id: "fa_read", title: "读取当前属性到输入框 (取第一个目标角色)" });
  fightItems.push({ type: "button", id: "fa_apply", title: "应用以上填写的属性 (留空=不改)" });
  fightItems.push({ type: "text", title: "写入走游戏原生 HYPlayer.addRoleAttr(含 exAttr 加成); 目标角色与「状态」栏共用; 下一场战斗生效" });
  tabs.push({ title: "战斗", items: fightItems });

  /* ---- 科技 ---- */
  tabs.push({ title: "科技", items: [
    { type: "button", id: "tech_tool", title: "工具科技 全解锁" },
    { type: "button", id: "tech_med", title: "医药科技 全解锁" },
    { type: "button", id: "tech_kitchen", title: "厨房科技 全解锁" },
    { type: "button", id: "tech_load", title: "负重科技 全解锁" },
    { type: "button", id: "tech_max", title: "四类科技 一起全解锁" },
    { type: "text", title: "按面板四大类分别解锁; 写入即真实生效(游戏实时读存档), 面板进度会同步刷新" }
  ]});

  /* ---- 建筑 ---- */
  tabs.push({ title: "建筑", items: [
    { type: "button", id: "build_max", title: "全部建筑 解锁 + 满级" },
    { type: "button", id: "build_repair", title: "全部建筑耐久修复至上限" },
    { type: "button", id: "build_picker", title: "选择建筑 -> 设为满级" },
    { type: "text", title: "改完切换一次场景生效; 耐久修复走 restoreAllBuildDuration" }
  ]});

  /* ---- 成就 ---- */
  tabs.push({ title: "成就", items: [
    { type: "button", id: "achv_all", title: "一键解锁全部成就(含金币/积分/奖励)" },
    { type: "button", id: "achv_picker", title: "选择成就 -> 一键解锁" },
    { type: "text", title: "直接完成并自动领取各阶段金币与积分, 成就面板即时刷新" }
  ]});

  /* ---- 图鉴 ---- */
  tabs.push({ title: "图鉴", items: [
    { type: "button", id: "atlas_all", title: "一键解锁全部图鉴" },
    { type: "text", title: "遍历 atlas 表所有分组写入 setAtlas" }
  ]});

  /* ---- 宠物 ---- */
  tabs.push({ title: "宠物", items: [
    { type: "button", id: "pet_unlock", title: "解锁宠物系统" },
    { type: "button", id: "pet_picker", title: "宠物选择器 -> 添加到兽栏宠室" },
    { type: "text", title: "选择器含全部15只宠物(含特殊宠物 17103-17105 对应的 8/6/7 号), 带名字与图标" }
  ]});

  /* ---- 商店 ---- */
  tabs.push({ title: "商店", items: [
    { type: "switch", id: "freePay", title: "免费购买(跳过货币/人民币结算)", val: sv("freePay", true) },
    { type: "button", id: "shop_open", title: "打开商店(修复点击无反应)" },
    { type: "button", id: "shop_picker", title: "选择商品 -> 免费购买" },
    { type: "text", title: "走 ModelShop.buyGoods(...,true) 即游戏自身的免费发放通道" },
    { type: "text", title: "!! 人民币礼包属于内购, 风险最高, 建议小号测试" }
  ]});

  /* ---- 安全 ---- */
  tabs.push({ title: "安全", items: [
    { type: "switch", id: "safeLog", title: "拦截作弊上报(clientlog/setCheat)", val: sv("safeLog", true) },
    { type: "switch", id: "noHotfix", title: "拦截热更(防 MOD 被覆盖)", val: sv("noHotfix", true) },
    { type: "switch", id: "safeUpdate", title: "过滤 updatedata 上传可疑键", val: sv("safeUpdate", true) },
    { type: "switch", id: "safeCoin", title: "拦截 MOD 发币的 saveCoinChange", val: sv("safeCoin", true) },
    { type: "switch", id: "autoSave", title: "修改后自动存档", val: sv("autoSave", true) },
    { type: "switch", id: "persist", title: "保存功能首选项(重启后保留)", val: M.persist },
    { type: "button", id: "clear_flags", title: "清除作弊标记 (base.cheat=0)" },
    { type: "text", title: "已内置: 4015 弹窗过滤 / _checkMainJs 移除 / sealTip 空实现" }
  ]});

  /* ---- 关于 ---- */
  tabs.push({ title: "关于", items: [
    { type: "text", title: "荒野日记 MOD v" + M.ver },
    { type: "text", title: "基线: 0.0.8.070501 (OPPO 渠道服)" },
    { type: "button", id: "world_info", title: "查看 天数/模式/副本/货币" },
    { type: "button", id: "diag", title: "模块自检(结果见提示/logcat)" },
    { type: "text", title: "悬浮球按住可拖动; 功能以本地 hook 为主" },
    { type: "text", title: "仅供学习交流, 请勿用于主账号" }
  ]});

  return { title: "荒野日记 MOD", tabs: tabs };
}
function pushMenu() {
  var m = jstr(buildMenu());
  if (!m) { log("菜单序列化失败"); return; }
  bridge("setMenu", "(Ljava/lang/String;)V", m);
  log("菜单已下发 (" + m.length + " 字节)");
}
M.pushMenu = pushMenu;

/* ================= 选择器 ================= */
function openPicker(mode, title, items, opts) {
  M.pickMode = mode;
  var o = { title: title, count: String(pv("all_cnt", "99")), action: mode, items: items || [], hideTarget: true, hideCount: false };
  if (opts) for (var k in opts) o[k] = opts[k];
  bridge("openItemPicker", "(Ljava/lang/String;)V", jstr(o));
}
M.openPicker = openPicker;

function onPick(ids, count) {
  var n = parseInt(count, 10) || 1;
  if (M.pickMode === "grant_wh" || M.pickMode === "grant_bag") { M.vals.all_cnt = String(n); saveVals(); }
  switch (M.pickMode) {
    case "grant_wh": giveItems(ids, n, "warehouse"); break;
    case "grant_bag": giveItems(ids, n, "bag"); break;
    case "skin": applySkin(ids[0]); break;
    case "build": applyBuildLevel(ids, n); break;
    case "achv": applyAchievements(ids); break;
    case "shop": shopBuy(ids); break;
    case "role": applyRoles(ids); break;
    case "state_role":
      M.vals.st_roles = ids.slice();
      saveVals();
      T("目标角色已设置: " + stateTargetsText());
      setTimeout(pushMenu, 200);
      break;
    case "pet": petGrant(ids); break;
    case "cap_bag": applyBagCap(parseInt(ids[0], 10) || 0); break;
    case "cap_wh": applyWhCap(parseInt(ids[0], 10) || 0); break;
    default: giveItems(ids, n, "warehouse");
  }
}
M.onPick = onPick;

function applyBuildLevel(ids, lv) {
  var HB = R("HYBuild");
  if (!HB) return;
  var n = 0;
  for (var i = 0; i < ids.length; i++) (function (com) {
    ok(function () { HB.unlockBuild(com); });
    ok(function () {
      HB.getBuildMaxLevel(com, function (max) {
        var to = (lv > 1 && lv < 100) ? lv : max;
        if (max > 0 && (to <= 0 || to > max)) to = max; /* R18: 不得超过档案等级上限 */
        if (to > 0) { HB.updateBuildLevel(com, to); n++; }
      });
    });
  })(ids[i]);
  T("建筑已设置 (" + n + " 处)");
  if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
}
function applyAchievements(ids) {
  allProfiles("achievement", function (cur) {
    if (!cur) { T("成就表未就绪"); return; }
    M.finishAchievements(ids, cur);
  });
}

/* ================= R20: 首选项重启后真正生效 =================
   旧实现: boot() 只安装 hook 不按已保存的 M.vals 恢复 buff/cfg ->
   重启后开关显示"开"(Java 从 M.vals 渲染), 但 buff 恒为初始 false, 实际未生效。
   新实现: boot 时回放 M.vals 里的开关/数值, 再确保各 hook 已安装。 */
function restorePrefs() {
  var changed = [];
  var bools = ["godMode", "oneHit", "moveOn", "lockAttrs", "freePay", "rbLock"];
  for (var i = 0; i < bools.length; i++) {
    var id = bools[i];
    if (M.vals[id] === undefined) continue;
    var v = sv(id, false);
    if (buff[id] !== v) { buff[id] = v; changed.push(id + "=" + (v ? 1 : 0)); }
  }
  var cfgs = ["safeLog", "noHotfix", "safeUpdate", "safeCoin", "autoSave"];
  for (var j = 0; j < cfgs.length; j++) {
    var cid = cfgs[j];
    if (M.vals[cid] === undefined) continue;
    var cv = sv(cid, cfg[cid]);
    if (cfg[cid] !== cv) { cfg[cid] = cv; changed.push(cid + "=" + (cv ? 1 : 0)); }
  }
  if (M.vals.moveMul !== undefined) {
    var mm = Math.max(100, nv("moveMul", 300));
    if (buff.moveMul !== mm) { buff.moveMul = mm; changed.push("moveMul=" + mm); }
  }
  installCombatHooks(); installMoveHooks(); installStateHooks();
  log("首选项已恢复: " + (changed.join(", ") || "无(全默认)"));
}
M.restorePrefs = restorePrefs;

/* ================= 消息分发 ================= */
function dispatch(id, val) {
  log("ON " + id + " = " + val);
  switch (id) {
    /* 物品 */
    case "open_picker": pickerItems(function (arr) { openPicker("grant_wh", "发放到仓库", arr); }); break;
    case "open_picker_bag": pickerItems(function (arr) { openPicker("grant_bag", "发放到背包", arr); }); break;
    case "all_wh": grantAllItems(nv("all_cnt", 99)); break;
    case "bag_to_wh": bagToWarehouse(); break;
    case "clear_bag": clearBag(); break;
    case "compact": compactStacks(); break;
    /* R19: 容量 */
    case "cap_info": capInfo(); break;
    case "cap_bag_set": { var cbv = nv("cap_bag_val", 0); if (cbv > 0) applyBagCap(cbv); else restoreBagCap(); break; }
    case "cap_wh_set": { var cwv = nv("cap_wh_val", 0); if (cwv > 0) applyWhCap(cwv); else restoreWhCap(); break; }
    case "cap_bag_pick": capPickItems(false, function (arr) { openPicker("cap_bag", "选择背包容量数值", arr, { single: true, okText: "应 用 容 量", hideCount: true }); }); break;
    case "cap_wh_pick": capPickItems(true, function (arr) { openPicker("cap_wh", "选择仓库容量数值", arr, { single: true, okText: "应 用 容 量", hideCount: true }); }); break;
    case "cap_bag_val": case "cap_wh_val": M.vals[id] = val; saveVals(); break;
    case "wh_cap": break;
    case "coin_add": grantCurrency(99999, 99999); break;
    /* 角色 */
    case "role_all": roleAll(); break;
    case "role_picker": rolePickerItems(function (arr) { openPicker("role", "选择角色(可多选, 确认即解锁)", arr, { hideCount: true }); }); break;
    case "pet_unlock": petUnlockSystem(); break;
    case "pet_picker": petPickerItems(function (arr) { openPicker("pet", "选择宠物(可多选, 确认即入兽栏)", arr, { hideCount: true }); }); break;
    case "skin_picker": skinPickerItems(function (arr) { openPicker("skin", "选择皮肤(选中即应用)", arr, { single: true, okText: "应 用 皮 肤", hideCount: true }); }); break;
    /* 状态 */
    case "refill": refillAttrs(); break;
    case "st_role_picker": stateRolePickerItems(function (arr) { openPicker("state_role", "选择目标角色(可多选, 不选=全部)", arr, { single: false, hideCount: true }); }); break;
    case "refill_hunger": refillAttrOne("hunger"); break;
    case "refill_health": refillAttrOne("health"); break;
    case "refill_mentality": refillAttrOne("mentality"); break;
    case "set_hp": setHpValue(nv("hp_val", 100)); break;
    case "set_hp_max": setHpMax(nv("hp_max_val", 100)); break;
    case "fa_read": fightAttrsRead(); break;
    case "fa_apply": fightAttrsApply(); break;
    case "hp_val": M.vals.hp_val = val; saveVals(); break;
    case "hp_max_val": M.vals.hp_max_val = val; saveVals(); break;
    /* 科技/建筑/成就/图鉴/宠物 */
    case "tech_max": techMaxAll(); break;
    case "tech_tool": techUnlockTag("20100", "工具科技"); break;
    case "tech_med": techUnlockTag("20400", "医药科技"); break;
    case "tech_kitchen": techUnlockTag("20300", "厨房科技"); break;
    case "tech_load": techUnlockTag("10000", "负重科技"); break;
    case "build_max": buildMaxAll(); break;
    case "build_repair": buildRepairAll(); break;
    case "build_picker": buildPickerItems(function (arr) { openPicker("build", "选择建筑(数量=等级)", arr); }); break;
    case "achv_all": achieveAll(); break;
    case "achv_picker": achievePickerItems(function (arr) { openPicker("achv", "选择成就(可多选, 确认即解锁)", arr, { hideCount: true }); }); break;
    case "atlas_all": atlasAll(); break;
    case "pet_all": petAll(); break;
    /* 商店 */
    case "shop_picker": shopPickerItems(function (arr) { openPicker("shop", "选择商品(免费购买)", arr, { hideCount: true }); }); break;
    case "shop_open": M.shopForceOpen(); break;
    /* 信息 */
    case "world_info": T(worldInfo()); break;
    case "diag": T(M.diag()); break;
    /* 开关 */
    case "godMode": buff.godMode = (val === "1" || val === true); installCombatHooks(); T("无敌 " + (buff.godMode ? "开" : "关")); break;
    case "oneHit": buff.oneHit = (val === "1" || val === true); installCombatHooks(); T("一击必杀 " + (buff.oneHit ? "开" : "关")); break;
    case "moveOn": buff.moveOn = (val === "1" || val === true); installMoveHooks(); T("加速移动 " + (buff.moveOn ? "开" : "关")); break;
    case "lockAttrs": buff.lockAttrs = (val === "1" || val === true); installStateHooks(); T("锁定状态 " + (buff.lockAttrs ? "开" : "关")); break;
    case "freePay": buff.freePay = (val === "1" || val === true); T("免费购买 " + (buff.freePay ? "开" : "关")); break;
    case "safeLog": cfg.safeLog = (val === "1" || val === true); saveCfg(); T("拦截上报 " + (cfg.safeLog ? "开" : "关")); break;
    case "noHotfix": cfg.noHotfix = (val === "1" || val === true); saveCfg(); T("拦截热更 " + (cfg.noHotfix ? "开" : "关")); break;
    case "safeUpdate": cfg.safeUpdate = (val === "1" || val === true); saveCfg(); T("过滤上传 " + (cfg.safeUpdate ? "开" : "关")); break;
    case "safeCoin": cfg.safeCoin = (val === "1" || val === true); saveCfg(); T("拦截发币上报 " + (cfg.safeCoin ? "开" : "关")); break;
    case "autoSave": cfg.autoSave = (val === "1" || val === true); saveCfg(); T("自动存档 " + (cfg.autoSave ? "开" : "关")); break;
    case "persist": setPersist(val === "1" || val === true); T("保存首选项 " + (M.persist ? "开" : "关")); break;
    case "clear_flags":
      ok(function () {
        var HD = R("HYData");
        HD.set("base.cheat", 0); HD.trySave();
        T("作弊标记已清除");
      }, "clearflags");
      break;
    case "moveMul": buff.moveMul = Math.max(100, nv("moveMul", 300)); log("移速倍率 = " + buff.moveMul); break;
    case "all_cnt": log("数量 = " + val); break;
    default: log("未处理的按钮 " + id);
  }
}
M.dispatch = dispatch;

/* ================= 与 Java 层通信 ================= */
window.HYMOD_ON = function (id, val) {
  try {
    M.vals[id] = val;
    /* R20/R24: 所有输入项 (含 all_cnt) 都要记住; R25: fa_* 是一次性目标值
       (写入即落盘到角色 exAttr), 不进首选项持久化 —— 避免重启后
       把陈旧快照当成当前意图误应用。 */
    if (String(id).indexOf("fa_") !== 0) saveVals();
    dispatch(String(id), val);
  } catch (e) { log("HYMOD_ON " + id + " 出错: " + e); T("执行出错: " + e); }
};
window.HYMOD_PICK = function (json) {
  try {
    var o = JSON.parse(json);
    var ids = o.ids || [], cnt = parseInt(o.count, 10) || 99;
    if (!ids.length) { T("未选中任何项"); return; }
    var mode = String(o.action || M.pickMode || "grant");
    if (mode === "grant") mode = (o.target === "bag") ? "grant_bag" : "grant_wh";
    M.pickMode = mode;
    onPick(ids, cnt);
  } catch (e) { log("HYMOD_PICK 出错: " + e); T("执行出错: " + e); }
};
window.HYMOD_UI_READY = function () {
  log("UI_READY -> 重新下发菜单");
  setTimeout(pushMenu, 60);
};

/* ================= 启动 ================= */
  /* ================= R3: 商店打不开修复 =================
     根因: PanelShop 模块用闭包变量缓存面板组件; 面板销毁后(或销毁流程异常时)
     该缓存仍指向已失效组件(node=null, 节点属性全 null), 之后点「商城」
     走 c.init(...) 直接抛 TypeError: getComponent of null → 界面无反应。
     修复: 1) 接管模块 open: 每次校验现有对话框与组件有效性, 失效则强制重新加载;
           2) checkAd / onDestroy 补 null 防护(旧版 prefab 可能缺 nodAdBtn 等节点)。 */
  function installShopPatch() {
    if (installShopPatch.done) return;
    ok(function () {
      var cls = cc.js && cc.js.getClassByName && cc.js.getClassByName("PanelShop");
      if (cls && cls.prototype) {
        var proto = cls.prototype;
        if (!proto.__modPatch) {
          proto.checkAd = function () {
            var btn = this.nodAdBtn;
            if (!btn) return;
            var w = null;
            try { w = btn.getComponent("WidgetAd"); } catch (e) {}
            if (!w) return;
            try { w.init(R("Const").AD_TYPE.SHOP); btn.active = w.canShow(); } catch (e) {}
          };
          var rawDie = proto.onDestroy;
          proto.onDestroy = function () {
            try { rawDie.apply(this, arguments); }
            catch (e) { log("PanelShop.onDestroy 已容错: " + e); }
          };
          proto.__modPatch = true;
        }
      }
      var PS = R("PanelShop");
      if (PS && PS.open && !PS.__modOpen) {
        PS.open = function (type) {
          ok(function () {
            var DM = R("HYDialogMgr"), DL = R("DYLoader"), HC = R("HYCommon"), C = R("Const"), DYM = R("DY");
            if (!DM || !DL || !HC || !C) { log("商店模块未就绪"); return; }
            if (type == C.ShopPanelType.Diamond && !(DYM && DYM.cache && DYM.cache.shopEnable)) {
              ok(function () { R("PanelGoldCoinNotEnough").show(HC.getCoreNode(), DYM.layer.TIP); });
              return;
            }
            var scene = DM.getDialog("SceneMain") ? "Main" : "InGame";
            var dlg = DM.getDialog("PanelShop");
            if (dlg && cc.isValid(dlg)) {
              var comp = dlg.getComponent(dlg.name);
              if (comp && comp.node && cc.isValid(comp.node) && comp.nodBtnList) {
                comp.init(scene, type);
                return;
              }
            }
            if (installShopPatch.loading) return;
            installShopPatch.loading = true;
            DL.loadUIPanel("Shop/PanelShop", function (err, node) {
              installShopPatch.loading = false;
              if (err || !node) { log("PanelShop 加载失败: " + err); return; }
              var core = HC.getCoreNode();
              if (!cc.isValid(core)) { node.destroy(); return; }
              core.addChild(node, DYM.layer.UI_TIP);
              var c2 = node.getComponent(node.name);
              if (!c2) { log("PanelShop 组件缺失"); return; }
              c2.init(scene, type);
            });
          }, "shopOpen");
        };
        PS.__modOpen = true;
        log("PanelShop.open 已加固 (失效缓存自愈 + null 防护)");
      }
    }, "shopPatch");
    installShopPatch.done = true;
  }
  M.installShopPatch = installShopPatch;
  M.shopForceOpen = function () { var PS = R("PanelShop"); if (PS && PS.open) PS.open(R("Const").ShopPanelType.BestSellers); };

function boot() {
  if (!R("HYData") || !window.cc || !cc.director || !cc.director.getScene || !cc.director.getScene()) {
    setTimeout(boot, 500); return;
  }
  installSafeHooks();
  installNoBanHooks();
  patchDict();
  installStackPatch();
  installTechPanelHook();
  installShopPatch();
  installBuildPatch();
  installWhCapHook();
  restorePrefs();
  M.ready = true;
  log("MOD v" + M.ver + " 已加载 (原生菜单)");
  log("模块自检: " + M.diag());
  setTimeout(function () { pushMenu(); }, 400);
  setInterval(function () { installSafeHooks(); installNoBanHooks(); patchDict(); installStackPatch(); installTechPanelHook(); installShopPatch(); installBuildPatch(); installWhCapHook(); }, 5000);
}
M.boot = boot;
setTimeout(boot, 800);

/* 供调试: 在 logcat 里打印模块是否拿得到 */
M.diag = function () {
  var names = ["HYData", "HYCommon", "HYItem", "HYContainer", "HYPlayer", "HYProfile", "HYTime",
               "HYBuild", "HYTechnology", "HYAchievement", "HYStat", "PetMgr", "ModelShop",
               "RoleDataServer", "HYWarrior", "HYFight", "HYWorld", "HYHttpMgr", "Const", "DY"];
  var miss = [];
  for (var i = 0; i < names.length; i++) if (!R(names[i])) miss.push(names[i]);
  return miss.length ? ("缺失模块: " + miss.join(",")) : "全部模块可访问";
};
return M;
})();
