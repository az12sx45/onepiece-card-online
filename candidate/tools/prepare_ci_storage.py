"""Bound Actions artifact use; only retire the exact locally verified previous IPA artifact.

Runs only in the existing public repository with GitHub's ephemeral job token.
Never changes a billing setting, visibility, runner type, or spending limit.
"""
import json, os, urllib.request, urllib.error
from pathlib import Path

REPOSITORY='az12sx45/onepiece-card-online'
OLD_ID=12831102316
OLD_DIGEST='sha256:3dfc1e1d4af9a2ab3ca32a30bf25a8c7cee750cee846d94d624d3c4cc2035689'
# The extracted IPA remains locally retained and was rehashed before dispatch.
BACKUP_SHA256='ec5c850490597da773f3fcc2e2e150195455c0536f61e7b8e8b7154b21ca8d3a'
LIMIT=500*1024*1024

def main():
 if os.environ.get('GITHUB_REPOSITORY')!=REPOSITORY:raise RuntimeError('Unexpected repository')
 token=os.environ['GITHUB_TOKEN']
 def request(endpoint,method='GET'):
  req=urllib.request.Request('https://api.github.com/repos/'+REPOSITORY+endpoint,method=method,
   headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'})
  with urllib.request.urlopen(req,timeout=30) as response:
   data=response.read();return json.loads(data) if data else None
 if request('')['private']:raise RuntimeError('Free public runner guard failed')
 retired=False
 try:old=request('/actions/artifacts/'+str(OLD_ID))
 except urllib.error.HTTPError as error:
  if error.code!=404:raise
  old=None
 if old:
  if old['name']!='PO-iOS-UNSIGNED' or old.get('digest')!=OLD_DIGEST or old['size_in_bytes']!=431643350:raise RuntimeError('Previous artifact identity changed')
  request('/actions/artifacts/'+str(OLD_ID),'DELETE');retired=True
 artifacts=[]
 for page in range(1,11):
  rows=request('/actions/artifacts?per_page=100&page='+str(page))['artifacts'];artifacts.extend(rows)
  if len(rows)<100:break
 else:raise RuntimeError('Artifact inventory exceeds bounded check')
 remaining=sum(x['size_in_bytes'] for x in artifacts if not x['expired'])
 # Reserve 480 MiB for the candidate and 4 MiB for diagnostics. Refuse before build otherwise.
 if remaining+484*1024*1024>LIMIT:raise RuntimeError('Insufficient free artifact capacity; no paid capacity allowed')
 result={'retiredExactArtifact':retired,'retainedLocalIpaSha256':BACKUP_SHA256,'otherArtifactBytes':remaining,
         'maximumCandidateBytes':480*1024*1024,'publicRepository':True,'paidServicesAuthorized':False}
 Path(os.environ['RUNNER_TEMP'],'po-storage-guard.json').write_text(json.dumps(result))
 print(json.dumps(result))

if __name__=='__main__':main()
