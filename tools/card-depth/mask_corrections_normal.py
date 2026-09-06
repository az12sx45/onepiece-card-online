"""Manually reviewed alpha corrections for the normal card set.

Only the alpha matte is changed.  Coordinates are normalized against the
unchanged 1242 x 1863 card originals; no card pixels are painted or replaced.
This table is intentionally separate from ``mask_corrections.py`` until its
before/after and displaced-composite review has been accepted.
"""

CORRECTIONS = {
    "normal/4": {
        # BiRefNet retained only Chopper's viewer-left hoof.  Restore the
        # viewer-right leg/hoof, stopping above the painted ground shadow.
        "include": [
            [[.604, .574], [.621, .581], [.627, .598], [.652, .603],
             [.676, .611], [.686, .623], [.681, .635], [.665, .643],
             [.628, .641], [.606, .633], [.596, .620], [.596, .596]],
        ],
    },
    "normal/11": {
        # Remove the captured teal artwork-window slab behind Kid's hair,
        # fur and mechanical arm.  The edge follows the visible hair/fur
        # contour rather than cutting a rectangle through the character.
        "keep_components_min_area": 100000,
        "exclude": [
            [[.696, .147], [.684, .176], [.663, .194], [.663, .200],
             [.676, .201], [.651, .215], [.634, .218], [.633, .226],
             [.647, .235], [.656, .237], [.669, .237], [.685, .231],
             [.683, .243], [.693, .243], [.719, .237], [.714, .242],
             [.714, .249], [.783, .250], [.768, .258], [.768, .265],
             [.816, .271], [.800, .279], [.800, .285], [.841, .292],
             [.826, .297], [.826, .304], [.847, .311], [.834, .314],
             [.834, .321], [.842, .326], [.843, .331], [.862, .331],
             [.883, .339], [.894, .339], [.895, .162], [.890, .153],
             [.876, .147]],
            # Artwork-window top and right strokes lie outside the blue fill.
            [[.718, .140], [.910, .140], [.910, .164], [.718, .164]],
            [[.887, .150], [.910, .150], [.910, .350], [.887, .350]],
        ],
    },
    "normal/12": {
        # Restore the small weight/handle Queen is holding in his natural
        # hand, including its narrow cord.  It is part of the action pose,
        # not a detached scene fragment.
        "include": [
            [[.139, .565], [.150, .565], [.151, .620], [.142, .623]],
            [[.144, .612], [.159, .613], [.171, .624], [.176, .641],
             [.172, .657], [.159, .669], [.143, .667], [.131, .656],
             [.127, .639], [.131, .623]],
        ],
        # Remove the two blue artwork-window remnants: the narrow gap inside
        # the mechanical arm, and the larger U-shaped patch below the glove.
        "exclude": [
            [[.833, .462], [.811, .465], [.802, .462], [.791, .462],
             [.792, .503], [.777, .556], [.788, .556], [.800, .550],
             [.804, .544], [.800, .530], [.804, .524], [.804, .483],
             [.832, .471]],
            # Preserve the concavity around the glove's four fingers. This is
            # the reviewed blue-region contour, not its bounding rectangle.
            [[.789, .587], [.787, .587], [.777, .598], [.762, .607],
             [.754, .607], [.750, .602], [.748, .602], [.730, .618],
             [.726, .625], [.721, .630], [.719, .665], [.713, .692],
             [.820, .692], [.838, .688], [.845, .684], [.852, .676],
             [.855, .668], [.855, .641], [.843, .643], [.827, .648],
             [.813, .647], [.804, .650], [.796, .650], [.792, .648],
             [.787, .643], [.780, .644], [.775, .643], [.768, .637],
             [.771, .628], [.783, .617], [.787, .612], [.789, .607]],
            # The blue fill and its black rounded frame are separate colors;
            # remove the remaining right/bottom frame outside Queen's glove.
            [[.848, .650], [.866, .650], [.866, .674], [.858, .690],
             [.846, .702], [.704, .702], [.704, .686], [.838, .686],
             [.848, .674]],
            [[.855, .646], [.866, .646], [.866, .660], [.855, .660]],
        ],
    },
    "normal/16": {
        # The unwanted arc is a separate badge/scene component; Kuzan is the
        # only component above this reviewed threshold.
        "keep_components_min_area": 100000,
    },
    "normal/17": {
        # Three orange/black scene fragments belong to the separate badge
        # component. Teach, both hands and his clothing are one larger matte.
        "keep_components_min_area": 100000,
    },
}
