"""Read only ZIP directory and iOS plists, without downloading every platform."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import plistlib
import urllib.request
import zipfile


class RemoteZip(io.RawIOBase):
    def __init__(self, url, size):
        self.url, self.size, self.pos, self.received = url, size, 0, 0

    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else self.size + offset
        if not 0 <= self.pos <= self.size:
            raise ValueError('ZIP seek outside pinned asset')
        return self.pos

    def tell(self):
        return self.pos

    def read(self, size=-1):
        size = min(self.size - self.pos, size if size >= 0 else self.size - self.pos)
        if not size:
            return b''
        if size > 2 * 1024 * 1024:
            raise ValueError('Inspection must not download native binaries')
        request = urllib.request.Request(self.url, headers={'Range': f'bytes={self.pos}-{self.pos+size-1}', 'Accept-Encoding': 'identity'})
        with urllib.request.urlopen(request, timeout=40) as response:
            if response.status != 206 or response.headers.get('Content-Range') != f'bytes {self.pos}-{self.pos+size-1}/{self.size}':
                raise ValueError('Server did not honor exact range; full download refused')
            data = response.read(size+1)
        if len(data) != size:
            raise ValueError('Truncated ZIP range')
        self.pos += size
        self.received += size
        return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    lock = json.loads((Path(__file__).resolve().parents[1]/'dependencies.json').read_text())
    dependency = lock['godotjs']
    source = RemoteZip(dependency['url'], dependency['size'])
    with zipfile.ZipFile(source) as archive:
        entries = [x for x in archive.infolist() if '/bin/ios/' in x.filename]
        plists = []
        for item in entries:
            if item.filename.endswith('/Info.plist'):
                raw = archive.read(item)
                plists.append({'path': item.filename, 'sha256': hashlib.sha256(raw).hexdigest(), 'value': plistlib.loads(raw)})
        if not entries or not plists:
            raise ValueError('No iOS framework metadata in pinned release')
    report = {'scope': 'Upstream archive metadata, not compilation or device acceptance',
              'dependency': dependency, 'transferredBytes': source.received,
              'iosFiles': [{'path': x.filename, 'size': x.file_size} for x in entries],
              'plists': plists, 'fullArchiveShaVerified': False,
              'macBuildVerified': False, 'iphoneVerified': False}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2)+'\n', encoding='utf8')
    print(json.dumps({'iosEntries': len(entries), 'transferredBytes': source.received, 'plists': plists}))


if __name__ == '__main__':
    main()
