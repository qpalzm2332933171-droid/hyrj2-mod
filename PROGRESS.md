# 荒野日记(二代)直装 MOD — 开发进度

> 项目: `C:\Users\qpalz\Desktop\hyrj2_mod`
> 目标: 依据上代《荒野日记:孤岛》MOD 的完整经验, 为《荒野日记》(二代, OPPO 渠道 `com.dygame.hyrj.nearme.gamecenter`,
> APK 版本 0.0.7.0, 热更后 0.0.8.070501) 制作同款直装 MOD, 功能尽量全部实现, 重点: **防封号 + 去掉封号代码**。
> 更新: 每阶段结束写一次, 保证会话中断可接续。

## 一、环境 (本机)

| 项 | 值 |
|---|---|
| Python | 3.13.5, 已装 `xxtea` |
| Java | 25.0.1 (JDK) |
| Android SDK | `D:\Android\AndroidSDK` |
| adb | `D:\adb\platform-tools-latest-windows\platform-tools\adb.exe` |
| apktool | `work\apktool.jar` (从上一项目复制, v2.11 级) |
| 模拟器 | MuMu (Android 12, x86), 已装**新旧两个游戏**, 连接 `adb connect 127.0.0.1:16384`, 已 root |
| 上代参考项目 | `C:\Users\qpalz\Desktop\hyrj_mod\hyqs-island-mod-main` (含 README/PROGRESS/工具/Java UI/MOD JS) |

## 二、阶段 0: 侦察与源码提取 (✅ 已完成 2026-10-11)

1. APK 解包: `work/apk_dec` (apktool d -s, 保留原 dex), 包名 `com.dygame.hyrj.nearme.gamecenter`, 主 Activity `com.dygame.common.DYGame`
2. `assets/src/project.jsc` 用**同款 key** `ebf83d12-bc75-4b` 解密成功 → `game-source/project.dec.js` (3.89MB, 142273 行)
3. 设备热更版 (0.0.8.070501) 拉到 `work/device/project.hot.jsc` → 解密为 `game-source/project.hot.dec.js` (基线用此版本)
   - 0.0.7→0.0.8 diff 仅 ~166 行 (版本号/支付/实名/设置面板等小改), `work/analysis/diff_apk_hot.txt`
4. 热更目录: `files/<hash>/src/project.jsc` + `project.manifest` (版本 0.0.8.070501), `<hash>=c98759c9a82b24c176af027949f417b0`
5. 热更仅修改 2 个资源 JSON (已拉取到 `work/device/res_import/`): BootFake 场景 + PanelSetting 预制体
6. 配置表: `assets/res/raw-assets/resources/Profiles/*.txt` (88 个, 29.9MB, **加密**, 已导出到 `game-source/Profiles/`)
   - 游戏用自定义类型(base10 数字流)加密, 运行时由引擎/自定义 loader 解密; MOD 直接调 `HYProfile.getAll()` 拿运行时数据, 无需离线解密
7. 无独立 `art`; lib 只有 arm64-v8a/armeabi-v7a/armeabi/x86

## 三、阶段 1: 封号/反外挂机制分析 (✅ 已完成)

**新游戏的封号体系 (与上代区别很大):**

| 机制 | 位置 | 说明 |
|---|---|---|
| `base.cheat` 位掩码 | HYCommon.setCheat 44102 | account_cheat=1, modify_achieve=2, modify_mission=4, modify_activites=5, cheat_tick=8, cheat_enprice=16, cheat_deprice=32; 写存档并上传 |
| `HYHttpMgr.clientlog(type,...)` | 51121 | **任何调用都会先 setCheat(type) 再上传服务器** — 主要上报源 |
| 调用点 | 35113 cheat_enprice / 43330+50947 cheat_consume / 50159 cheat_tick / 122213 account_cheat / 77972 modify_achieve | |
| `_checkMainJs()` | 122209 | 读 main.js md5 与 `7d6dfe230ee6e39291c6738689b562fe` 比对, 不符 → clientlog("account_cheat") → 4015-1 |
| `sealTip(t)` | 44083 | 弹 "4015-t" 并**递归重弹** (本地循环弹窗) — 本版中似乎只在自身递归, 无外部调用(死代码), 但仍要屏蔽 |
| ACCOUNT_BANNED/ACCOUNT_CHEAT (4015/4015_1) | 42878-42887 | 错误码表, 走 alertError 弹窗 |
| `window.DDREPORT` | 33354 | 上报 "REPORT_ERROR:..." → HYHttpMgr.logError; 物品数据不一致等会触发 (46192) |
| `_checkIfCheat` | 78092 | 成就数据本地一致性校验 → clientlog("modify_achieve") |
| 时间作弊 | 50159 | cheat_tick + `DY.cache.ignoreTimeCheat` 由服务器下发 |
| 热更 | `HYHttpMgr.checkUpdateInfo` (50506) + `_tryCheckUpdate` (80766) + jsb.AssetsManager | 热更会覆盖 project.jsc → 必须防覆盖 |
| 上传协议 | `updateData` 50765 | `sign = md5("apsdfAJOJ(#@&($0809283JLJOOJ" + base64(modify) + uid)`, 与上代同一 secret |
| 存档框架 | `HYData.set/get/trySave/sendToServer` (46477+) | 与上代一致 (点路径) |

