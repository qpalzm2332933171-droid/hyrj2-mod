(function () {
  var P = HYMOD.R("HYPlayer"), Prof = HYMOD.R("HYProfile"), DL = HYMOD.R("DYLoader"),
      C = HYMOD.R("Const"), HC = HYMOD.R("HYCommon");
  var pre = {};
  try { pre.hp1 = P.getState("hp", 1); pre.hp2 = P.getState("hp", 2); pre.hp3 = P.getState("hp", 3); } catch (e) {}
  HYMOD.buff.godMode = true; HYMOD.buff.oneHit = true;
  Prof.getById("stage", "6100003", function (s) {
    DL.loadPrefab("Fight/PanelFightLogV2", function (a, r) {
      try { HC.getCoreNode().addChild(r, HYMOD.R("DY").layer.UI_TIP); } catch (e) {}
      var comp = r.getComponent("PanelFightLogV2");
      comp.init(P.getExploringRoles(), s.monster, { atk: parseFloat(s.difficultyM[0]), hp: parseFloat(s.difficultyM[1]) },
        C.EnumFightType.FT_NORMAL,
        function (res) {
          var post = {};
          try { post.hp1 = P.getState("hp", 1); post.hp2 = P.getState("hp", 2); post.hp3 = P.getState("hp", 3); } catch (e) {}
          HYMOD.log("F3-END success=" + (res && res.success) + " maxDamage=" + (res && res.maxDamage) +
            " dmgTaken=" + JSON.stringify(res && res.hp) + " kill=" + JSON.stringify(res && res.kill) +
            " | pre=" + JSON.stringify(pre) + " post=" + JSON.stringify(post));
        },
        s, function () {}, function () {});
      HYMOD.log("F3 init ok monster=" + JSON.stringify(s.monster) + " buff god=" + HYMOD.buff.godMode);
    });
  });
})();
