"""Per-card protected artwork windows. Coordinates are in the original 2:3 canvas.

Reviewed against all 80 original contact sheets on 2026-09-07. This is not a
character mask: BiRefNet provides that mask, separately intersected with these
windows. The outer card, numeric medallion and printed rules stay stationary.
"""
VARIANTS = {"normal": "images/cards", "enh": "images/cards/enh",
            "lux": "images/cards_lux", "lux-enh": "images/cards_lux/enh"}
BOTTOMS = {
    "normal": [.651,.603,.646,.613,.649,.675,.604,.623,.623,.557,
               .685,.717,.737,.685,.732,.695,.697,.646,.726,.725],
    "enh": [.488,.531,.511,.526,.545,.545,.568,.592,.579,.582,
            .936,.678,.659,.678,.652,.580,.649,.716,.690,.704],
    "lux": [.610,.610,.610,.613,.610,.632,.632,.632,.632,.632,
            .610,.610,.610,.610,.610,.644,.640,.640,.640,.640],
    "lux-enh": [.590,.590,.590,.677,.590,.675,.675,.679,.684,.677,
                .686,.686,.684,.685,.687,.692,.692,.685,.687,.692],
}

def recipe(variant, ident):
    bottom = BOTTOMS[variant][ident]
    badge = [.064,.038,.334,.230]
    if variant == "normal":
        polygon = [[.100,.067],[.920,.067],[.920,bottom],[.100,bottom]]
        crop = [.073,.043,.965,min(.97,bottom+.020)]
        if ident == 12:
            # Queen's left hand crosses the inner panel edge. Give the whole
            # hand one moving plane instead of leaving its fingertips behind.
            polygon = [[.100,.067],[.920,.067],[.920,bottom],[.100,bottom],
                       [.100,.66],[.060,.66],[.060,.405],[.100,.405]]
    elif variant == "enh":
        polygon = [[.115,.073],[.900,.073],[.900,bottom],[.115,bottom]]
        crop = [.075,.050,.947,min(.97,bottom+.025)]
        if ident == 10:
            # Rotated double-character scene: rules are a vertical left ribbon.
            polygon = [[.237,.070],[.910,.070],[.910,.930],[.237,.930]]
            crop = [.225,.055,.945,.948]
            badge = [.690,.042,.918,.244]
    elif variant == "lux":
        polygon = [[.315,.125],[.48,.112],[.685,.135],[.80,.205],
                   [.85,.30],[.85,.48],[.785,.575],[.675,.623],
                   [.31,.623],[.195,.56],[.135,.44],[.135,.30],[.20,.22],[.28,.22]]
        polygon = [[x,.112+(y-.112)*(bottom-.112)/(.623-.112)] for x,y in polygon]
        crop = [.085,.095,.917,min(.97,bottom+.040)]
    else:
        polygon = [[.295,.087],[.51,.081],[.78,.090],[.875,.153],
                   [.915,.245],[.915,bottom-.105],[.815,bottom-.015],
                   [.695,bottom],[.305,bottom],[.165,bottom-.035],
                   [.085,bottom-.130],[.085,.24],[.18,.215],[.285,.205]]
        crop = [.066,.060,.935,min(.97,bottom+.030)]
    # A false-negative hand in the general-lite pilot. Coordinates only, no art redraw.
    include = []
    if variant == "normal" and ident == 3:
        include = [[[.641,.430],[.689,.431],[.742,.489],[.744,.527],
                    [.704,.552],[.661,.514],[.634,.491]]]
    rotation = 0
    protect = []
    inference_clean = False
    if variant == "enh" and ident in (10,11,15):
        inference_clean = True
        if ident == 10:
            rotation = 90
            protect = [[[.224,.426],[.470,.420],[.490,.559],[.220,.564]],
                       [[.630,.414],[.903,.425],[.920,.567],[.625,.568]]]
        elif ident == 11:
            crop = [.080,.360,.780,.704]
        else:
            crop = [.095,.085,.910,.585]
    if variant == "lux-enh" and ident == 10:
        # Printed attack lettering is part of the fixed original, not the people.
        protect = [[[.380,.170],[.599,.155],[.664,.188],[.650,.310],
                    [.654,.370],[.585,.382],[.577,.328],[.405,.372],[.377,.356]],
                   [[.445,.422],[.531,.421],[.574,.436],[.602,.426],
                    [.676,.481],[.692,.526],[.639,.580],[.599,.606],
                    [.459,.596],[.376,.562],[.380,.519],[.421,.481]],
                   [[.070,.48],[.118,.525],[.158,.560],[.209,.585],
                    [.218,.615],[.251,.644],[.258,.682],[.070,.700]],
                   [[.927,.477],[.894,.505],[.862,.551],[.819,.589],
                    [.776,.600],[.754,.629],[.716,.644],[.708,.686],[.927,.700]]]
    return {"variant": variant, "id": ident, "source": VARIANTS[variant]+f"/{ident}.webp",
            "crop": crop, "window": polygon, "badge": badge, "include": include,
            "rotation": rotation, "protect": protect, "inference_clean": inference_clean,
            "review": "contact-sheet-layout-reviewed; segmentation-requires-separate-review"}

RECIPES = [recipe(variant, ident) for variant in VARIANTS for ident in range(20)]
