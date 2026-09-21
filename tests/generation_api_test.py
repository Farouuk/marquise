# Run against an isolated local Worker with a deliberately invalid test API key.
# All actions tested here must complete before any provider request is made.
import json, urllib.request, urllib.error, uuid
base='http://127.0.0.1:5175/api/'
uid='generation-test-'+uuid.uuid4().hex
headers={'Content-Type':'application/json','oai-authenticated-user-id':uid,'oai-authenticated-user-email':'owner@example.test'}
def req(path,body=None,custom=None):
 r=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=custom or headers)
 try:
  with urllib.request.urlopen(r) as f:return f.status,json.load(f)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
code,initial=req('state');assert code==200,initial
s=initial['state'];s['courses']=[{'id':'course','name':'Test génération','code':'TEST','color':'sage'}]
code,out=req('state',{'state':s,'revision':initial['revision']});assert code==200,out
boundary='testboundary';ex={'pages':[{'page':i,'text':f'Notion numéro {i} : ce texte explique un concept distinct pour vérifier la répartition des fiches.','diagrams':[]} for i in range(1,15)],'warnings':[]}
parts=[]
for k,v in [('courseId','course'),('extraction',json.dumps(ex))]:parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4\n{uid}\n%%EOF\r\n--{boundary}--\r\n'.encode())
r=urllib.request.Request(base+'documents',data=b''.join(parts),headers={**headers,'Content-Type':'multipart/form-data; boundary='+boundary})
with urllib.request.urlopen(r) as f: assert f.status==200
cfg=req('admin')[1]['config'];cfg.update(action='config',paused='false',pauseStart='',pauseEnd='');assert req('admin',cfg)[0]==200
before=req('admin')[1]['users']
code,job=req('ai',{'kind':'cards','action':'start','courseId':'course','prompt':'','target':12});assert code==200,job
assert job['total']==2 and job['added']==0
body={'kind':'cards','courseId':'course','deckId':job['deckId'],'jobId':job['jobId'],'batch':99,'prompt':''}
assert req('ai',body)[0]==409
latest=req('state')[1];latest['state']['decks'][0]['generation']['next']=999
assert req('state',{'state':latest['state'],'revision':latest['revision']})[0]==200
assert req('state')[1]['state']['decks'][0]['generation']['next']==0
cfg['paused']='true';assert req('admin',cfg)[0]==200
body['batch']=0;assert req('ai',body)[0]==423
body['action']='finish';code,done=req('ai',body);assert code==200 and done['done'],done
cfg['paused']='false';assert req('admin',cfg)[0]==200
body.pop('action');code,repeated=req('ai',body);assert code==200 and repeated['done'],repeated
assert req('admin')[1]['users']==before,'No provider calls should be admitted by this test'
cfg['paused']='true';req('admin',cfg)
original_model=cfg['model']
cfg.update(model='unpriced-test-model',paused='false')
assert req('admin',cfg)[0]==200
assert req('admin',cfg)[0]==200
unpriced=req('admin')[1]['config']
assert unpriced['inputRate']==0 and unpriced['outputRate']==0
assert req('ai',{'kind':'cards','action':'start','courseId':'course','prompt':'','target':6})[0]==423
cfg.update(model=original_model,paused='true');assert req('admin',cfg)[0]==200
print('PASS: saved job, bounded plan, invalid batch rejection, tamper-resistant checkpoints, pause enforcement, finish during pause, repeated completed request without AI charges.')
print('PASS: repeated saves cannot activate a model using another model’s prices.')
