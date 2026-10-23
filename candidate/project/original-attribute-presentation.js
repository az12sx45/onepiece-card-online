'use strict';
// Exact original presentation helpers; the native HUD supplies persistent nodes.
exports.prepare=function(view,override=null){
const pill={textContent:'',className:'',title:'',setAttribute(){}};
const refs={playerHudMeta:{querySelector(){return pill;}},matchupCurrent:{textContent:''},matchupChip:{title:''}},latestView=view;
function flashAttributeElement(){} // Native pulse uses the original CSS curve.
const ATTRIBUTE_ADVANTAGE = {
    "力": "技",
    "技": "速",
    "速": "力",
  };
function attributeClassName(attribute) {
    if (attribute === "力") return "attr-force";
    if (attribute === "速") return "attr-speed";
    if (attribute === "技") return "attr-tech";
    return "attr-neutral";
  }
function setAttributeLabel(element, attribute) {
    if (!element) return;
    const label = attribute || "無";
    element.textContent = label;
    element.title = label;
    element.setAttribute("aria-label", label);
    element.className = `pill attribute-pill ${attributeClassName(label)}`;
  }
function attributeModifier(attacker, defender) {
    if (!ATTRIBUTE_ADVANTAGE[attacker] || !ATTRIBUTE_ADVANTAGE[defender] || attacker === defender) return 1;
    return ATTRIBUTE_ADVANTAGE[attacker] === defender ? 2 : 0.5;
  }
function formatMultiplier(value) {
    const number = Number(value || 1);
    return Number.isInteger(number) ? `${number}` : String(number);
  }
function battleAttributeMatchup(view) {
    const provided = view?.attributeMatchup || {};
    const playerAttribute = provided.playerAttribute || view?.activeCard?.attribute || "無";
    const enemyAttribute = provided.enemyAttribute || view?.enemy?.attribute || "無";
    const playerAttackMultiplier = Number(provided.playerAttackMultiplier ?? attributeModifier(playerAttribute, enemyAttribute));
    const enemyAttackMultiplier = Number(provided.enemyAttackMultiplier ?? attributeModifier(enemyAttribute, playerAttribute));
    return {
      playerAttribute,
      enemyAttribute,
      playerAttackMultiplier,
      enemyAttackMultiplier,
    };
  }
function renderAttributeMatchup(view) {
    if (!refs.matchupChip || !refs.matchupCurrent) return;
    if (!view?.activeCard || !view?.enemy) {
      refs.matchupCurrent.textContent = "相剋";
      refs.matchupChip.title = "力克技，技克速，速克力";
      return;
    }
    const matchup = battleAttributeMatchup(view);
    refs.matchupCurrent.textContent = `x${formatMultiplier(matchup.playerAttackMultiplier)}`;
    refs.matchupChip.title = `我方 ${matchup.playerAttribute} → 敵方 ${matchup.enemyAttribute}：x${formatMultiplier(matchup.playerAttackMultiplier)}\n敵方 ${matchup.enemyAttribute} → 我方 ${matchup.playerAttribute}：x${formatMultiplier(matchup.enemyAttackMultiplier)}`;
  }
function playerDisplayAttribute(view) {
    return view?.attributeMatchup?.playerAttribute || view?.activeCard?.attribute || "無";
  }
function setPlayerAttributeDisplay(attribute, view = latestView) {
    const playerAttribute = attribute || "無";
    const enemyAttribute = view?.attributeMatchup?.enemyAttribute || view?.enemy?.attribute || "無";
    const playerMultiplier = attributeModifier(playerAttribute, enemyAttribute);
    const enemyMultiplier = attributeModifier(enemyAttribute, playerAttribute);
    const pill = refs.playerHudMeta?.querySelector(".attribute-pill");
    if (pill) {
      setAttributeLabel(pill, playerAttribute);
      flashAttributeElement(pill);
    }
    if (refs.matchupCurrent) refs.matchupCurrent.textContent = `x${formatMultiplier(playerMultiplier)}`;
    if (refs.matchupChip) {
      refs.matchupChip.title = `我方 ${playerAttribute} → 敵方 ${enemyAttribute}：x${formatMultiplier(playerMultiplier)}\n敵方 ${enemyAttribute} → 我方 ${playerAttribute}：x${formatMultiplier(enemyMultiplier)}`;
    }
  }
if(override!==null)setPlayerAttributeDisplay(override,view);else{setAttributeLabel(pill,playerDisplayAttribute(view));renderAttributeMatchup(view);}
return {attribute:pill.textContent,attributeClass:pill.className,matchup:refs.matchupCurrent.textContent,description:refs.matchupChip.title};
};
