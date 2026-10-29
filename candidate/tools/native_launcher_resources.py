"""Omit unreachable browser Card presentation from explicitly native Card builds."""
import re

def native_card_web_bundle(data):
    text=data.decode('utf-8')
    pattern=re.compile(r'/\* Android presentation module: ([\w/-]+) \*/')
    markers=list(pattern.finditer(text))
    if not markers:raise ValueError('Bundled presentation module markers missing')
    retained=[text[:markers[0].start()]];removed=[]
    for i,match in enumerate(markers):
        name=match.group(1);end=markers[i+1].start() if i+1<len(markers) else len(text)
        if name.startswith('card-') or name=='vendor/card-interact':removed.append(name)
        else:retained.append(text[match.start():end])
    if not removed:raise ValueError('Expected native Card browser modules missing')
    return ''.join(retained).encode('utf-8'),removed
