(function () {
  var P = HYMOD.R("HYPlayer");
  var s = [];
  try { s.push("hp1=" + P.getState("hp", 1)); } catch (e) { s.push("e1=" + e); }
  try { s.push("hp2=" + P.getState("hp", 2)); } catch (e) {}
  try { s.push("hp3=" + P.getState("hp", 3)); } catch (e) {}
  console.log("[HYMOD] PRE-A " + s.join(" | "));
})();