**防封方案 (v1):**
1. hook `HYHttpMgr.clientlog` → 直接 return (不 setCheat、不上报)
2. hook `HYHttpMgr.logError` → 过滤 REPORT_ERROR/4015 关键字
3. hook `HYCommon.setCheat` → 置空 no-op
4. boot 时把 `base.cheat` 清零并 trySave (解封已有标记)
5. hook `SceneMain._checkMainJs` → 恒 return true
6. hook `HYCommon.sealTip` → no-op; `HYCommon.alert` 过滤标题含 "4015" 的弹窗
7. hook `HYHttpMgr.checkUpdateInfo` → 伪造 "无更新" (EVENT_NO_UPDATE="0") 防热更覆盖
8. ModProvider 每次启动把 MOD 版 project.jsc 覆盖回 files/<hash>/src/ (同上一代)
9. 物品操作走游戏自带 API (container.addItems + trySave) 保证内存/存档一致, 避免 DDREPORT

## 四、阶段 2: 系统 API 摸底 (✅ 已基本完成)

**核心类/模块 (project.hot.dec.js 行号):**

| 模块 | 行 | 关键 API |
|---|---|---|
| HYData | 46477 | set/get/setRelative/clear/trySave/sendToServer/getCurMode(STORY/ENDLESS/MAZE) |
| HYPlayer | 54370 | getState(attr,role)/getStateRatio/isWeak/getRoleList/getFightParams/_RoleFightParams/getMaxLoad/getTeamBaseSpeed/getTeamSpeed/updateRoleAttr; 角色状态键 `core.role.<idx>.<attr>`(+`Max`), travelSp=移速 |
| HYContainer | 45909 | HYBag / HYWarehouse (容器实例); 存 STORY=`base.bag.itemInfo`/`base.warehouse`, ENDLESS/MAZE=`core.bag`/`core.warehouse` |
| HYItem | 51805 | create(id,cnt)/createItems({id:cnt})/load/getItemProfile/getEquipProfile/isLock/unlockOneItem; 物品实例带 getId/getCount/getWeight/duration |
| HYCommon | 42758 | changeItemNum(id,±n,storage,cb)/addItemNum/readuceItemNum/addItemById/getItemNum/updateDiamondNum(±)/updateShellNum(±)/changeGlobalItemNum/alert/toast/sealTip/setCheat/restartGame/transitionTo/getDungeonScore |
| HYProfile | 55566 | getById(key,id,cb)/getAll(key,cb)/cloneById/getByIdDirect; key: item/equip/technology/role/skin/monster/achievement/atlas/build/... |
| HYTechnology | 56683 | setTechnology(pid,"id_sub")/getTechnology(pid)/getMaxLevel/getCurLevel/techProduct/techItem/techFight/buyScript; 存 `base.technology.product.<pid>.<id>` |
| HYTime | 57034 | day()/time()/hour()/minute()/update(秒)/speedUpTime/isPaused/lockPause |
| HYBuild | 42170 | updateBuildLevel/unlockBuild/getBuildLevel/isBuildUnlock/getBuildDuration/addBuildDuration/addDurantionMax |
| HYAchievement | 40346 | decode/encrypt/_set/getTotalScore |
| PetMgr | 116238 | gainPet/carryPet/treatPet/getAllPets/getUnlockedPets/getCarriedPet/unlockPetSystem |
| HYStat | 56137 | 各类统计数据 setXxx/getDailyStats/setDailyStats/setAtlas(图鉴)/addItemCnt |
| ModelShop | 75418 | addGoodsToPlayer/buyGoods/getShopBag/isBuyGood/(商品发奖总入口) |
| HYHttpMgr | 50492 | login/updateData/tryPay/checkOrder/addMail/queryMail/updateMail/clientlog/logError... |
| DYIAPMgr | 33844 | pay/init/getPrice/getCheckingOrder |
| HYFight | 49906 | fight/createBattle/createNew (战斗创建) |
| HYSkillBuff | 55933 | getFightBuff/addBuff/upateAttrs |
| HYWarrior | 57688 | createNew (甲人/战斗单位工厂) |
| Const | 3477 | ITEM_DROP_STORAGE{warehouse:1,bag:2,...}, ITEM_ID{GOLD_COIN:5000,SILVER_COIN:5001,ALL_CAMP_REPUTATION:5200,Technology_Script:9000,Learn_Ticket:9001}, EnumGameMode, AchieveCategory, ROLE_INFO_TAB... |
| 全局 | | `window.DDLOG/DDINFO/DDERROR/DDREPORT`; `require=function e(...)` 顶层全局赋值 → MOD 用 `require("HYData")` 拿模块 |

