"""Retain a verified unsigned CI candidate in a dedicated draft GitHub release."""
import hashlib
import http.client
import json
import os
from pathlib import Path
import urllib.parse
import urllib.request
import zipfile
REPO = 'az12sx45/onepiece-card-online'
LIMIT = 496000000
def require(condition, message):
    if not condition:
        raise RuntimeError(message)
def main():
    require(os.environ.get('GITHUB_REPOSITORY') == REPO, 'Unexpected repository')
    token = os.environ['GITHUB_TOKEN']
    commit = os.environ['GITHUB_SHA']
    run_id = int(os.environ['GITHUB_RUN_ID'])
    build = Path(os.environ['RUNNER_TEMP'])/'po-build'
    ipa = build/'PO-iOS-UNSIGNED.ipa'
    report = json.loads((build/'build-result.json').read_bytes())
    with ipa.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    require(0 < ipa.stat().st_size < LIMIT and report['versionCode'] == 67 and
            report['macCompiled'] and report['macWebKitMarinefordProgramChecked'] and
            report['signed'] is False and report['iphoneTested'] is False and
            report['sha256'] == digest and report['bytes'] == ipa.stat().st_size,
            'IPA or native verification report differs')
    headers = {'Authorization':'Bearer '+token, 'Accept':'application/vnd.github+json',
               'X-GitHub-Api-Version':'2022-11-28', 'User-Agent':'PO-iOS-native-CI'}
    api = 'https://api.github.com/repos/'+REPO
    def request(route, data=None):
        body = json.dumps(data).encode() if data is not None else None
        req = urllib.request.Request(api+route, data=body, headers=dict(headers, **{'Content-Type':'application/json'}))
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    require(request('')['private'] is False, 'Public free-runner repository required')
    run = request('/actions/runs/'+str(run_id))
    require(run['head_sha'] == commit and run['head_branch'] == 'codex/ios-native-v038',
            'CI run identity differs')
    tag = 'ios-native-v067-ci-'+commit[:12]
    matches = [item for item in request('/releases?per_page=100') if item['tag_name'] == tag]
    require(len(matches) <= 1, 'Ambiguous draft candidate')
    if matches:
        release = matches[0]
        require(release['draft'] is True and release['target_commitish'] == commit,
                'Existing candidate is not this draft source')
    else:
        release = request('/releases', dict(tag_name=tag, target_commitish=commit, draft=True, prerelease=True,
            name='iOS v067 unsigned candidate '+commit[:12],
            body='Unsigned native candidate from CI run '+str(run_id)+'. Owner signing and physical iPhone acceptance pending.'))
    release_id = release['id']
    require(release['draft'] is True, 'Candidate release unexpectedly public')
    diagnostics = build/'PO-iOS-v067-ci-report.zip'
    with zipfile.ZipFile(diagnostics,'w',compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(build/'build-result.json','build-result.json')
        for file in sorted((build/'logs').glob('*.log')):
            archive.writestr(file.name, file.read_bytes()[-2*1024*1024:])
    files = [(ipa,'PO-iOS-v067-'+digest[:12]+'-UNSIGNED.ipa'),
             (diagnostics,'PO-iOS-v067-ci-report-'+str(run_id)+'-'+os.environ.get('GITHUB_RUN_ATTEMPT','1')+'.zip')]
    retained = []
    existing = request('/releases/'+str(release_id)+'/assets?per_page=100')
    for file, name in files:
        with file.open('rb') as stream:
            expected = hashlib.file_digest(stream,'sha256').hexdigest()
        matches = [item for item in existing if item['name'] == name]
        require(len(matches) <= 1, 'Ambiguous candidate asset')
        if matches:
            asset = matches[0]
        else:
            connection = http.client.HTTPSConnection('uploads.github.com', timeout=180)
            route = '/repos/'+REPO+'/releases/'+str(release_id)+'/assets?name='+urllib.parse.quote(name)
            connection.putrequest('POST',route)
            for key,value in headers.items():
                connection.putheader(key,value)
            connection.putheader('Content-Type','application/octet-stream')
            connection.putheader('Content-Length',str(file.stat().st_size))
            connection.endheaders()
            with file.open('rb') as stream:
                while data := stream.read(1024*1024):
                    connection.send(data)
            response = connection.getresponse()
            require(response.status == 201, 'Draft asset upload failed HTTP '+str(response.status))
            asset = json.loads(response.read())
            connection.close()
        require(asset['state'] == 'uploaded' and asset['size'] == file.stat().st_size and
                (not asset.get('digest') or asset['digest'] == 'sha256:'+expected),
                'Retained draft asset metadata differs')
        retained.append(dict(assetId=asset['id'],name=name,bytes=file.stat().st_size,sha256=expected))
    output = dict(ok=True,draft=True,releaseId=release_id,tag=tag,sourceCommit=commit,runId=run_id,
                  signed=False,physicalIphoneVerified=False,assets=retained)
    (build/'draft-release-retention.json').write_text(json.dumps(output,indent=2)+'\n')
    print(json.dumps(output))
if __name__=='__main__':
    main()
