# Test the built Worker directly on loopback. Production identity headers are injected by Sites.
import json,urllib.request,urllib.error,uuid,time
suffix=uuid.uuid4().hex[:8]
base='http://127.0.0.1:5174/api/'
def req(user,path,body=None):
 email='owner@example.test' if user=='owner' else user+suffix+'@example.test'
 r=urllib.request.Request(base+path,data=json.dumps(body).encode() if body else None,headers={'Content-Type':'application/json','oai-authenticated-user-id':'test_'+user+suffix,'oai-authenticated-user-email':email})
 try:
  with urllib.request.urlopen(r) as f:return f.status,json.load(f)
 except urllib.error.HTTPError as e:
  text=e.read().decode()
  if e.code==503 and not text.startswith('{'):
   time.sleep(.2);return req(user,path,body)
  return e.code,json.loads(text) if text.startswith('{') else {'error':text}
assert req('outsider','state')[0]==403
for who in ['alice','bob']:assert req('owner','admin',{'action':'invite','email':who+suffix+'@example.test'})[0]==200
_,a=req('alice','state');_,b=req('bob','state');assert not a['demo'];assert a['state']['documents']==[]
a['state']['courses']=[{'id':'mycourse','name':'Private course','code':'QA','color':'sage'}];a['state']['decks']=[{'id':'mydeck','courseId':'mycourse','name':'Shared study','cards':[{'id':'mycard','question':'Private question','answer':'Shared answer','topic':'Topic','source':{'documentId':'secret-document-id','name':'Lecture.pdf','page':3}}]}]
assert req('alice','state',{'state':a['state'],'revision':a['revision']})[0]==200
assert req('bob','state')[1]['state']['decks']==[]
assert req('bob','share',{'action':'share','deckId':'mydeck','email':'alice'+suffix+'@example.test'})[0]==403
assert req('alice','share',{'action':'share','deckId':'mydeck','email':'bob'+suffix+'@example.test'})[0]==200
_,shared=req('bob','share');share=shared['shares'][0];assert 'secret-document-id' not in json.dumps(share);assert 'documents' not in share['deck'];assert 'reviews' not in share['deck'];assert 'chats' not in share['deck']
assert req('outsider','share',{'action':'import','id':share['id']})[0]==403
assert req('bob','share',{'action':'import','id':share['id']})[0]==200
_,b=req('bob','state');assert b['state']['decks'][0]['cards'][0]['id']!='mycard';assert b['state']['reviews']==[];assert b['state']['documents']==[]
assert req('bob','documents?id=secret-document-id')[0]==404
assert req('alice','admin')[0]==403
cfg=req('owner','admin')[1]['config'];cfg.update(action='config',paused='true');assert req('owner','admin',cfg)[0]==200
assert req('alice','ai',{'kind':'tutor','courseId':'mycourse','prompt':'Explain'})[0]==423
cfg.update(paused='false',pauseStart='2020-01-01',pauseEnd='2099-01-01');assert req('owner','admin',cfg)[0]==200
code,res=req('alice','ai',{'kind':'tutor','courseId':'mycourse','prompt':'Explain'});assert code==423 and 'planifiée' in res['error'],res
assert req('owner','admin',{'action':'revoke','email':'alice'+suffix+'@example.test'})[0]==200
assert req('alice','state')[0]==403
print('PASS: invited member isolation, owner-only settings, recipient-only share/import, sanitized share references, separate card IDs/progress, private originals, manual/scheduled pauses, revoked membership.')