**模块获取方式:** 二代不挂 window.HYData/dy; MOD 代码用全局 `require(name)` (project.js 第一行 `require = function e(...)` 隐式全局)。

## 五、待办清单 (按顺序)

1. [x] 构建工具链适配 (config/build_mod/build_dex/build_apk/patch_manifest/dev_push/js_call) — 全部跑通
2. [x] mod_native.js v0.1: 安全层 + 菜单框架 + 基础功能 (物品/货币), 模拟器实测启动
3. [x] v0.2/v0.3 功能扩展: 物品/角色/状态/战斗/科技/建筑/成就/图鉴/宠物/商店/安全 (13 tabs, v1.0.3)
4. [~] Java UI 适配 ✅ / 物品图标提取脚本 ⏳
5. [~] dist/荒野日记_MOD.apk 已产出并实测直装 ✅ / v1.0.3 重打包回归 ⏳
6. [ ] 文档 (README/docs) + 发版

## 六、重要文件路径

```
work/apk_dec/                     apktool 解包工程 (assets/src/project.jsc 为替换目标)
work/device/                      设备拉取 (project.hot.jsc / project.manifest / res_import/)
work/analysis/                    分析脚本与输出 (g.py=通用检索器: python g.py <pat> [before] [after] [limit])
game-source/project.hot.dec.js    基线源码 (0.0.8, 打包用)
game-source/project.dec.js        0.0.7 源码 (对照用)
game-source/Profiles/*.txt        88 个配置表 (加密原样)
mod/js/mod_native.js              MOD 主体 (待写)
mod/java/com/hymod/*.java         Java UI (已从上一代复制, 通用)
```

---

## 七、阶段 3: 工具链 + 直装 APK 打通 (✅ 已完成 2026-10-11)

1. 新增 `mod/tools/patch_manifest.py` (复制上一代) → 已给 apk_dec 的 AndroidManifest.xml 插入
   `<provider com.hymod.ModProvider authority=com.dygame.hyrj.nearme.gamecenter.hymod>`
2. 新增 `mod/tools/build_apk.py` (改造: BASE_JS=project.mod.base.js, 产物 dist/荒野日记_MOD.apk)
3. `python mod/tools/build_dex.py` → work/mod_java/dex/classes.dex (39KB) 通过
4. `python mod/tools/build_apk.py` → **dist/荒野日记_MOD.apk (104MB) 签名打包成功**

### 实机验证 (MuMu 127.0.0.1:16384) — 全部通过
- **JS 快速通道**: 直接 adb push 解密后的 project.jsc 到
  `/data/data/com.dygame.hyrj.nearme.gamecenter/files/c98759c9a82b24c176af027949f417b0/src/project.jsc`
  (先用 org 官方包验证)→ logcat 出现 `[HYMOD] 已挂钩 ...` 全系列 + `MOD v1.0.0 已加载`, 游戏正常进标题页。
  → 说明 **不需要重打包 APK 就能迭代 JS**, 用 `python mod/tools/build_mod.py --deploy` + push 即可 (秒级)。
- **直装 APK**: `pm uninstall`(先 tar 备份数据到 /sdcard/hymod_bak/) → `adb install dist/荒野日记_MOD.apk`
  → 还原 /data/data 数据 (chown 10080:10080 + restorecon) → 启动:
  - `ModProvider init ok` / `copyModJs overwrite 1 file(s)` (自动把 APK 内 project.jsc 覆盖回热更目录)
  - `ModMenu attached on DYGame` (悬浮球 "M" 显示在屏幕左上)
  - JS 安全层全部挂钩, `setMenu tabs=3` 菜单成功下发到原生 UI
