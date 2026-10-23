'use strict';
// Exact original phone regional fit. The adapter supplies native geometry.
exports.create=({document,visible,mark,WheelEvent})=>{
function fitInitialRoute(turn) {
    const { api, state, game, player } = turn;
    const viewport = document.getElementById('boardViewport'), map = document.getElementById('boardGameMap');
    const board = game?.boardData, camera = state?.panZoom;
    if (!viewport || !map?.offsetWidth || !board || !camera) return false;
    const island = id => api.getIslandById?.(id);
    const point = node => Number.isFinite(node?.pxX) && Number.isFinite(node?.pxY)
      ? { x: node.pxX, y: node.pxY } : null;
    const available = id => api.getAvailableRoutes?.(id, player) || [];
    const atSea = player.location?.kind === 'sea';
    const route = atSea ? api.getRouteById?.(player.location.routeId) : available(player.location?.islandId)[0];
    if (!route) return false;
    const fromId = atSea ? player.location.fromIslandId || route.from : player.location.islandId;
    const toId = route.from === fromId ? route.to : route.from;
    const from = island(fromId), to = island(toId), a = point(from), b = point(to);
    if (!a || !b) return false;
    // Read the actual runtime sea tiles, including original endpoint nudges.
    const tilesFrom = (item, id) => {
      const tiles = board.seaTiles.filter(tile => tile.routeId === item.id).sort((left, right) => left.index - right.index);
      return item.from === id ? tiles : tiles.reverse();
    };
    const incoming = { x: b.x - a.x, y: b.y - a.y }, length = Math.hypot(incoming.x, incoming.y) || 1;
    const continuation = available(toId).filter(item => item.id !== route.id).map(item => {
      const tiles = tilesFrom(item, toId), next = point(tiles[0]) || point(island(item.from === toId ? item.to : item.from));
      if (!next) return null;
      const dx = next.x - b.x, dy = next.y - b.y;
      return { route: item, tiles: tiles.slice(0, 3), score: (incoming.x * dx + incoming.y * dy) / (length * (Math.hypot(dx, dy) || 1)) };
    }).filter(Boolean).sort((left, right) => right.score - left.score)[0];
    const routeTiles = tilesFrom(route, fromId), furtherTiles = continuation?.tiles || [];
    const entries = [{ node: from, selector: '.island-node' }, { node: to, selector: '.island-node' },
      ...[...routeTiles, ...furtherTiles].map(node => ({ node, selector: '.sea-tile' }))];
    const view = viewport.getBoundingClientRect(), mapRect = map.getBoundingClientRect();
    const actualScale = mapRect.width / map.offsetWidth;
    if (!(actualScale > 0)) return false;
    const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (const entry of entries) {
      const p = point(entry.node);
      if (!p) return false;
      const node = [...map.querySelectorAll(entry.selector)].find(element =>
        Math.abs(parseFloat(element.style.left) - p.x) < 0.5 && Math.abs(parseFloat(element.style.top) - p.y) < 0.5);
      if (!node) return false;
      // Include original artwork that deliberately extends beyond its button.
      for (const painted of [node, ...node.querySelectorAll('.island-visual,.island-visual-art,.island-visual-img,.elbaph-island-visual')]) {
        const r = painted.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        bounds.left = Math.min(bounds.left, (r.left - mapRect.left) / actualScale);
        bounds.top = Math.min(bounds.top, (r.top - mapRect.top) / actualScale);
        bounds.right = Math.max(bounds.right, (r.right - mapRect.left) / actualScale);
        bounds.bottom = Math.max(bounds.bottom, (r.bottom - mapRect.top) / actualScale);
      }
    }
    // Preserve the regional two-island composition while giving it more sea.
    let safeTop = 12;
    for (const hud of document.querySelectorAll('#boardToolsToggle,#mapTurnBanner')) {
      if (visible(hud)) safeTop = Math.max(safeTop, hud.getBoundingClientRect().bottom - view.top + 8);
    }
    const safe = { left: 12, top: safeTop, right: view.width - 12, bottom: view.height - 156 };
    if (safe.right <= safe.left || safe.bottom <= safe.top || !Number.isFinite(bounds.left)) return false;
    const fit = .82 * Math.min(camera.scale, camera.maxScale,
      (safe.right - safe.left) / (bounds.right - bounds.left + 24),
      (safe.bottom - safe.top) / (bounds.bottom - bounds.top + 24));
    if (!(fit > 0)) return false;
    const centerX = (safe.left + safe.right) / 2;
    let centerY = (safe.top + safe.bottom) / 2;
    // Short landscape screens can use their actual unused top margin before
    // the enlarged corner helm. Preserve scale and every original art bound.
    const fittedTop = centerY - (bounds.bottom - bounds.top) * fit / 2;
    const upShift = view.height <= 340 ? Math.max(0, fittedTop - safe.top - 1) : 0;
    centerY -= upShift;
    // Only presentation camera state changes. The source wheel handler applies
    // its own .9 step, clampPan and applyPanZoom; no parallel DOM transform.
    // Lower this phone-only floor to the fitted region so the next manual
    // wheel/pinch does not jump back to the desktop .58 minimum.
    camera.minScale = Math.min(camera.minScale, fit);
    camera.scale = fit / 0.9;
    camera.x = centerX - (bounds.left + bounds.right) / 2 * camera.scale;
    camera.y = centerY - (bounds.top + bounds.bottom) / 2 * camera.scale;
    viewport.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 80,
      clientX: view.left + centerX, clientY: view.top + centerY }));
    mark('phoneMapCamera', 'regional');
    mark('phoneMapCameraRoute', route.id);
    mark('phoneMapCameraIslands', `${fromId}|${toId}`);
    mark('phoneMapCameraContinuation', continuation?.route.id || '');
    mark('phoneMapCameraFurtherTiles', furtherTiles.map(tile => tile.id).join('|'));
    mark('phoneMapCameraBounds', JSON.stringify(bounds));
    mark('phoneMapCameraSafe', JSON.stringify(safe));
    mark('phoneMapCameraFit', String(fit));
    mark('phoneMapCameraUpShift', String(upShift));
    mark('phoneMapCameraRegionTop', String(centerY - (bounds.bottom - bounds.top) * fit / 2));
    return true;
  }
return fitInitialRoute;
};
