import urllib.request, re
urls = ['https://one-piece.com/character/rebecca/','https://one-piece.com/character/Princess_Shirahoshi/','https://one-piece.com/character/smoker/','https://one-piece.com/character/perona/']
for u in urls:
    try:
        text=urllib.request.urlopen(u).read().decode()
        print(u)
        print('\n'.join(v for v in re.findall(r'<img[^>]+(?:src|data-src)=[\"\x27]([^\"\x27]+)',text) if '/uploads/' in v or 'character_' in v))
    except Exception as e:
        print(u, str(e))
