import urllib.request,urllib.error,http.cookiejar,json,uuid,hashlib
base='http://localhost:5173/api/'
c=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def request(path,body=None,kind='application/json'):
 data=json.dumps(body).encode() if kind=='application/json' and body is not None else body
 req=urllib.request.Request(base+path,data=data,headers={'Content-Type':kind})
 try:
  with c.open(req) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
_,initial=request('state');course=initial['state']['courses'][0]['id'];other=initial['state']['courses'][1]['id'];count=len(initial['state']['documents'])
def upload(name,content,course_id):
 boundary='batch-'+uuid.uuid4().hex;parts=[]
 for key,val in [('courseId',course_id),('extraction',json.dumps({'pages':[{'page':1,'text':'Test de référence','diagrams':[]}],'warnings':[]}))]:
  parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{val}\r\n'.encode())
 parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/pdf\r\n\r\n'.encode()+content+b'\r\n')
 parts.append(f'--{boundary}--\r\n'.encode());return request('documents',b''.join(parts),'multipart/form-data; boundary='+boundary)
a=b'%PDF-1.4\nFixture A\n%%EOF';b=b'%PDF-1.4\nFixture B\n%%EOF'
assert upload('A.pdf',a,course)[0]==200
assert upload('broken.pdf',b'broken',course)[0]==400
assert upload('B.pdf',b,course)[0]==200
code,repeated=upload('renamed.pdf',a,course);assert code==200 and repeated['duplicate']
_,state=request('state');assert len(state['state']['documents'])==count+2
hash_a=hashlib.sha256(a).hexdigest();_,cached=request('documents?hash='+hash_a+'&courseId='+course);assert cached['duplicate'] and cached['extraction']['pages'][0]['page']==1
assert not request('documents?hash='+hash_a+'&courseId='+other)[1]['duplicate']
assert upload('A-other-course.pdf',a,other)[0]==200
_,state=request('state');assert len(state['state']['documents'])==count+3
assert request('documents?hash='+hash_a+'&courseId='+other)[1]['duplicate']
# A different session cannot discover another student's uploaded content.
c=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
_,private=request('documents?hash='+hash_a+'&courseId='+course);assert not private['duplicate'] and private['extraction'] is None
print('PASS: consecutive uploads, partial failure, duplicate prevention by bytes/course, cache reuse, preserved references, cross-course placement and private deduplication.')
