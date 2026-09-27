# 1.2.2 independent room presentation review

**PASS_WITH_NOTES — no blocking visual issue in the inspected captures.**

## What was actually inspected

Individually opened ten final popup screenshots: owner desktop, owner 390px, details, available work choices, visitor, editor, owner 320px, reduced motion 320px, right-edge left flip, and 320x500 short viewport. Opened all four desktop room scenes, the ten-character editor, and eight character contact strips containing 32 actual Chromium furniture-direction captures. These are real image inspections, not conclusions drawn only from assertion counts.

- Compact owner popup: all six icon/text actions, name and affinity are legible; details and available-station choices fit. A nearby character may temporarily be behind the panel.
- Viewport handling: the right-edge actor receives a left-side popup; 390px and 320px views keep the popup horizontally within the viewport. At 320x500, the full five-need detail card and close control remain visible with a small bottom margin. Such a small screen necessarily devotes much of the viewport to open details.
- Visitor: only the detail action is visible, with no work, gift, call or train controls. The automated fixture separately records zero writes.
- Furniture editor: popup is dismissed; grid, footprint and furniture rotation label remain clear. View/editor actor scale is consistent.
- Four scenes: rear adults are smaller than front adults, the door is slightly taller than an adult at that depth, kitchen counter and movable table surfaces are appropriate for the figures, the refrigerator is around one adult high, and library shelves do not tower over the crew. No new body/head separation is introduced by the 1.5 scale.
- Thirty-two contacts: Sanji's pan/cooktop, Brook's hands/keyboard, Jinbe's hands/wheel, builders' tools/workbench, Chopper's low medicine shelf, Nami's chart/table and Robin's book/shelf align plausibly. Feet remain at their ground roots. This reviews representative rendered contact poses in all four rotations; it is not a claim of new human animation playtesting.

## Nonblocking limits and observed occlusion

1. The small room-name badge can cover a front-left character's feet; Zoro in the edge fixture demonstrates this. It is a UI overlap, not sprite cropping.
2. The open popup can cover a nearby character or the BGM area. It is temporary and closable; no claim is made that every figure remains unobstructed.
3. Chopper at medicine-cabinet rotation 2 and Robin behind the rotated bookshelf remain partly hidden by the furniture back. Their side face/body and feet stay visible. This follows the room's depth ordering.
4. Sunny deck/library far-floor art starts roughly 26 screenshot pixels earlier than the shared grid. The accepted background plates are unchanged; rear actors do not visibly penetrate the wall. Foreground grid remains on the wooden floor.
5. Existing 128 life atlases/512 frames and full-body/walk art are immutable. Four drawn action frames remain a limited motion cycle, not a 3D simulation.
6. Chromium fixtures and model visual inspection do not establish physical-phone, live-account, network multiplayer or human fan/playtest acceptance. No new paid purchase was performed for this review.

## Verification architecture and evidence

The unchanged 1.2.1 life validator was run against exact historical runtime Git blobs at b9210988b1b6fd6054ce8dfe65b6ddbd9b0f75ea. All 133 current asset files and their source/prompt/receipt/review dependencies were read from the current tree and passed original SHA assertions. No old life-v1 manifest, validator or review was edited. The original exact formal Board distribution variant and patch/readback evidence remain required.

The new presentation review separately binds all 22 current runtime files, the final popup report, four-scene/editor images, 32-contact report/strips and this review. The final popup report has four passed scenarios and identical starting/completed source hashes; those captured source hashes were verified against current files at review freeze. The historical art generation stays 1.2.0, while the required desktop package version is 1.2.2.

An additional Brook/piano actual-renderer run against the final frozen runtime passed; all ten captured runtime source hashes were identical before/after and matched current files. Its four timed screenshots are samples of a running loop, not a claim that each screenshot is locked to a different animation frame. The previously reviewed 32 contact-direction views remain the visual coverage for scale.

Focused validator tests passed 21/21, including rejection of draft status, incomplete scenario coverage, changed runtime hashes, changed evidence, incorrect viewport metadata, and arbitrary formal variants. Test fixtures are outside the release evidence and explicitly are not visual acceptance.
