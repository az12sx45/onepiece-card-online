# Independent final room visual review — 1.1.16

## Result: PASS WITH NOTES

Completed independent visual review of **all16 final scene screenshots**: four room themes × desktop view/edit and390px mobile left/right. Also viewed the accepted front-row scale sheet, eight Sanji/Brook interaction closeups, and enlarged floor-corner/front-edge crops. The latest request concerns oversized scenery/furniture; accepted character art, walk and dialogue remain preserved.

No production code, art or deployment was changed by this review. This is local integrated browser/screenshot acceptance, not a claim of physical-device testing or published deployment.

## Checks

| Check | Result | Observed evidence |
|---|---|---|
| Accepted adult scale | PASS | Existing front adult72–76stagepx and rear49–51 references retained; near/far characters consistent in all4 scenes. Chopper/Franky/Brook/Jinbe differences preserved. |
| Furniture proportion | PASS | Helm now1.00H overall with centre.61H; map worktop.43H; bookshelf1.13H; chest.59H. Integrated rooms no longer place tiny people among adult-sized boxes/wheels. |
| Bases and shadows | PASS | Bases sit on one floor plane, including bookcase and medicine-cabinet root correction; observed interaction feet do not float. Shadows are modest and attached. |
| Door and fixed cabinet size | PASS | New modest doors and rear built-ins remain in the requested70–95stagepx door gate. No giant foreground desk, barrel, sofa or mast. |
| Perspective | PASS | All4 scenes use elevated cutaway view and downward ocean water, compatible with the editable floor. Low horizon is removed. |
| Floor / grid agreement | PASS WITH NOTE | Grid front crosses a wood-board seam slightly in3 scenes; it remains on a continuous flat wooden surface. See detailed assessment below. |
| Table hands | PASS | All4 Sanji contact closeups viewed. Side views meet the table region; cloche hides exact rear-view centre. Actor faces correct working side and remains grounded. |
| Piano hands | PASS WITH NOTE | Brook faces keyboard side in4 rotations; rear panel correctly occludes hands/keys. Uses preserved generic focused_use; not a dedicated fingering animation. |
| Mobile | PASS | Viewed all8 left/right390px captures. Both scene edges reachable by internal room panning. Harness reports `pans:true`, `overflow:0` for all4; page itself does not overflow. |
| Default/new scene loading | PASS | Actual `roomScene.src` and successful image decode establish all4 room-only v2 assets. Default no longer uses the shared giant tabletop image. |

## Front-edge assessment requested by parent

Reviewed each full desktop edit image, then enlarged the front centre, front-left and back-left corners in `independent-boundary-detail.png`.

- **Crew cabin:** grid bottom is about11 screenshot pixels below the interior plank/apron seam, roughly9stagepx. Below the seam is a broad flat wood apron continuing to the image bottom. There is no raised front wall, vertical drop or water under the grid. Piano feet are supported by visible wood.
- **Sunny deck:** the dark horizontal plank seam is approximately13 screenshot pixels above the last grid line, about11stagepx. The same floor timber continues below it. The grid remains inside the wood surface rather than extending into the ocean or rail.
- **Sunny kitchen:** floor timber continues directly toward the bottom with no interior/front-apron seam. The side-wall foot ends slightly earlier, but the grid remains inside the widening wood platform. No blocked grid corner observed.
- **Sunny library:** grid bottom is roughly10 screenshot pixels below the plank/apron seam, about8stagepx. This is again continuous flat wood. No unsupported object or actor is visible.

These are **minor art alignment differences, not a current off-floor or floating-object failure**. The scene's painted plank seam is not the physics boundary. Do not change the established FLOOR projection or saved placements merely to chase this decorative seam. The top-left enlargements also show the grid follows usable floor beside/after the wall base; the kitchen counter does not block placed cells.

## Scene-specific observations

- **Crew cabin:** clear empty floor, compact doorway and Straw Hat flag; fixed cabin architecture now relates to character height. Default no longer reads as people standing on a giant desk.
- **Sunny deck:** small room props and cast share a scale. Sunny lion/sun prow is visible beyond the rear wall and never occupies the playable floor. It is a noticeable themed backdrop, not a usable object or oversized foreground furniture.
- **Sunny kitchen:** modest rear galley/icebox leaves the active floor clear. Counter front appears a little higher than the28stagepx prompt target (about32–34), but remains proportionate and does not dominate the characters. This fixed decoration is outside the foreground furniture contact paths.
- **Sunny library:** shallow rear shelves sit behind the playable area; purchased bookshelf and tree retain coherent miniature scale. No baked large couch/tree intrudes into the room floor.

## Evidence and limits

- Final sources inspected: `final-scenes/{crew-cabin,sunny-deck,sunny-kitchen,sunny-library}-{desktop-view,desktop-edit,mobile-left,mobile-right}.png` — all16 individually viewed using `view_image`.
- Closeups: `scale-runtime/kitchen-table-r0..3-sanji/contact-detail.png` and `scale-runtime/piano-r0..3-brook/contact-detail.png` — all8 viewed.
- Additional images: `agreed-front-row-square-root.png`, `independent-boundary-detail.png`, prior corrected showcase view/edit/mobile and full profile integrated1440 capture.
- Reports read: `geometry-audit.md/json`, `scale-runtime/report.json`, `room-browser-final/report.json`, `final-scenes/report.json`.
- `final-scenes/report.json` shows all4 expected image URLs decoded,6 furniture/6 actors, unchanged room data, no image/runtime errors, and mobile panning without page overflow. These are supporting harness results; this agent did not independently rerun the browser tests.
- The earlier `room-browser-final/failure.json` reflects an obsolete base-size assertion and is superseded by the successful latest `report.json`; the parent also corrected an earlier scene check to read the actual image source rather than CSS background.
- Mobile is intentionally a pannable room; not every object is simultaneously shown at390px. Actual touch hardware was not tested here.
- Final screenshot hashes and individual check results are recorded in `independent-final-visual-review.json`.

No blocking visual issue remains within the requested background/furniture scale scope in the reviewed candidate.
