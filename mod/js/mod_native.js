/* =========================================================================
 *  荒野日记 (二代)  ——  内置 MOD v0.1
 *  载体: 追加在 project.mod.base.js 末尾 -> 加密为 project.jsc
 *  UI  : com.hymod.ModMenu (原生 Android View, 打包在 APK 内)
 *  通信: jsb.reflection.callStaticMethod("com/hymod/ModBridge","setMenu","(Ljava/lang/String;)V",json)
 *  基线: 0.0.8.070501 (hot)
 * ========================================================================= */
(function () {
  if (window.HYMOD && window.HYMOD.ver === "1.0.0") return;
  var M = window.HYMOD = { ver: "1.0.0", ready: false };

  /* ---------------- 模块访问 (require 是 project.js 顶部定义的全局) ---------------- */
  function R(name) {
    try {
      var rq = (typeof require !== "undefined" && require) ? require : (window.require || null);
      if (!rq) return null;
      return rq(name) || null;
    } catch (e) { return null; }
  }
  M.R = R;

  /* ---------------- 基础工具 ---------------- */
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

  /* ---------------- 配置 ---------------- */
  var cfg = {
    safeLog: true,        // 拦截 clientlog / DDREPORT 作弊上报
    noHotfix: true,       // 拦截热更(防止 MOD 被服务器覆盖)
    autoSave: true        // 修改后自动存档
  };
  ok(function () {
    var s = persistOn() ? cc.sys.localStorage.getItem("hymod_cfg2") : null;
    if (s) { var o = JSON.parse(s); for (var k in o) cfg[k] = o[k]; }
  }, "cfg");
  M.cfg = cfg;
  /* ---------------- 首选项持久化开关 ---------------- */
  function persistOn() { try { return cc.sys.localStorage.getItem("hymod_persist") === "1"; } catch (e) { return false; } }
  M.persist = persistOn();
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
  function saveCfg() { if (!M.persist) return; ok(function () { cc.sys.localStorage.setItem("hymod_cfg2", JSON.stringify(cfg)); }); }

  /* ---------------- 本地增益(不上传) ---------------- */
  var buff = {
    atkMul: 1, defMul: 1, hpMul: 1, lifeMul: 1,
    moveMul: 1, speedOn: false
  };
  M.buff = buff;

  /* ---------------- 安全层 ---------------- */
  var hooksInstalled = false;
  function installSafeHooks() {
    if (hooksInstalled) return;
    var HH = R("HYHttpMgr"), HC = R("HYCommon");
    if (!HH || !HC) return;
    hooksInstalled = true;

    /* 1) clientlog: 任何作弊上报的总开关 (也阻止 setCheat) */
    if (HH.clientlog) {
      var rawLog = HH.clientlog;
      HH.clientlog = function () {
        if (cfg.safeLog) { log("clientlog 已拦截: " + ok(function () { return JSON.stringify([].slice.call(arguments)).substr(0, 200); })); return; }
        return rawLog.apply(this, arguments);
      };
      log("已挂钩 HYHttpMgr.clientlog");
    }
    /* 2) logError: 过滤 REPORT_ERROR / 4015 相关上报 */
    if (HH.logError) {
      var rawErr = HH.logError;
      HH.logError = function (code, msg) {
        try {
          var s = String(code || "") + "|" + String(msg || "");
          if (cfg.safeLog && /REPORT_ERROR|RGE_|4015|cheat/i.test(s)) { log("logError 已拦截: " + s.substr(0, 160)); return; }
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
    if (HC.sealTip) {
      HC.sealTip = function (t) { log("sealTip 已拦截: " + t); };
      log("HYCommon.sealTip 已置空");
    }
    /* 5) alert 过滤 4015 弹窗 */
    if (HC.alert) {
      var rawAlert = HC.alert;
      HC.alert = function (title) {
        try {
          var s = String(title || "");
          if (s.indexOf("4015") >= 0) { log("已拦截封号弹窗: " + s); return; }
        } catch (e) {}
        return rawAlert.apply(this, arguments);
      };
      log("HYCommon.alert 4015 过滤已安装");
    }
    /* 6) DDREPORT: 本地错误上报改道(只打日志) */
    if (window.DDREPORT && cfg.safeLog) {
      var rawRep = window.DDREPORT;
      window.DDREPORT = function () {
        try { log("[DDREPORT拦截] " + [].slice.call(arguments).join(" ").substr(0, 300)); } catch (e) { rawRep.apply(this, arguments); }
      };
      log("window.DDREPORT 已改道");
    }
    /* 7) 热更拦截: checkUpdateInfo 伪造"无更新" */
    if (HH.checkUpdateInfo) {
      var rawChk = HH.checkUpdateInfo;
      HH.checkUpdateInfo = function (cb) {
        if (cfg.noHotfix) {
          log("热更检查已拦截 -> 伪造 EVENT_NO_UPDATE");
          try { cb && cb(!0, { errorCode: 0, data: { ver: "", event: "0" } }); } catch (e) { log("chk cb " + e); }
          return;
        }
        return rawChk.apply(this, arguments);
      };
      log("HYHttpMgr.checkUpdateInfo 已挂钩");
    }
    /* 8) base.cheat 清零 */
    ok(function () {
      var HD = R("HYData");
      var v = HD.get("base.cheat");
      if (v) { HD.set("base.cheat", 0); HD.trySave(); log("base.cheat 已清零 (原值 " + v + ")"); }
    }, "clearCheat");
  }
  M.installSafeHooks = installSafeHooks;

  /* ---------------- 去除本地封号校验 (_checkMainJs 等) ---------------- */
  var noBan = {};
  function installNoBanHooks() {
    try {
      if (!noBan.scenemain) {
        var cls = null;
        try { cls = cc.js && cc.js.getClassByName && cc.js.getClassByName("SceneMain"); } catch (e) {}
        if (cls && cls.prototype) {
          if (cls.prototype._checkMainJs) {
            cls.prototype._checkMainJs = function () { log("本地 main.js 校验已移除"); return !0; };
            noBan.scenemain = 1;
            log("SceneMain._checkMainJs 已覆写");
          }
        }
      }
      if (!noBan.scenemain2) {
        /* 兜底: 实例级覆盖(类名取不到时) */
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
    } catch (e) { log("installNoBanHooks " + e); }
  }
  M.installNoBanHooks = installNoBanHooks;

  /* ---------------- 物品 ---------------- */
  function itemList(cb) {
    var HP = R("HYProfile");
    if (!HP) { cb && cb([]); return; }
    HP.getAll("item", function (t) {
      var out = [];
      for (var k in t) out.push({ id: k, name: itemName(t[k]) });
      cb && cb(out);
    });
  }
  function itemName(p) {
    try {
      if (!p) return "";
      var s = p.name || p.id || "";
      var DY = R("DY");
      if (DY && DY.i18n && DY.i18n.t) { var tr = DY.i18n.t(s); if (tr) return tr; }
      return s;
    } catch (e) { return ""; }
  }
  function itemNameById(id) {
    var p = ok(function () { return R("HYItem").getItemProfile(id); });
    return itemName(p) || ("ID " + id);
  }
  function pickerItems() {
    var arr = [];
    ok(function () {
      var HP = R("HYProfile");
      var cur = HP.mProfiles && HP.mProfiles["item"];
      if (!cur) return;
      for (var k in cur) { var p = cur[k]; arr.push([ String(k), itemName(p) || String(k), p.icon || "" ]); }
    }, "pickerItems");
    return arr;
  }
  M.itemNameById = itemNameById; M.pickerItems = pickerItems;

  /** 发放物品: target = "bag" | "warehouse" */
  function giveItems(ids, count, target) {
    var HC = R("HYCommon"), Const = R("Const");
    if (!HC || !Const) { T("模块未就绪"); return; }
    var st = (target === "bag") ? Const.ITEM_DROP_STORAGE.bag : Const.ITEM_DROP_STORAGE.warehouse;
    var n = 0, done = 0, total = ids.length;
    if (!total) return;
    for (var i = 0; i < ids.length; i++) {
      (function (id) {
        var c = parseInt(count, 10) || 1;
        HC.changeItemNum(String(id), c, st, function () {
          done++;
          if (done === total) { T("已发放 " + total + " 种物品 x" + c); ok(function () { R("HYData").trySave(); }); }
        });
        n++;
      })(ids[i]);
    }
  }
  M.giveItems = giveItems;

  function grantCurrency(gold, silver) {
    var HC = R("HYCommon");
    if (!HC) return;
    if (gold) ok(function () { HC.updateDiamondNum(gold, !0, { type: "hycmod", reasonId: "hycmod" }, null); }, "gold");
    if (silver) ok(function () { HC.updateShellNum(silver, !0, { type: "hycmod", reasonId: "hycmod" }, null); }, "silver");
    T("已发放 金币+" + (gold || 0) + " 银币+" + (silver || 0));
  }
  M.grantCurrency = grantCurrency;

  /* ---------------- 控件状态记忆 (localStorage) ---------------- */
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

  /* ---------------- 菜单 ---------------- */
  function buildMenu() {
    var tabs = [];
    /* 1. 物品 */
    tabs.push({ title: "物品", items: [
      { type: "text", title: "物品发放(数量对所有选中物品生效)" },
      { type: "input", id: "all_cnt", title: "数量", val: String(pv("all_cnt", "99")), hint: "99" },
      { type: "button", id: "open_picker", title: "选择物品 -> 发放到仓库" },
      { type: "button", id: "open_picker_bag", title: "选择物品 -> 发放到背包" },
      { type: "button", id: "coin_add", title: "金币/银币 各 +99999" },
      { type: "text", title: "金币='金币'(5000) 银币='银币'(5001)" },
      { type: "text", title: "发放走游戏原生接口, 与正常获得一致" }
    ]});
    /* 2. 安全 */
    tabs.push({ title: "安全", items: [
      { type: "switch", id: "safeLog", title: "拦截作弊上报(clientlog)", val: sv("safeLog", true) },
      { type: "switch", id: "noHotfix", title: "拦截热更(防 MOD 被覆盖)", val: sv("noHotfix", true) },
      { type: "switch", id: "autoSave", title: "修改后自动存档", val: sv("autoSave", true) },
      { type: "button", id: "clear_flags", title: "清除作弊标记 (base.cheat=0)" },
      { type: "text", title: "本版已内置: 4015 弹窗过滤 / _checkMainJs 移除 / setCheat 置空" }
    ]});
    /* 3. 关于 */
    tabs.push({ title: "关于", items: [
      { type: "text", title: "荒野日记 MOD v" + M.ver },
      { type: "text", title: "基线: 0.0.8.070501 (OPPO 渠道)" },
      { type: "text", title: "悬浮球按住可拖动" }
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

  /* ---------------- 消息分发 ---------------- */
  function V(id) { return M.vals[id]; }
  function dispatch(id, val) {
    log("ON " + id + " = " + val);
    if (id === "open_picker" || id === "open_picker_bag") {
      var items = pickerItems();
      M.pickTarget = (id === "open_picker_bag") ? "bag" : "warehouse";
      bridge("openItemPicker", "(Ljava/lang/String;)V", jstr({
        title: "物品发放", count: String(pv("all_cnt", "99")), action: "grant", items: items
      }));
      return;
    }
    if (id === "coin_add") { grantCurrency(99999, 99999); return; }
    if (id === "clear_flags") {
      ok(function () {
        var HD = R("HYData");
        HD.set("base.cheat", 0); HD.trySave();
        T("作弊标记已清除");
      }, "clearflags");
      return;
    }
    if (id === "safeLog" || id === "noHotfix" || id === "autoSave") {
      cfg[id] = (val === "1" || val === true); saveCfg(); T(id + " = " + cfg[id]); return;
    }
    if (id === "all_cnt") { log("输入 all_cnt = " + val); return; }
    log("未处理的按钮 " + id);
  }

  window.HYMOD_ON = function (id, val) {
    try { M.vals[id] = val; saveVals(); dispatch(String(id), val); }
    catch (e) { log("HYMOD_ON " + id + " 出错: " + e); T("执行出错: " + e); }
  };
  window.HYMOD_PICK = function (json) {
    try {
      var o = JSON.parse(json);
      var ids = o.ids || [], cnt = parseInt(o.count, 10) || 99;
      if (!ids.length) { T("未选中物品"); return; }
      giveItems(ids, cnt, M.pickTarget || o.target || "warehouse");
    } catch (e) { log("HYMOD_PICK 出错: " + e); T("发放出错: " + e); }
  };
  window.HYMOD_UI_READY = function () {
    log("UI_READY -> 重新下发菜单");
    setTimeout(pushMenu, 60);
  };

  /* ---------------- 启动 ---------------- */
  function boot() {
    if (!R("HYData") || !window.cc || !cc.director || !cc.director.getScene || !cc.director.getScene()) {
      setTimeout(boot, 500); return;
    }
    installSafeHooks();
    installNoBanHooks();
    M.ready = true;
    log("MOD v" + M.ver + " 已加载 (原生菜单)");
    setTimeout(function () { pushMenu(); }, 400);
    setInterval(installNoBanHooks, 5000);
  }
  M.boot = boot;
  setTimeout(boot, 800);
})();
