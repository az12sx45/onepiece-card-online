"""Read back an unsigned Godot IPA without claiming device acceptance."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import plistlib
import re
import struct
import zipfile


def read_pck(data):
    f=io.BytesIO(data)
    def read(fmt):return struct.unpack(fmt,f.read(struct.calcsize(fmt)))
    magic,version,major,minor,patch,flags=read('<6I')
    if magic!=0x43504447 or version not in (2,3,4) or flags&1:raise ValueError('Unsupported/encrypted PCK')
    base,=read('<Q')
    if version>=3:
        directory,=read('<Q');f.seek(directory)
    else:f.seek(64,1)
    count,=read('<I');entries={}
    for _ in range(count):
        length,=read('<I')
        name=f.read(length).rstrip(b'\0').decode('utf8')
        if not name.startswith('res://'):name='res://'+name
        offset,size=read('<QQ');digest=f.read(16);file_flags,=read('<I')
        if file_flags:raise ValueError('Unexpected packed file flags: '+name)
        value=data[base+offset:base+offset+size]
        if len(value)!=size or hashlib.md5(value).digest()!=digest:raise ValueError('PCK corruption: '+name)
        if name in entries:raise ValueError('Duplicate PCK resource')
        entries[name]=value
    return entries


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--ipa',type=Path,required=True)
    parser.add_argument('--candidate',type=Path,required=True)
    parser.add_argument('--report',type=Path,required=True)
    args=parser.parse_args()
    with zipfile.ZipFile(args.ipa) as archive:
        if archive.testzip():raise ValueError('IPA ZIP checksum failure')
        names=archive.namelist()
        infos=[n for n in names if n.startswith('Payload/') and n.count('/')==2 and n.endswith('.app/Info.plist')]
        if len(infos)!=1:raise ValueError('Expected one application bundle')
        info=plistlib.loads(archive.read(infos[0]));prefix=infos[0][:-len('Info.plist')]
        if info['CFBundleIdentifier']!='tw.rihdi.po.native.ios':raise ValueError('Bundle ID mismatch')
        packs=[n for n in names if n.startswith(prefix) and n.endswith('.pck')]
        if len(packs)!=1:raise ValueError('Expected one game PCK')
        entries=read_pck(archive.read(packs[0]))
        verified=0
        for file in (args.candidate/'project').rglob('*.js'):
            key='res://'+file.relative_to(args.candidate/'project').as_posix()
            if entries.get(key)!=file.read_bytes():raise ValueError('Game JavaScript mismatch: '+key)
            verified+=1
        for required in ['ios_host.tscn','ios_services.gdc','ios_assets.gdc','ios_session.gdc','ios_video.gdc','ios_product_root.gdc','addons/po-ios/po-ios.gdextension']:
            key='res://'+required
            if key not in entries:
                remap=entries.get(key+'.remap',b'').decode()
                match=re.search(r'path="([^"]+)"',remap)
                if not match or match[1] not in entries:raise ValueError('Missing iOS resource: '+required)
        extensions=entries['res://.godot/extension_list.cfg'].decode()
        if 'addons/po-ios/po-ios.gdextension' not in extensions or 'godotjs-ext.gdextension' not in extensions:raise ValueError('Native extension registration incomplete')
        metadata=[n for n in names if n.startswith(prefix+'.godot/.api_dumping/')]
        if len(metadata)<100:raise ValueError('Physical engine API metadata missing')
        frameworks=[n for n in names if '.framework/' in n and n.endswith('/Info.plist')]
        if not any('po_ios_bridge' in n for n in frameworks) or not any('godotjs-ext' in n for n in frameworks):raise ValueError('Native framework missing')
        orientations=info.get('UISupportedInterfaceOrientations',[])
        if not orientations or any('Landscape' not in n for n in orientations):raise ValueError('Unexpected phone orientations')
    report={'passed':True,'zipIntegrity':True,'pckEntriesVerified':len(entries),'gameJavaScriptFilesByteIdentical':verified,'physicalApiMetadataFiles':len(metadata),'nativeFrameworks':frameworks,'bundleIdentifier':info['CFBundleIdentifier'],'orientations':orientations,'sha256':hashlib.sha256(args.ipa.read_bytes()).hexdigest(),'bytes':args.ipa.stat().st_size,'signed':False,'iphoneTested':False,'installableAsIs':False}
    args.report.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps(report))


if __name__=='__main__':main()
