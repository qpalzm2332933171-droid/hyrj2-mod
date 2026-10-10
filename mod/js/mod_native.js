/* =========================================================================
 *  荒野日记 (二代) —— 内置 MOD v0.3
 *  载体: 追加在 project.mod.base.js 末尾 -> 加密为 project.jsc
 *  UI  : com.hymod.ModMenu (原生 Android View, 打包在 APK 内)
 *  通信: jsb.reflection.callStaticMethod("com/hymod/ModBridge","setMenu","(Ljava/lang/String;)V",json)
 *  基线: 0.0.8.070501 (OPPO 渠道)
 *  原则: 优先 hook 返回值(纯本地不上传) > 走游戏原生接口; 绝不手写存档键
 * ========================================================================= */
(function () {
  if (window.HYMOD && window.HYMOD.ver === "1.0.3") return;
  var M = window.HYMOD = { ver: "1.0.3", ready: false };

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
        if (cfg.safeCoin && info && (info.type === "hycmod" || info.reasonId === "hycmod")) {
          log("saveCoinChange 已拦截 (MOD 发币)"); return;
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
    /* 11) base.cheat 清零 */
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

    function wrap(kind) {
      var K = HW[kind];
      if (!K || !K.createNew || K.__hymod) return;
      var raw = K.createNew;
      K.createNew = function (t, n) {
        var self = this;
        try {
          if (t) {
            if (buff.godMode) {
              var hp = t.hpMax || t.hp || 0;
              if (hp > 0) { t.hpMax = Math.ceil(hp * 50); t.hp = t.hpMax; }
              if (!(t.decHurt > 0)) t.decHurt = 0.75;
            }
            if (buff.oneHit) {
              t.atk = Math.ceil((t.atk || 1) * 50) + 50;
              t.crit = Math.max(t.crit || 0, 1);
              if (!(t.atkSp > 0)) t.atkSp = 1.5;
            }
          }
        } catch (e) { log("combat params " + e); }
        var w = raw.call(self, t, n);
        try {
          if (w && buff.godMode && !w.__hymodGod) {
            w.__hymodGod = 1;
            var rawAdd = w.addHP;
            if (rawAdd) w.addHP = function (d) { if (d < 0) return; return rawAdd.call(this, d); };
            var rawSet = w.setHP;
            if (rawSet) w.setHP = function (v) { if (v <= 0) return; return rawSet.call(this, v); };
          }
        } catch (e) { log("combat wrap " + e); }
        return w;
      };
      K.__hymod = 1;
      log("已挂钩 HYWarrior." + kind + ".createNew");
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
          if (buff.lockAttrs && delta < 0 && STATE_ATTRS[attr] && attr !== "hp") {
            return;
          }
        } catch (e) {}
        return raw.apply(this, arguments);
      };
      log("已挂钩 HYPlayer.updateState (锁四维)");
    }
    if (HP.isWeak) {
      var rawW = HP.isWeak;
      HP.isWeak = function () {
        if (buff.godMode) return false;
        return rawW.apply(this, arguments);
      };
      log("已挂钩 HYPlayer.isWeak");
    }
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
      var s = p.name || p.title || p.id || id;
      var DY = R("DY");
      if (DY && DY.i18n && DY.i18n.t) { var tr = DY.i18n.t(s); if (tr) return tr; }
      return String(s);
    } catch (e) { return "ID " + id; }
  }
  M.profiles = profiles; M.allProfiles = allProfiles;

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
      for (var k in (cur || {})) { var p = cur[k]; arr.push([String(k), nameOf("item", p, k), p.icon || ""]); }
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

  /* ================= 货币 ================= */
  function grantCurrency(gold, silver) {
    var HC = R("HYCommon");
    if (!HC) return;
    if (gold) ok(function () { HC.updateDiamondNum(gold, !0, { type: "hycmod", reasonId: "hycmod" }, null); }, "gold");
    if (silver) ok(function () { HC.updateShellNum(silver, !0, { type: "hycmod", reasonId: "hycmod" }, null); }, "silver");
    T("已发放 金币+" + (gold || 0) + " 银币+" + (silver || 0));
    if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
  }
  M.grantCurrency = grantCurrency;

  /* ================= 背包 / 仓库 ================= */
  function containers() {
    var HC = R("HYContainer");
    if (!HC) return null;
    var bag = ok(function () { return HC.getBagObj(); });
    var wh = ok(function () { return HC.getWareHouseObj(); });
    if (!bag || !wh) return null;
    return { bag: bag, wh: wh };
  }
  function bagToWarehouse() {
    var c = containers();
    if (!c) { T("容器未就绪"); return; }
    var n = 0;
    var all = ok(function () { return c.bag.getAllItemNotCheck(); }) || c.bag.mItems || {};
    for (var k in all) {
      var it = all[k];
      if (!it) continue;
      ok(function () { c.wh.addItem(it); c.bag.delItem(it); });
      n++;
    }
    T("已搬入仓库 " + n + " 件");
    if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
  }
  function clearBag() {
    var c = containers();
    if (!c) { T("容器未就绪"); return; }
    var ids = [], all = ok(function () { return c.bag.getAllItemNotCheck(); }) || c.bag.mItems || {};
    for (var k in all) ids.push(k);
    for (var i = 0; i < ids.length; i++) ok(function () { c.bag.delItem(ids[i], 999999); });
    T("背包已清空 (" + ids.length + " 件)");
    if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
  }
  function grantAllItems(count) {
    var cur = profiles("item");
    if (!cur) { T("物品表未就绪"); return; }
    var ids = [];
    for (var k in cur) ids.push(String(k));
    giveItems(ids, count, "warehouse");
  }
  M.bagToWarehouse = bagToWarehouse; M.clearBag = clearBag;

  /* ================= 科技 ================= */
  function techMaxAll() {
    allProfiles("technology", function (cur) {
      if (!cur) { T("科技表未就绪"); return; }
      var HT = R("HYTechnology");
      if (!HT) return;
      var best = {}, k;
      for (k in cur) {
        var p = cur[k] || {};
        var pid = String(p.productId || k.split("_")[0]);
        var key = String(p.id || k);
        var parts = key.split("_"), lv = parseInt(parts[1] || "1", 10) || 1, tid = parts[0];
        var gk = pid + "|" + tid;
        if (!best[gk] || lv > best[gk].lv) best[gk] = { lv: lv, pid: pid, tid: tid };
      }
      var n = 0;
      for (var g in best) {
        var b = best[g];
        ok(function () { HT.setTechnology(b.pid, b.tid + "_" + b.lv); n++; });
      }
      T("科技已全部拉满 (" + n + " 项)");
      if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
    });
  }

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

  /* ================= 成就 ================= */
  function achieveAll() {
    allProfiles("achievement", function (cur) {
      var HA = R("HYAchievement");
      if (!HA || !cur) { T("成就表未就绪"); return; }
      var n = 0;
      for (var k in cur) {
        (function (pr) { ok(function () { HA._handleSingle(pr, function () {}, 1e9); n++; }); })(cur[k]);
      }
      T("已推进 " + n + " 个成就至可领取");
      if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
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
    { type: "text", title: "数量对所有选中物品生效(发放/科技/建筑等通用)" },
    { type: "input", id: "all_cnt", title: "数量", val: String(pv("all_cnt", "99")), hint: "99" },
    { type: "button", id: "open_picker", title: "选择物品 -> 发放到仓库" },
    { type: "button", id: "open_picker_bag", title: "选择物品 -> 发放到背包" },
    { type: "button", id: "all_wh", title: "给仓库补发全部物品" },
    { type: "button", id: "bag_to_wh", title: "背包 -> 仓库 (全部搬入)" },
    { type: "button", id: "clear_bag", title: "清空背包" },
    { type: "button", id: "coin_add", title: "金币 +99999 / 银币 +99999" },
    { type: "text", title: "金币='金币'(5000)  银币='银币'(5001)  发放走游戏原生接口" }
  ]});

  /* ---- 角色 ---- */
  tabs.push({ title: "角色", items: [
    { type: "button", id: "role_all", title: "一键解锁全部角色" },
    { type: "button", id: "skin_picker", title: "选择皮肤并应用(全皮肤)" },
    { type: "text", title: "皮肤会绕过解锁条件直接应用; 角色解锁走游戏原生 RoleDataServer" }
  ]});

  /* ---- 状态 ---- */
  tabs.push({ title: "状态", items: [
    { type: "button", id: "refill", title: "一键回满 健康/饱食/精神/HP" },
    { type: "switch", id: "lockAttrs", title: "锁定状态(不再下降)", val: sv("lockAttrs", false) },
    { type: "button", id: "state_info", title: "查看当前角色状态" }
  ]});

  /* ---- 战斗 ---- */
  tabs.push({ title: "战斗", items: [
    { type: "switch", id: "godMode", title: "无敌(HPx50 + 免疫伤害)", val: sv("godMode", false) },
    { type: "switch", id: "oneHit", title: "一击必杀(攻击x50 + 必暴击)", val: sv("oneHit", false) },
    { type: "switch", id: "moveOn", title: "加速移动(队伍移速倍率)", val: sv("moveOn", false) },
    { type: "input", id: "moveMul", title: "移速倍率 (%)", val: String(pv("moveMul", "300")), hint: "300" },
    { type: "text", title: "只作用于我方单位(HYWarrior.PlayerWarrior), 纯本地不上传" }
  ]});

  /* ---- 科技 ---- */
  tabs.push({ title: "科技", items: [
    { type: "button", id: "tech_max", title: "一键科技全解锁(全产品拉满)" },
    { type: "text", title: "读取 technology 表, 每个科技按最高等级写入 setTechnology" }
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
    { type: "button", id: "achv_all", title: "一键全部成就推进到可领取" },
    { type: "button", id: "achv_picker", title: "选择成就 -> 单独推进" },
    { type: "text", title: "完成后去成就面板点领取即可 (上报已拦截)" }
  ]});

  /* ---- 图鉴 ---- */
  tabs.push({ title: "图鉴", items: [
    { type: "button", id: "atlas_all", title: "一键解锁全部图鉴" },
    { type: "text", title: "遍历 atlas 表所有分组写入 setAtlas" }
  ]});

  /* ---- 宠物 ---- */
  tabs.push({ title: "宠物", items: [
    { type: "button", id: "pet_all", title: "解锁宠物系统 + 获得全部宠物" },
    { type: "text", title: "宠物数量较多时可能需要几秒" }
  ]});

  /* ---- 商店 ---- */
  tabs.push({ title: "商店", items: [
    { type: "switch", id: "freePay", title: "免费购买(跳过货币/人民币结算)", val: sv("freePay", true) },
    { type: "button", id: "shop_picker", title: "选择商品 -> 免费购买" },
    { type: "text", title: "走 ModelShop.buyGoods(...,true) 即游戏自身的免费发放通道" },
    { type: "text", title: "!! 人民币礼包属于内购, 风险最高, 建议小号测试" }
  ]});

  /* ---- 信息 ---- */
  tabs.push({ title: "信息", items: [
    { type: "button", id: "world_info", title: "查看 天数/模式/副本/货币" },
    { type: "button", id: "diag", title: "模块自检(结果见提示/logcat)" },
    { type: "text", title: "天数与副本进度为只读显示(这两项由服务器校验, 不做修改)" }
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
  var o = { title: title, count: String(pv("all_cnt", "99")), action: mode, items: items || [], hideTarget: true };
  if (opts) for (var k in opts) o[k] = opts[k];
  bridge("openItemPicker", "(Ljava/lang/String;)V", jstr(o));
}
M.openPicker = openPicker;

function onPick(ids, count) {
  var n = parseInt(count, 10) || 1;
  switch (M.pickMode) {
    case "grant_wh": giveItems(ids, n, "warehouse"); break;
    case "grant_bag": giveItems(ids, n, "bag"); break;
    case "skin": applySkin(ids[0]); break;
    case "build": applyBuildLevel(ids, n); break;
    case "achv": applyAchievements(ids); break;
    case "shop": shopBuy(ids); break;
    case "role": applyRoles(ids); break;
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
        if (to > 0) { HB.updateBuildLevel(com, to); n++; }
      });
    });
  })(ids[i]);
  T("建筑已设置 (" + n + " 处)");
  if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
}
function applyAchievements(ids) {
  var HA = R("HYAchievement"), cur = profiles("achievement");
  if (!HA || !cur) return;
  var n = 0;
  for (var i = 0; i < ids.length; i++) (function (id) {
    var p = cur[id];
    if (!p) return;
    ok(function () { HA._handleSingle(p, function () {}, 1e9); n++; });
  })(ids[i]);
  T("已推进 " + n + " 个成就");
  if (cfg.autoSave) ok(function () { R("HYData").trySave(); });
}

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
    case "coin_add": grantCurrency(99999, 99999); break;
    /* 角色 */
    case "role_all": roleAll(); break;
    case "skin_picker": skinPickerItems(function (arr) { openPicker("skin", "选择皮肤(选中即应用)", arr, { single: true, okText: "应 用 皮 肤" }); }); break;
    /* 状态 */
    case "refill": refillAttrs(); break;
    case "state_info": T(stateInfo()); break;
    /* 科技/建筑/成就/图鉴/宠物 */
    case "tech_max": techMaxAll(); break;
    case "build_max": buildMaxAll(); break;
    case "build_repair": buildRepairAll(); break;
    case "build_picker": buildPickerItems(function (arr) { openPicker("build", "选择建筑(数量=等级)", arr); }); break;
    case "achv_all": achieveAll(); break;
    case "achv_picker": achievePickerItems(function (arr) { openPicker("achv", "选择成就(可多选)", arr); }); break;
    case "atlas_all": atlasAll(); break;
    case "pet_all": petAll(); break;
    /* 商店 */
    case "shop_picker": shopPickerItems(function (arr) { openPicker("shop", "选择商品(免费购买)", arr); }); break;
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
    if (id !== "all_cnt" && id !== "moveMul") { M.vals[id] = val; saveVals(); }
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
function boot() {
  if (!R("HYData") || !window.cc || !cc.director || !cc.director.getScene || !cc.director.getScene()) {
    setTimeout(boot, 500); return;
  }
  installSafeHooks();
  installNoBanHooks();
  M.ready = true;
  log("MOD v" + M.ver + " 已加载 (原生菜单)");
  log("模块自检: " + M.diag());
  setTimeout(function () { pushMenu(); }, 400);
  setInterval(function () { installSafeHooks(); installNoBanHooks(); }, 5000);
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
