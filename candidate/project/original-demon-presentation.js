'use strict';
// Generated verbatim predicates and frame synchronization from board_battle.js.
exports.prepare=function(combatant){
const flags={};const refs={enemyCard:{classList:{toggle(name,value){flags[name]=value;}}},enemyDemonName:{textContent:''}};
function isBlackTurnDemonEnemy(combatant = {}) {
    const key = String(combatant.key || combatant.id || "").trim();
    const name = String(combatant.name || combatant.displayName || "").replace(/\s+/g, "");
    const role = String(combatant.role || "").replace(/\s+/g, "");
    return key === "final_imu"
      || key.startsWith("final_black_turn_")
      || name.includes("黑轉支配")
      || role.includes("空白王座支配者")
      || role.includes("被伊姆支配");
  }
function isImuEnemy(combatant = {}) {
    const key = String(combatant.key || combatant.id || "").trim();
    const role = String(combatant.role || "").replace(/\s+/g, "");
    return key === "final_imu" || role.includes("空白王座支配者");
  }
function syncBlackTurnDemonFrame(combatant = null) {
    const active = isBlackTurnDemonEnemy(combatant || {});
    const imuActive = active && isImuEnemy(combatant || {});
    refs.enemyCard?.classList.toggle("black-turn-demon-active", active);
    refs.enemyCard?.classList.toggle("black-turn-imu-active", imuActive);
    if (refs.enemyDemonName) {
      refs.enemyDemonName.textContent = active ? (combatant?.name || "黑轉支配") : "";
    }
  }
syncBlackTurnDemonFrame(combatant);return {active:!!flags['black-turn-demon-active'],imu:!!flags['black-turn-imu-active'],name:refs.enemyDemonName.textContent};
};
