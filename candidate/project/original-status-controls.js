'use strict';
// Exact original status renderer, with bounded control nodes and native details.
exports.create=function({Controls,changed=()=>{},details=()=>{}}){
const tree=Controls.create({changed,bounds(){throw Error('Native status geometry supplied by Godot');},extraEvents:['error']}),container=tree.addRoot('div');
const query=container.querySelectorAll.bind(container);container.querySelectorAll=selector=>selector==='.status-icon img'?query('img'):query(selector);
const window={};let latestView=null,signature='';const showStatusPopover=(trigger,detail)=>details(trigger.uid,detail);
const STATUS_ICON_INFO = {
    poison: { label: "中毒", file: "poison.webp" },
    burn: { label: "灼傷", file: "burn.webp" },
    bleed: { label: "流血", file: "bleed.webp" },
    freeze: { label: "冰凍", file: "freeze.webp" },
    paralyze: { label: "麻痺", file: "paralyze.webp" },
    bind: { label: "束縛", file: "bind.webp" },
  };
function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
function simpleEffectTitle(label = "", icon = "") {
    const text = String(label || "");
    const iconText = String(icon || "");
    const loweredIcon = iconText.toLowerCase();
    const persistentStatuses = ["poison", "burn", "bleed", "freeze", "paralyze", "bind"];
    if (/護盾|減傷|防壁|格擋/.test(text) || loweredIcon === "shield") return "傷害降低";
    if (/反彈|反制/.test(text) || loweredIcon === "reflect") return "反擊效果";
    if (/治療|回復/.test(text) || loweredIcon === "heal") return "生命回復";
    if (/先制/.test(text) || loweredIcon === "first") return "行動順序上升";
    if (/中毒|灼傷|流血|冰凍|麻痺|束縛/.test(text) || persistentStatuses.includes(loweredIcon)) return text || "特殊狀態";
    if (/蓄力|傷害加成|下一次攻擊|本次攻擊|追加.*傷害|高骰.*傷害/.test(text)) return "傷害上升";
    if (/易傷/.test(text) || loweredIcon === "damage_up") return "受傷上升";
    if (/封鎖/.test(text)) return "行動下降";
    const statName = text.match(/(攻擊|防禦|特攻|特防|戰術|意志|速度|命中|閃避|骰面)/)?.[1] || "";
    if (statName && (/[+＋↑]/.test(text) || /提升|強化/.test(text))) return `${statName}上升`;
    if (statName && (/[-－↓]/.test(text) || /下降|降低/.test(text))) return `${statName}下降`;
    const statFromIcon = iconText.match(/^(atk|def|satk|sdef|spd|accuracy|evasion)_(up|down)$/);
    if (statFromIcon) {
      const statLabel = {
        atk: "攻擊",
        def: "防禦",
        satk: "特攻",
        sdef: "特防",
        spd: "速度",
        accuracy: "命中",
        evasion: "閃避",
      }[statFromIcon[1]];
      return `${statLabel}${statFromIcon[2] === "up" ? "上升" : "下降"}`;
    }
    if (/[+＋↑]/.test(text) || /提升|強化/.test(text)) return "能力上升";
    if (/[-－↓]/.test(text) || /下降|降低/.test(text)) return "能力下降";
    return text || "效果";
  }
function simpleEffectDescription(detail = {}, icon = "") {
    const label = String(detail.label || "效果");
    const description = String(detail.description || "").trim();
    const loweredIcon = String(icon || detail.icon || "").toLowerCase();
    const persistentStatuses = ["poison", "burn", "bleed", "freeze", "paralyze", "bind"];
    if (/護盾|減傷|防壁|格擋/.test(label) || loweredIcon === "shield") return `${label}，本回合受到的傷害降低。`;
    if (/反彈/.test(label) || loweredIcon === "reflect") return `${label}，被攻擊時會反制或反彈傷害。`;
    if (/反制/.test(label)) return `${label}，被攻擊時會讓對手受到反制效果。`;
    if (/治療|回復/.test(label) || loweredIcon === "heal") return `${label}，回復生命值。`;
    if (/先制/.test(label) || loweredIcon === "first") return `${label}，行動順序暫時提前。`;
    if (/中毒|灼傷|流血|冰凍|麻痺|束縛/.test(label) || persistentStatuses.includes(loweredIcon)) {
      return description ? description.split(/[。.!！]/)[0] + "。" : `${label}狀態。`;
    }
    if (/蓄力|傷害加成|下一次攻擊|本次攻擊|追加.*傷害|高骰.*傷害/.test(label)) return `${label}，下一次或本次攻擊傷害提高。`;
    if (/易傷/.test(label) || loweredIcon === "damage_up") return `${label}，受到的傷害暫時增加。`;
    if (/封鎖/.test(label)) return `${label}，限制可使用的行動。`;
    const statName = label.match(/(攻擊|防禦|特攻|特防|戰術|意志|速度|命中|閃避|骰面)/)?.[1] || "";
    if (statName && description) return description.split(/[。.!！]/)[0] + "。";
    if (statName && (/[+＋↑]/.test(label) || /提升|強化/.test(label))) return `${label}，${statName}提高，持續到換下或瀕死。`;
    if (statName && (/[-－↓]/.test(label) || /下降|降低/.test(label))) return `${label}，${statName}降低，持續到換下或瀕死。`;
    if (/[+＋↑]/.test(label) || /提升|強化/.test(label)) return description ? description.split(/[。.!！]/)[0] + "。" : `${label}，能力提高，持續到換下或瀕死。`;
    if (/[-－↓]/.test(label) || /下降|降低/.test(label)) return description ? description.split(/[。.!！]/)[0] + "。" : `${label}，能力降低，持續到換下或瀕死。`;
    if (description) return description.split(/[。.!！]/)[0] + "。";
    return `${label}。`;
  }
function fallbackStatusIconData(icon = "", label = "") {
    const key = String(icon || "").toLowerCase();
    const known = ["bleed", "damage_up", "poison", "burn", "freeze", "paralyze", "bind", "shield", "reflect", "heal", "first"]
      .find((status) => key.includes(status));
    return known
      ? `images/board/battle/status_icons/${known}.webp`
      : "images/board/move_learn_ui/move_type_icons/status.webp";
  }
function renderStatusIcons(container, combatant = {}, side = "") {
    if (!container) return;
    if (window.TabletopPhoneBattleRender && !window.TabletopPhoneBattleRender.begin(container, "status-icons", [combatant, side, latestView?.battle?.playerDiceRoll, latestView?.battle?.enemyDiceRoll])) return;
    const diceFace = side === "player"
      ? Number(combatant?.effectDice || latestView?.battle?.playerDiceRoll || 0)
      : side === "enemy"
        ? Number(combatant?.effectDice || latestView?.battle?.enemyDiceRoll || 0)
        : 0;
    const details = Array.isArray(combatant?.effectDetails) ? combatant.effectDetails : [];
    const entries = details.length
      ? details
          .filter((detail) => detail?.iconUrl || STATUS_ICON_INFO[detail?.icon])
          .map((detail) => {
            const fallback = STATUS_ICON_INFO[detail.icon] || {};
            return {
              label: detail.label || fallback.label || detail.icon || "效果",
              title: simpleEffectTitle(detail.label || fallback.label || detail.icon || "效果", detail.icon),
              turns: Number(detail.turns || 0),
              badge: detail.badge || "",
              durationText: detail.durationText || "",
              icon: detail.icon || "",
              iconUrl: detail.iconUrl || `images/board/battle/status_icons/${fallback.file}`,
              type: detail.type || fallback.type || "",
              result: detail.label || fallback.label || detail.icon || "效果",
              description: simpleEffectDescription(detail, detail.icon),
            };
          })
      : Object.entries(combatant?.statuses || {})
          .filter(([key, turns]) => STATUS_ICON_INFO[key] && Number(turns || 0) > 0)
          .map(([key, turns]) => {
            const info = STATUS_ICON_INFO[key];
            return {
              label: info.label || key,
              title: info.label || key,
              turns: Number(turns || 0),
              badge: Number(turns || 0) > 0 ? String(Number(turns || 0)) : "",
              durationText: Number(turns || 0) > 0 ? `剩餘 ${Number(turns || 0)} 回合` : "",
              icon: key,
              iconUrl: `images/board/battle/status_icons/${info.file}`,
              type: info.type || "",
              result: `${info.label || key}${Number(turns || 0) > 0 ? ` ${Number(turns || 0)}回合` : ""}`,
              description: `${info.label || key}狀態。`,
            };
          });
    container.innerHTML = entries.map((entry) => {
      const badgeText = String(entry.badge || (entry.turns > 0 ? entry.turns : "") || "");
      const label = badgeText ? `${entry.label}${badgeText}` : entry.label;
      const badgeClass = String(badgeText).startsWith("-") || entry.type === "debuff" || entry.type === "control"
        ? "is-debuff"
        : String(badgeText).startsWith("+") || entry.type === "buff"
          ? "is-buff"
          : "";
      return `
        <button class="status-icon" type="button" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" data-effect-label="${escapeHtml(entry.title || entry.label)}" data-effect-result="${escapeHtml(entry.result || entry.label)}" data-effect-turns="${escapeHtml(entry.turns)}" data-effect-duration="${escapeHtml(entry.durationText || "")}" data-effect-dice="${escapeHtml(diceFace)}" data-effect-description="${escapeHtml(entry.description)}">
          <img src="${escapeHtml(entry.iconUrl)}" alt="" data-fallback-src="${escapeHtml(fallbackStatusIconData(entry.icon, entry.label))}">
          ${badgeText ? `<span class="status-icon-turns ${badgeClass}">${escapeHtml(badgeText)}</span>` : ""}
        </button>
      `;
    }).join("");
    container.querySelectorAll(".status-icon img").forEach((img) => {
      img.addEventListener("error", () => {
        const fallback = img.dataset.fallbackSrc;
        if (fallback && img.src !== fallback) img.src = fallback;
      }, { once: true });
    });
    container.querySelectorAll(".status-icon").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        showStatusPopover(button, {
          label: button.dataset.effectLabel,
          result: button.dataset.effectResult,
          turns: Number(button.dataset.effectTurns || 0),
          durationText: button.dataset.effectDuration || "",
          description: button.dataset.effectDescription,
        });
      });
    });
  }
function project(){return container.querySelectorAll('.status-icon').map(button=>({uid:button.uid,label:button.getAttribute('aria-label'),iconUrl:button.querySelector('img').getAttribute('src'),fallback:button.querySelector('img').dataset.fallbackSrc,badge:button.querySelector('.status-icon-turns')?.textContent||'',badgeClass:button.querySelector('.status-icon-turns')?.className||'',detail:{label:button.dataset.effectLabel,result:button.dataset.effectResult,turns:Number(button.dataset.effectTurns||0),durationText:button.dataset.effectDuration||'',description:button.dataset.effectDescription}}));}
return {refresh(actor={},side='',view=null){latestView=view;const next=JSON.stringify([actor.effectDice,actor.effectDetails,actor.statuses,side,view?.battle?.playerDiceRoll,view?.battle?.enemyDiceRoll]);if(next===signature)return;signature=next;renderStatusIcons(container,actor,side);},project,input(uid){tree.dispatch(uid,'click',{});},dispose(){tree.dispose();}};
};
