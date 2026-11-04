"""Check Actions artifact capacity without mutating remote storage or settings."""
import json, os, urllib.request
from pathlib import Path

REPOSITORY='az12sx45/onepiece-card-online'
LIMIT=500000000

def main():
 if os.environ.get('GITHUB_REPOSITORY')!=REPOSITORY:raise RuntimeError('Unexpected repository')
 token=os.environ['GITHUB_TOKEN']
 def request(endpoint):
  req=urllib.request.Request('https://api.github.com/repos/'+REPOSITORY+endpoint,
   headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'})
  with urllib.request.urlopen(req,timeout=30) as response:
   data=response.read();return json.loads(data) if data else None
 if request('')['private']:raise RuntimeError('Free public runner guard failed')
 artifacts=[]
 for page in range(1,11):
  rows=request('/actions/artifacts?per_page=100&page='+str(page))['artifacts'];artifacts.extend(rows)
  if len(rows)<100:break
 else:raise RuntimeError('Artifact inventory exceeds bounded check')
 remaining=sum(x['size_in_bytes'] for x in artifacts if not x['expired'])
 # Use the conservative decimal 500 MB cap, retaining 4 MB for diagnostics/ZIP overhead.
 maximum=LIMIT-remaining-4000000
 if maximum<480000000:raise RuntimeError('Insufficient free artifact capacity; no paid capacity allowed')
 result={'otherArtifactBytes':remaining,
         'maximumCandidateBytes':maximum,'publicRepository':True,'paidServicesAuthorized':False}
 Path(os.environ['RUNNER_TEMP'],'po-storage-guard.json').write_text(json.dumps(result))
 print(json.dumps(result))

if __name__=='__main__':main()
