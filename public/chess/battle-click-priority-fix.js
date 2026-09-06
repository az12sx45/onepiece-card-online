(() => {
  const install = () => {
    const scene = window.__BATTLE_CHESS__?.game?.scene?.scenes?.[0];
    if (!scene) return false;
    if (scene.__pieceClickPriorityFixInstalled) return true;

    const baseIsEmptyLegalTarget = scene.isEmptyLegalTarget.bind(scene);
    scene.isEmptyLegalTarget = function isEmptyLegalTargetWithPiecePriority(square) {
      const pointer = this.input?.activePointer;
      if (this.selectedSquare && pointer) {
        const legalPieceHit = this.input.hitTestPointer(pointer).some((gameObject) => {
          const targetSquare = gameObject.getData?.('square');
          return typeof targetSquare === 'string'
            && this.pieces.has(targetSquare)
            && this.legalMoves.some((move) => move.to === targetSquare);
        });
        if (legalPieceHit) return false;
      }
      return baseIsEmptyLegalTarget(square);
    };

    scene.__pieceClickPriorityFixInstalled = true;
    return true;
  };

  if (install()) return;
  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    if (install() || Date.now() - startedAt > 5000) window.clearInterval(timer);
  }, 25);
})();