- 截图: work/build/shot2.png (悬浮球可见, 数据未丢)

### 迭代命令速查
```powershell
python mod\tools\build_mod.py --check --deploy      # JS 语法+打包
adb push work\build\project.jsc /data/local/tmp/hymod_project.jsc
adb shell su -c "cp /data/local/tmp/hymod_project.jsc <热更dir>/src/project.jsc"
adb shell am force-stop com.dygame.hyrj.nearme.gamecenter; adb shell am start -n .../DYGame
adb logcat -d | Select-String HYMOD
```

---

## 八、GitHub 仓库 (✅ 2026-10-11)

- 地址: **https://github.com/qpalzm2332933171-droid/hyrj2-mod** (public, main 分支)
- 收录: `mod/`(MOD JS + Java UI + 工具链)、`docs/analysis-scripts/`(59 个逆向分析脚本与输出)、
  `game-source/`(解密脚本 + 配置表)、README/NOTICE/LICENSE/PROGRESS
- 排除(见 .gitignore): `work/`(430MB 解包与构建中间物)、`dist/`(100MB MOD APK)、`*.apk`(原包 104MB)
  → 均为可复现产物, 按 README「三、构建」重新生成即可
- 新增工具 `mod/tools/decrypt_apk_js.py` (解 APK 内 jsc + `--hot` 从设备拉热更版)
- 提交: 167 files, 41.3MB

---

## 九、阶段 4: mod_native.js v1.0.3 功能实现 + 实测 (✅ 2026-10-11)

### 架构
- `R(name)` 模块缓存 (30 个模块全部可访问); `allProfiles(key,cb)` **异步**加载配置表;
  `profiles()` 同步快路径。表懒加载: 仅 `item`(385)/`technology`(540)/`equip`(54) 在 mProfiles,
  其余 role=54/skin=8/pet=15/shop=55/atlas=5组/build=59/achv=63 必须走 `HYProfile.getAll(key,cb)`。

### 功能实测 (T5/T6, 局内 Dungeon 场景, 经 `js_call.py` 验证)
| 功能 | 结果 |
|---|---|
| 物品发放 changeItemNum | 11517→11522 ✅ |
| 货币 updateDiamondNum | 5314→6314 ✅ |
| 科技 setTechnology | 136 个产品组 ✅ |
| 状态回满 refillAttrs | health/hunger/mentality 100/100 ✅ |
| 图鉴 setAtlas | 5 组 256 项 ✅ |
| 成就 _handleSingle | 45 条 / 105 分 ✅ |
| 角色解锁 RoleDataServer.addToDisplay | 30+ 个 ✅ |
| 宠物 petAll / 商店 shopBuy | 待补测 (T6 输出被截断) |

### 安全层 (开机日志确认全部挂钩)
clientlog / logError / setCheat / sealTip / alert+alertError(4015) / DDREPORT / checkUpdateInfo /
saveCoinChange / updateData(safeUpdate) / _reportAchieve / SceneMain._checkMainJs / base.cheat 清零

### 战斗/移速 hook
HYWarrior.PlayerWarrior+Pet.createNew (无敌/一击必杀)、HYPlayer.getTeamBaseSpeed/getTeamSpeed (移速)、
HYPlayer.updateState (锁四维)、isWeak

### 调试双通道 (无需重打包)
- `python mod\tools\dev_push.py` — 打包 + push 热更目录 + 重启 + 抓 [HYMOD] 日志 (35 秒/轮)
- `python mod\tools\js_call.py "代码"` / `--file X.js` — 走 ModProvider `content call --method js64`,
  su 通道在游戏进程执行任意 JS 并回传 Bundle, **自动化验证唯一手段**
- ModProvider 智能跳过: 热更目录 jsc 比 APK 新(>1s)则不覆盖, dev_push 版本可存活重启

### 实测直装
ModProvider init ok / 悬浮球 "M" (贴屏幕左边缘, 不穿透面板) / 菜单 13 tabs /
`pm uninstall` + tar 备份还原数据不丢

### 未完成 (下一步)
1. 补测宠物 `PM.getNumPet()` / 商店 shopBuy; T7: 建筑 buildMaxAll、皮肤 applySkin、成就选择器、
   锁四维 lockAttrs、无敌/一击必杀(需战斗场景)、移速
2. `mod/tools/extract_icons.py` 从 APK 图集抽 `assets/hymod/icons/<id>.png`
3. v1.0.3 重打包 dist/荒野日记_MOD.apk + 回归 (重装: pm uninstall + tar 备份还原, 或 install -r)
