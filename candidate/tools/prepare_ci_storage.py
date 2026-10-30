"""Bound Actions artifact use; only retire the exact locally verified previous IPA artifact.

Runs only in the existing public repository with GitHub's ephemeral job token.
Never changes a billing setting, visibility, runner type, or spending limit.
"""
import json, os, urllib.request, urllib.error
from pathlib import Path

REPOSITORY='az12sx45/onepiece-card-online'
OLD_ID=12831102316
OLD_DIGEST='sha256:3dfc1e1d4af9a2ab3ca32a30bf25a8c7cee750cee846d94d624d3c4cc2035689'
SUPERSEDED=[
 (12957152972,428550082,'sha256:25cfdc35f0aef027d46fee08c978e37631f6018fc7f9128693ca4e206251b25c','29f2d93977431a34b1ce4889d8e0ab68b548102e'),
 (OLD_ID,431643350,OLD_DIGEST,'cbd840eeab285a1e54dc503754fb77b4dcd3d317'),
 (12831855587,431643341,'sha256:e630a758d21590f6b74222c2a2ff4bf3f741a196c85c83545fc94f5070657491','10bbc14d3b92eb7960268092b740cc484d5541eb'),
 (12804157997,431641602,'sha256:12773b5389ff577266d0a4e3554b10c946157b939e7eac4b3c85368732c05378','ab8e25815ad743c5a45feb7b87dc6e2a890438c2'),
 (12798424613,431370034,'sha256:49bcd16c8489727d3dd395f72e9176aee64894e5c4d348294949afe6b5591343','abd54dff5765bb6af9f85833e0a484110289f5c4'),
 (12795225392,417512680,'sha256:62625d9489321f5c71511c8222e3d7734564c4a10a6e85015177b8c31be97798','e561570a6e77100de8eb56b869f49a8b53a26952'),
 (12794836034,417512585,'sha256:866caa14c31f92c53723dafcdcdf50f1dbf2ad1a5dba72fcb5bf74b2accc5796','73d2797d3ec080ebd28302735645820a9994e444')]
# The extracted IPA remains locally retained and was rehashed before dispatch.
BACKUP_SHA256='e831ee045fdf94af4ec41c3af041052f47372f3a4a4e9d0f4931ec1303e7a709'
LIMIT=500000000

def main():
 if os.environ.get('GITHUB_REPOSITORY')!=REPOSITORY:raise RuntimeError('Unexpected repository')
 token=os.environ['GITHUB_TOKEN']
 def request(endpoint,method='GET'):
  req=urllib.request.Request('https://api.github.com/repos/'+REPOSITORY+endpoint,method=method,
   headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'})
  with urllib.request.urlopen(req,timeout=30) as response:
   data=response.read();return json.loads(data) if data else None
 if request('')['private']:raise RuntimeError('Free public runner guard failed')
 retired=[];verified=[]
 for artifact_id,size,digest,commit in SUPERSEDED:
  try:old=request('/actions/artifacts/'+str(artifact_id))
  except urllib.error.HTTPError as error:
   if error.code!=404:raise
   continue
  if (old['name']!='PO-iOS-UNSIGNED' or old.get('digest')!=digest or old['size_in_bytes']!=size
      or old['workflow_run']['head_sha']!=commit or old['workflow_run']['head_branch']!='codex/ios-native-v038'):
   raise RuntimeError('Previous artifact identity changed')
  verified.append(artifact_id)
 # All listed commits were verified ancestors of the retained v056 build before dispatch.
 for artifact_id in verified:
  request('/actions/artifacts/'+str(artifact_id),'DELETE');retired.append(artifact_id)
 artifacts=[]
 for page in range(1,11):
  rows=request('/actions/artifacts?per_page=100&page='+str(page))['artifacts'];artifacts.extend(rows)
  if len(rows)<100:break
 else:raise RuntimeError('Artifact inventory exceeds bounded check')
 remaining=sum(x['size_in_bytes'] for x in artifacts if not x['expired'])
 # Use the conservative decimal 500 MB cap, retaining 4 MB for diagnostics/ZIP overhead.
 maximum=LIMIT-remaining-4000000
 if maximum<480000000:raise RuntimeError('Insufficient free artifact capacity; no paid capacity allowed')
 result={'retiredExactArtifact':retired,'retainedLocalIpaSha256':BACKUP_SHA256,'otherArtifactBytes':remaining,
         'maximumCandidateBytes':maximum,'publicRepository':True,'paidServicesAuthorized':False}
 Path(os.environ['RUNNER_TEMP'],'po-storage-guard.json').write_text(json.dumps(result))
 print(json.dumps(result))

if __name__=='__main__':main()
