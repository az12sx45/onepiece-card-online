'use strict';

const { frame, normalizeCosmeticFrameId } = require('./original-tot-stage');
const nikaRoot = 'images/board/battle/nika_frame/';
// The desktop battle builds these four layers separately from its shared frame catalog.
const nikaLayers = [
    { asset: nikaRoot + 'nika_cloud_left.webp', x: 7.5, y: 28, w: 52, h: 128, z: 5 },
    { asset: nikaRoot + 'nika_cloud_right.webp', x: 90, y: 56, w: 52, h: 128, z: 5, brightness: 1.02 },
    { asset: nikaRoot + 'nika_sun_glow.webp', x: 50, y: 51, w: 150, h: 122, z: 7, opacity: 0.74, blend: 'screen', pulse: true },
    { asset: nikaRoot + 'nika_card_frame.webp', x: 50, y: 48.5, w: 116, h: 116, z: 10, brightness: 1.02 },
];

function isNika(actor) {
    const tokens = [
        actor.id, actor.key, actor.cardId, actor.characterId, actor.formId, actor.formKey, actor.evolutionId, actor.evolutionKey,
        actor.baseId, actor.name, actor.displayName, actor.formName,
        actor.form?.id, actor.form?.key, actor.form?.name, actor.form?.displayName,
        actor.evolution?.id, actor.evolution?.key, actor.evolution?.name, actor.evolution?.displayName,
    ];
    return /luffy_gear_fifth|五檔|尼卡/.test(tokens.filter(Boolean).join('|').replace(/\s+/g, ''));
}

exports.prepare = function(actor, side) {
    const id = normalizeCosmeticFrameId(actor.cosmeticFrameId || actor.activeCosmeticFrameId || (side === 'enemy' ? actor.enemyCosmeticFrameId : ''));
    if (id === 'nikaFrame') {
        return side === 'player' && isNika(actor) ? { id, layers: nikaLayers, contain: true } : null;
    }
    const config = frame(id);
    if (!config) return null;
    const layers = Object.values(config.layers || {}).filter(layer => layer.asset).sort((a, b) => (a.z || 1) - (b.z || 1));
    return { id, showBaseFrame: config.showBaseFrame !== false, layers };
};
