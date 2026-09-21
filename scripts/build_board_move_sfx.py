"""Build short, attributed Board move sounds from the existing Taira Komori library.

Read-only input library. All derived files and provenance go to --output.
Requires the existing D:/批次去背/.venv Python (numpy) and ffmpeg on PATH.
"""
import argparse, hashlib, json, math, re, subprocess, wave
from pathlib import Path
import numpy as np

RATE = 44100
SOURCE_PUBLIC = Path(__file__).resolve().parents[1] / 'public'
if not (SOURCE_PUBLIC/'js/board_cards.js').exists():
    SOURCE_PUBLIC = Path('D:/Codex_Release_Worktrees/board-voyage-records-v1/public')
AUTHOR = 'Taira Komori / 小森平'
LICENSE_URL = 'https://taira-komori.net/freesounden.html'
PREVIEW = [
    {'id':'luffy_pistol','name':'橡膠手槍','power':45,'category':'physical','attribute':'格鬥'},
    {'id':'zoro_onigiri','name':'鬼斬','power':60,'category':'physical','attribute':'斬擊'},
    {'id':'nami_thunderbolt','name':'雷電天候','power':70,'category':'special','attribute':'雷'},
    {'id':'ace_fist','name':'火拳','power':80,'category':'special','attribute':'火'},
    {'id':'usopp_lead','name':'鉛星','power':35,'category':'physical','attribute':'射擊'},
    {'id':'preview_heal','name':'治癒之光','power':0,'category':'status','effects':{'healSelf':30}},
    {'id':'preview_shield','name':'屏障防禦','power':0,'category':'status','effects':{'shield':True}},
]

# Exact artwork families encode the physical action/material, independently of
# words in a move name (rubber bazooka is not a firearm or a fire attack).
FAMILY_STYLES = {}
def families(ids, physical, kind=None):
    for identity in ids.split(): FAMILY_STYLES[identity]=(physical,kind or physical)
families('rubber_pistol rubber_barrage rubber_bazooka rubber_giant rubber_nika','punch','rubber')
families('punch_impact flower_limbs','punch')
families('armament_fist','punch','shockwave')
families('heavy_slam stone_crush','metal','stone')
families('kick_sweep','kick')
families('horn_charge sword_thrust','pierce')
families('blade_single blade_cross blade_barrage','slash')
families('wind_blade','slash','wind')
families('purple_enma cursed_blade','slash','dark')
families('red_haki_slash','slash','shockwave')
families('haki_burst quake_crack paw_wave','punch','shockwave')
families('fire_fist fire_stream fire_orb fire_dragon','punch','fire')
families('fire_kick','kick','fire')
families('blue_fire','pierce','bluefire')
families('lightning_bolt storm_cloud','punch','lightning')
families('lightning_claw','pierce','lightning')
families('ice_spikes','pierce','ice')
families('ice_blade','slash','ice')
families('ice_domain','punch','ice')
families('magma_fist','punch','magma')
families('magma_meteor','cannon','magma')
families('water_fist','punch','water')
families('water_wave','punch','water')
families('sand_blade','slash','sand')
families('sand_vortex sand_erosion','punch','sand')
families('smoke_fist smoke_bind','punch','smoke')
families('room_cut gamma_blade','slash','space')
families('string_slash string_cage','slash','string')
families('petal_blade','slash','petal')
families('love_arrow petrify_heart','slingshot','love')
families('metal_arm','metal','metal')
families('magnetic_railgun','laser','lightning')
families('laser_ray gold_beam','laser','light')
families('light_blade','slash','light')
families('light_kick','kick','light')
families('bullet_shot','bullet')
families('cannon_blast','cannon','explosion')
families('bomb_burst','cannon','explosion')
families('poison_dragon poison_cloud','punch','poison')
families('dark_vortex ghost_burst vampire_swarm','punch','dark')
families('shadow_claw','pierce','dark')
families('demon_music','punch','demon_music')
families('song_wave','punch','music')
families('bubble_swarm','punch','bubble')
families('wax_weapon wax_cage','pierce','wax')
families('plant_spear plant_wolf','slingshot','plant')
families('forest_roots thorn_cage','pierce','plant')
families('gravity_meteor gravity_field','metal','gravity')
families('chain_whip','slash','chain')
families('mochi_fist','punch','mochi')
families('mochi_spear','pierce','mochi')
families('gold_fist gold_bind','metal','gold')
families('heal_glow heal_dandelion','punch','heal')
families('guard_shield','punch','shield')
families('speed_dash','punch','speed')
families('focus_sight power_aura','punch','buff')
families('weaken_mist','punch','debuff')
families('silence_field','punch','silence')
families('blue_fire_kick','kick','bluefire')
families('spring_coil','punch','rubber')
families('finger_pierce','pierce')
families('air_shockwave','punch','shockwave')
families('fire_blade','slash','fire')
families('fire_bird','slingshot','fire')
families('diamond_impact','metal','ice')
families('jaw_bite','pierce','stone')
families('door_portal','punch','space')
families('delay_beam','laser','space')

