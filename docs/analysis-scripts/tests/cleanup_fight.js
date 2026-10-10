(function () {
  var DM = HYMOD.R("HYDialogMgr");
  var out = [];
  try {
    var d = (DM && DM.mDialogDict) || {};
    for (var k in d) out.push(k);
    var p = d["PanelFight"];
    if (p) {
      var node = p.node || p;
      var db = node.getComponent && node.getComponent("DialogBase");
      if (db && db.closeDialog) { db.closeDialog(); out.push("DialogBase.closeDialog"); }
      else if (node.destroy) { node.destroy(); out.push("node.destroy"); }
      DM.delDialog && DM.delDialog("PanelFight", true);
    } else { out.push("no PanelFight"); }
  } catch (e) { out.push("err " + e); }
  console.log("[HYMOD] cleanup " + out.join(" | "));
})();