def call(args, input=None):
    p = subprocess.run(args, input=input, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if p.returncode: raise RuntimeError(p.stderr.decode('utf-8','replace'))
    return p.stdout

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

class Library:
    def __init__(self, root): self.root, self.cache = root, {}
    def get(self, name):
        if name not in self.cache:
            pack, leaf = name.split('/')
            relative = f'audio/board_game/sfx/{pack}/{pack}/{leaf}.mp3'
            path = self.root / relative
            raw = call(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ac','1','-ar',str(RATE),'pipe:1'])
            signal = np.frombuffer(raw,dtype='<f4').copy()
            self.cache[name] = (signal, {'source':relative,'sourceSha256':sha(path),'sourceDuration':round(len(signal)/RATE,6),'author':AUTHOR})
        return self.cache[name]

def has(text, pattern): return bool(re.search(pattern,text,re.I))

def classify(move, family=None):
    identity = str(move.get('id') or move.get('moveId') or '')
    name = str(move.get('name') or move.get('moveName') or identity)
    effect = move.get('effects') or {}
    text = ' '.join([identity,name,str(move.get('attribute','')),str(move.get('effectText','')),json.dumps(effect,ensure_ascii=False)])
    role = str(move.get('category') or move.get('type') or '').lower()
    power = float(move.get('power') or 0)
    damage = power > 0 or bool(move.get('isDamage'))
    if role in ('status','輔助','變化','support') and power <= 0: damage=False
    # Actual move power wins over healing/drain/buff keywords on damaging moves.
    if not damage:
        if role=='heal' or has(text,r'heal|recover|治[癒療]|回復|恢復|再生|療傷|生命|復活|tear|tears'): kind='heal'
        elif role=='shield' or has(text,r'shield|guard|barrier|protect|防禦|防守|屏障|結界|鐵塊|護盾|守護|防護|block'): kind='shield'
        elif has(text,r'poison|毒'): kind='poison'
        elif role in ('debuff','control') or has(text,r'debuff|sleep|paraly|confus|fear|降低|催眠|麻痺|恐懼|消極|減速|封印|挑釁|negative|taunt|dark|ghost'): kind='debuff'
        elif has(text,r'room|空間|shambles|交換|warp'): kind='space'
        else: kind='buff'
        if family in ('heal_glow','heal_dandelion'):kind='heal'
        if family=='guard_shield':kind='shield'
        if family=='silence_field':kind='silence'
        if family=='speed_dash':kind='speed'
        return {'role':'support','kind':kind,'physical':None,'power':power,'heavy':False,'multi':False,'family':family}
    if family:
        if family not in FAMILY_STYLES: raise ValueError(f'No authored sound material for family {family}')
        physical,kind=FAMILY_STYLES[family]
        if physical=='bullet' and (identity.startswith('usopp_') or move.get('characterId')=='usopp'):physical='slingshot';kind='slingshot'
        multi=bool(effect.get('multiHit')) or family in ('rubber_barrage','blade_barrage')
        return {'role':'attack','kind':kind,'physical':physical,'power':power,'heavy':power>=85 or family in ('rubber_giant','heavy_slam','gravity_meteor','magma_meteor','stone_crush'),'multi':multi,'family':family}
    # Physical anatomy and weapon separate from the elemental sound tail.
    if identity.startswith('usopp_') and not has(text,r'hammer|鎚|錘|衝擊貝'): physical='slingshot'
    elif has(text,r'laser|雷射|railgun|電磁炮|電磁砲|beam|光束'): physical='laser'
    elif has(text,r'rocket|missile|火箭|飛彈|砲彈|炮彈|cannon'): physical='cannon'
    elif has(text,r'kick|踢|腳|sanji_|whip|鞭|stamp|mouton|mutton|concasse'): physical='kick'
    elif has(text,r'zoro_|tashigi_|oden_|killer_|kinemon_|cavendish_|mihawk_|slash|blade|sword|斬|劍|刀|刃|鐮'): physical='slash'
    elif has(text,r'bullet|射擊|子彈|corazon_shot|gunshot'): physical='bullet'
    elif has(text,r'pierce|spear|stab|claw|horn|指槍|刺|矛|角|爪'): physical='pierce'
    elif has(text,r'metal|kid_|franky_|jitte|鎚|錘|棍|鈍|鐵|鋼'): physical='metal'
    else: physical='punch'
    if has(text,r'fire|flame|magma|diable|flambage|entei|火|炎|熔岩|燒'): kind='fire'
    elif has(text,r'ice|frost|freeze|snow|brook_frost|冰|寒|雪|凍'): kind='ice'
    elif has(text,r'lightning|thunder|electro|electric|雷|電'): kind='lightning'
    elif has(text,r'poison|venom|毒'): kind='poison'
    elif has(text,r'water|jinbe_|fishman|海流|水|魚人'): kind='water'
    elif has(text,r'dark|ghost|soul|perona_|影|暗|幽靈|靈魂|黃泉'): kind='dark'
    elif has(text,r'wind|storm|tornado|twister|dragon_|風|嵐|龍捲'): kind='wind'
    elif has(text,r'room|gamma|shambles|law_|空間|伽瑪'): kind='space'
    elif has(text,r'gravity|fujitora_|重力'): kind='gravity'
    elif has(text,r'explosion|bomb|炸|爆|火藥'): kind='explosion'
    elif has(text,r'shock|震|衝擊|rokuogan|六王槍|kuma_'): kind='shockwave'
    else: kind=physical
    multi=has(text,r'gatling|barrage|combo|storm|連打|連擊|連射|機關|亂打|多段|multi|sanzen|ashura')
    return {'role':'attack','kind':kind,'physical':physical,'power':power,'heavy':power>=85,'multi':multi,'family':family}

def layer(source, duration, gain=1.0, delay=0.0, pitch=1.0, selection='onset', reverse=False):
    return dict(source=source,duration=duration,gain=gain,delay=delay,pitch=pitch,selection=selection,reverse=reverse)

def recipe(style, move):
    kind,physical=style['kind'],style['physical']
    # No impacts are attached to support moves.
    support={
        'heal':[layer('magic01/fairies1',.85,.65,selection='peak'),layer('magic01/voice_of_light',.9,.35,delay=.12,selection='peak')],
        'shield':[layer('magic01/reflection',.62,.8),layer('magic01/sword1',.7,.28,delay=.1)],
        'poison':[layer('magic01/bubble_attack2',.72,.7,pitch=.8),layer('horror01/mental_attack1',.7,.22,selection='peak')],
        'debuff':[layer('magic01/dark_magic1',.9,.7,selection='peak'),layer('magic01/vanishing1',.55,.25,delay=.2)],
        'space':[layer('magic01/warp1',.85,.7,selection='peak'),layer('magic01/magic_waves4',.8,.3,delay=.1)],
        'buff':[layer('magic01/magic_waves1',.85,.6),layer('magic01/reflection',.6,.25,delay=.2,pitch=1.15)],
        'speed':[layer('attack01/kungfu_wind2',.45,.65),layer('magic01/vanishing1',.38,.3,delay=.05)],
        'silence':[layer('magic01/vanishing2',.55,.4,pitch=.8,selection='peak')]}
    if style['role']=='support': return {'cast':support[kind],'hit':[]}
    heavy=style['heavy']; mult=style['multi']; pitch=.92 if heavy else 1.04
    sources={
        'punch':('attack01/swish1_2','attack01/heavy_punch3' if heavy else 'attack01/middle_punch1'),
        'kick':('attack01/kungfu_wind2','attack01/kick2' if heavy else 'attack01/kick1'),
        'slash':('jidaigeki01/extract_sword1','jidaigeki01/cut_with_sword3' if heavy else 'jidaigeki01/cut_with_sword2'),
        'pierce':('attack01/swish1_3','jidaigeki01/stab_lightly'),
        'slingshot':('jidaigeki01/Shuriken1','attack01/knocking_a_wall'),
        'bullet':('arms01/mini_bomb1','attack01/short_punch1'),
        'cannon':('arms01/launcher1','arms01/small_explosion2'),
        'laser':('arms01/laser_beam2','sf01/electric_shock2'),
        'metal':('attack01/swing2','sf01/g_robot_punch1')}
    wind,impact=sources[physical]
    cast=[layer(wind,.36,.78,pitch=pitch)]
    hit=[layer(impact,.6 if heavy else .46,.9,pitch=pitch,selection='onset')]
    if mult:
        hit=[layer(impact,.26,.72,delay=delay,pitch=pitch+idx*.035) for idx,delay in enumerate([0,.105,.225])]
    tails={
        'fire':layer('magic01/fire3',.95,.7,delay=.025,selection='peak'),
        'ice':layer('magic01/sword1',.88,.7,delay=.02,pitch=1.2,selection='peak'),
        'lightning':layer('sf01/electric_shock2',.82,.7,delay=.015,selection='peak'),
        'water':layer('magic01/bubble_attack1',.86,.72,delay=.02,selection='peak'),
        'poison':layer('magic01/bubble_attack2',.82,.6,delay=.04,pitch=.8,selection='peak'),
        'dark':layer('magic01/dark_magic2',.94,.68,delay=.025,pitch=.95,selection='peak'),
        'wind':layer('attack01/kungfu_wind4',.73,.7,delay=.05,pitch=.96),
        'space':layer('magic01/magic_waves4',.9,.62,delay=.025,pitch=.95,selection='peak'),
        'gravity':layer('magic01/rumble_of_earth',1.04,.68,delay=.025,pitch=.8,selection='peak'),
        'explosion':layer('arms01/small_explosion3',.92,.8,delay=.02,pitch=.9,selection='peak'),
        'shockwave':layer('sf01/ele_shock_wave',.92,.62,delay=.015,pitch=.86,selection='peak')}
    tails.update({
        'rubber':layer('attack01/swish2_1',.32,.26,delay=.02,pitch=.8),
        'bluefire':layer('magic01/fire2',.9,.64,pitch=1.15,selection='peak'),
        'magma':layer('magic01/submarine_magma',1.1,.7,pitch=.82,selection='peak'),
        'sand':layer('horror01/horror_wind',.88,.5,pitch=1.2,selection='peak'),
        'smoke':layer('horror01/white_noise1',.7,.35,pitch=.8,selection='peak'),
        'string':layer('jidaigeki01/extract_sword2',.65,.45,pitch=1.25),
        'petal':layer('magic01/fairies2',.76,.3,pitch=1.15,selection='peak'),
        'love':layer('magic01/reflection',.78,.65,pitch=1.1),
        'light':layer('arms01/laser_beam1',.77,.65,pitch=1.1),
        'music':layer('playing01/guitar3',.95,.65,pitch=1.0),
        'demon_music':layer('anime01/s_c_dulcimer1',1.02,.65,pitch=.8),
        'bubble':layer('magic01/bubble_attack2',.9,.65,pitch=1.15),
        'wax':layer('magic01/bubble_attack1',.64,.36,pitch=.67),
        'plant':layer('jidaigeki01/dig_for_stone',.66,.42,pitch=1.08,selection='peak'),
        'stone':layer('magic01/rumble_of_earth',.97,.56,pitch=.95,selection='peak'),
        'chain':layer('jidaigeki01/sword_fight1',.7,.48,pitch=.95,selection='peak'),
        'mochi':layer('magic01/bubble_attack2',.6,.27,pitch=.72),
        'gold':layer('sf01/gear_rotation1',.9,.48,pitch=1.15,selection='peak')})
    if kind in tails:
        hit.append(tails[kind])
        cast.append(layer(tails[kind]['source'],.33,.24,pitch=1.1,selection='peak',reverse=True))
    if physical=='slingshot':
        hit.append(layer('jidaigeki01/Shuriken2',.24,.32,pitch=1.3))
    # Rubber projectiles keep a rising/falling air snap rather than gunshot textures.
    if kind=='rubber' or str(move.get('id','')).startswith('luffy_'):
        cast.append(layer('attack01/swish2_1',.26,.3,pitch=1.22,reverse=True))
    # Pure beams, songs, clouds and spell fields should not contain a flesh punch.
    if style.get('family') in ('air_shockwave','fire_stream','fire_orb','fire_dragon','storm_cloud','ice_domain','water_wave','sand_vortex','sand_erosion','smoke_bind','string_cage','petrify_heart','poison_cloud','dark_vortex','demon_music','song_wave','bubble_swarm','gravity_field','gold_bind','silence_field') and kind in tails:
        hit=[tails[kind]]
    return {'cast':cast,'hit':hit}

def extract(signal, spec):
    target=max(16,int(spec['duration']*RATE)); pitch=spec['pitch']
    needed=min(len(signal),int(target*pitch))
    env=np.abs(signal)
    if len(env)==0: raise ValueError('empty source')
    threshold=max(.001,float(env.max())*.035)
    active=np.flatnonzero(env>threshold)
    start=max(0,int(active[0])-int(.004*RATE)) if len(active) else 0
    if spec['selection']=='peak':
        # Center the highest-energy region in the slice, with 25ms attack headroom.
        window=min(int(.06*RATE),len(signal))
        energy=np.convolve(np.square(signal),np.ones(window)/window,'same')
        peak=int(np.argmax(energy))
        start=max(start,peak-int(.05*RATE))
    start=min(start,max(0,len(signal)-needed))
    chunk=signal[start:start+needed].copy()
    if spec['reverse']: chunk=chunk[::-1].copy()
    if pitch!=1 and len(chunk)>1:
        chunk=np.interp(np.arange(min(target,int(len(chunk)/pitch)))*pitch,np.arange(len(chunk)),chunk).astype(np.float32)
    chunk=chunk[:target]
    # Per-source normalization makes fixed recipe mix levels meaningful.
    peak=float(np.max(np.abs(chunk))) if len(chunk) else 0
    if peak: chunk=chunk*(.72/peak)
    attack=min(int(.004*RATE),len(chunk)//4); release=min(int(.065*RATE),len(chunk)//3)
    if attack: chunk[:attack]*=np.linspace(0,1,attack)
    if release: chunk[-release:]*=np.linspace(1,0,release)**1.4
    return chunk*spec['gain'], round(start/RATE,6)

def render(library, specs, path, wav_dir):
    signal=np.zeros(int(1.5*RATE),dtype=np.float32); refs=[]; end=0
    for spec in specs:
        raw,provenance=library.get(spec['source'])
        chunk,start=extract(raw,spec)
        offset=int(spec['delay']*RATE); count=min(len(chunk),len(signal)-offset)
        signal[offset:offset+count]+=chunk[:count]; end=max(end,offset+count)
        refs.append({**spec,**provenance,'sourceKey':spec['source'],'selectedStart':start,'selectedDuration':round(count/RATE,6)})
    length=max(int(.3*RATE),min(len(signal),end+int(.025*RATE)))
    signal=signal[:length]
    peak=float(np.max(np.abs(signal)))
    if peak: signal*=.8/peak
    pcm=np.round(np.clip(signal,-1,1)*32767).astype('<i2')
    wav=wav_dir/(path.stem+'.wav')
    with wave.open(str(wav),'wb') as w: w.setnchannels(1);w.setsampwidth(2);w.setframerate(RATE);w.writeframes(pcm.tobytes())
    call(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libvorbis','-q:a','4',str(path)])
    decoded=np.frombuffer(call(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ac','1','-ar',str(RATE),'pipe:1']),dtype='<f4')
    decoded_peak=float(np.max(np.abs(decoded)));rms=float(np.sqrt(np.mean(decoded**2)))
    metadata={'file':path.name,'sha256':sha(path),'bytes':path.stat().st_size,'duration':round(len(decoded)/RATE,6),'peakDbfs':round(20*math.log10(max(decoded_peak,1e-9)),3),'rmsDbfs':round(20*math.log10(max(rms,1e-9)),3),'clippedSamples':int(np.count_nonzero(np.abs(decoded)>=1)),'sources':refs}
    assert .29<=metadata['duration']<=1.55 and not metadata['clippedSamples'], metadata
    return metadata

def load_moves(path):
    if path is None: return PREVIEW
    data=json.loads(path.read_text(encoding='utf-8-sig'))
    if isinstance(data,list): return data
    for key in ['moves','entries','rows','moveInventory']:
        if isinstance(data.get(key),list):return data[key]
    raise ValueError('Expected move array, or {moves:[...]}')

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--inventory',type=Path);ap.add_argument('--family-map',type=Path);ap.add_argument('--output',type=Path,required=True);ap.add_argument('--source-public',type=Path,default=SOURCE_PUBLIC);ap.add_argument('--limit',type=int);ap.add_argument('--work-dir',type=Path);ap.add_argument('--manifest',type=Path);ap.add_argument('--reuse-manifest',type=Path);ap.add_argument('--public-prefix',default='audio/board_game/move-fx/v1/');args=ap.parse_args()
    output=args.output.resolve();output.mkdir(parents=True,exist_ok=True);wav_dir=args.work_dir or output/'wav';wav_dir.mkdir(parents=True,exist_ok=True)
    moves=load_moves(args.inventory);moves=moves[:args.limit] if args.limit else moves
    family_map=json.loads(args.family_map.read_text(encoding='utf-8-sig')) if args.family_map else {}
    family_map=family_map.get('moves',family_map)
    if isinstance(family_map,list):family_map={m.get('id') or m.get('moveId'):m for m in family_map}
    library=Library(args.source_public);manifest=[];ids=set();rendered={};files={};move_sounds={}
    prior=json.loads(args.reuse_manifest.read_text(encoding='utf-8'))['files'] if args.reuse_manifest else {}
    for move in moves:
        identity=str(move.get('id') or move.get('moveId') or '')
        if not re.fullmatch(r'[A-Za-z0-9_-]+',identity):raise ValueError(f'Invalid move ID {identity!r}')
        if identity in ids:continue
        ids.add(identity);move={**move,'id':identity}
        mapped=family_map.get(identity)
        family=mapped.get('art') or mapped.get('family') or mapped.get('familyId') if isinstance(mapped,dict) else mapped
        family=family or move.get('art') or move.get('family')
        explicit_sound_family=move.get('soundFamily') or (mapped.get('sound') if isinstance(mapped,dict) else None)
        if explicit_sound_family in FAMILY_STYLES:family=explicit_sound_family
        if args.family_map and not family:raise ValueError(f'Move lacks exact family mapping: {identity}')
        style=classify(move,family);phases=recipe(style,move);row={'id':identity,'name':move.get('name') or move.get('moveName'),'visualFamily':move.get('art'),'classification':style,'cast':None,'hit':None}
        for phase,specs in phases.items():
            if not specs:continue
            signature=json.dumps({'family':family or style['kind'],'phase':phase,'specs':specs},sort_keys=True)
            key=hashlib.sha256(signature.encode()).hexdigest()[:10]
            if key not in rendered:
                filename=f'{family or style["kind"]}__{key}__{phase}.ogg'
                target=output/filename
                if target.exists():
                    previous=prior.get(filename)
                    if not previous or sha(target)!=previous['sha256']:raise FileExistsError(f'Refusing to overwrite unverified derivative {target}')
                    expected=[{k:src['sourceKey'] if k=='source' else src[k] for k in spec} for src,spec in zip(previous['sources'],specs)]
                    if len(previous['sources'])!=len(specs) or expected!=specs:raise ValueError(f'Recipe mismatch for {target}')
                    for src,spec in zip(previous['sources'],specs):
                        _,current=library.get(spec['source'])
                        if current['sourceSha256']!=src['sourceSha256']:raise ValueError(f'Source changed for {target}')
                    rendered[key]=previous
                else: rendered[key]=render(library,specs,target,wav_dir)
                files[filename]=rendered[key]
            row[phase]=rendered[key]['file']
        move_sounds[identity]={'sound':args.public_prefix+row['hit'] if row['hit'] else '', 'castSound':args.public_prefix+row['cast'] if row['cast'] else ''}
        manifest.append(row)
        if len(manifest)%50==0 or len(moves)<15:print(f'{len(manifest)}/{len(moves)} {identity} {style["role"]}/{style["kind"]}',flush=True)
    source_checks=[]
    for _,(_,meta) in library.cache.items():source_checks.append({'source':meta['source'],'sha256':meta['sourceSha256'],'unchanged':sha(args.source_public/meta['source'])==meta['sourceSha256']})
    doc={'generator':'build_board_move_sfx.py v1','sourceRoot':str(args.source_public),'sourceAuthor':AUTHOR,'sourceTerms':LICENSE_URL,'rightsNote':'Derived audio is for incorporation into this game; do not present it as an independent reusable sound-effects library or claim the source sounds as original recordings.','sampleRate':RATE,'channels':1,'moves':manifest,'files':files,'sourcePreservation':source_checks,'inputInventorySha256':sha(args.inventory) if args.inventory else None,'inputFamilyMapSha256':sha(args.family_map) if args.family_map else None}
    manifest_path=args.manifest or output/'manifest.json';manifest_path.parent.mkdir(parents=True,exist_ok=True)
    manifest_path.write_text(json.dumps(doc,ensure_ascii=False,indent=2),encoding='utf-8')
    qa={'moves':len(manifest),'attackMoves':sum(m['classification']['role']=='attack' for m in manifest),'supportMoves':sum(m['classification']['role']=='support' for m in manifest),'uniqueSoundFiles':len(files),'phaseAssignments':sum(bool(m[p]) for m in manifest for p in ['cast','hit']),'allSourcesUnchanged':all(x['unchanged'] for x in source_checks),'allDurationPeakChecksPassed':True,'minimumDuration':min(f['duration'] for f in files.values()),'maximumDuration':max(f['duration'] for f in files.values()),'maximumPeakDbfs':max(f['peakDbfs'] for f in files.values()),'totalBytes':sum(f['bytes'] for f in files.values()),'listeningReview':'not yet human-auditioned; mathematical checks are not listening acceptance'}
    (wav_dir/'qa.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2),encoding='utf-8')
    (wav_dir/'move-sounds.json').write_text(json.dumps(move_sounds,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(qa,ensure_ascii=False))

if __name__=='__main__':main()
