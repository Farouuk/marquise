import urllib.request,urllib.error,http.cookiejar,json,concurrent.futures,sqlite3
base='http://localhost:5173/api/'
def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def req(c,path,body=None,headers={}):
 r=urllib.request.Request(base+path,data=json.dumps(body).encode() if body else None,headers={'Content-Type':'application/json',**headers})
 try:
  with c.open(r) as f:return f.status,json.load(f)
 except urllib.error.HTTPError as e:
  text=e.read().decode();return e.code,json.loads(text) if text.startswith('{') else {'error':text}
a,b=client(),client();_,sa=req(a,'state');_,sb=req(b,'state');sa['state']['name']='Private Test A';code,res=req(a,'state',{'state':sa['state'],'revision':sa['revision']});assert code==200,res
assert req(a,'state')[1]['state']['name']=='Private Test A'
assert req(b,'state')[1]['state']['name']=='Camille'
assert req(a,'state',{'state':sa['state'],'revision':sa['revision']})[0]==409
assert req(a,'state',{'state':res['state'],'revision':res['revision']},{'Origin':'https://evil.example'})[0]==403
assert req(a,'admin')[0]==403
assert req(a,'admin',{'action':'config','allowance':999})[0]==403
assert req(a,'share',{'action':'share','deckId':'d1','email':'b@example.com'})[0]==403
assert req(a,'share',{'action':'import','id':'other'})[0]==403
assert req(a,'documents?id=sample-doc')[0]==404
assert req(a,'ai',{'kind':'tutor','courseId':'psy1','prompt':'Bonjour'})[0]==423
state=res['state'];state['reviews'].append({'cardId':'c1','at':'2026-09-16T12:00:00.000Z','rating':2,'interval':2,'due':'2026-09-18'})
code,saved=req(a,'state',{'state':state,'revision':res['revision']});assert code==200,saved
assert len(req(a,'state')[1]['state']['reviews'])==1
assert not req(b,'state')[1]['state']['reviews']
latest=req(a,'state')[1];latest['state']['sessions'][0]['done']=True
assert req(a,'state',{'state':latest['state'],'revision':latest['revision']})[0]==200
latest=req(a,'state')[1];latest['state']['name']='A second edit'
assert req(a,'state',{'state':latest['state'],'revision':latest['revision']})[0]==200
print('PASS: completed session remains saveable after subsequent edits')
# A completed session placed last must still count toward the day's capacity.
latest=req(a,'state')[1];state=latest['state']
completed=next(x for x in state['sessions'] if x['done'])
import datetime
day=completed['date'];weekday=(datetime.date.fromisoformat(day).weekday()+1)%7
capacity=(state['overrides'].get(day,state['availability'][weekday]))*60
pending=dict(completed,id='capacity-regression',done=False,minutes=capacity)
state['sessions']=[pending]+[x for x in state['sessions'] if x['done']]
assert req(a,'state',{'state':state,'revision':latest['revision']})[0]==400
print('PASS: capacity validation is independent of completed-session ordering')
print('PASS: session isolation, persistent saved reviews, optimistic conflict, CSRF, owner-only admin, demo sharing denial, private document denial, paused AI (no paid calls).')
# Run the actual reservation statement against SQLite and exercise concurrent budget admission.
c=sqlite3.connect(':memory:');c.executescript(open('drizzle/0000_nasty_justice.sql').read());config='{"paused":false}';c.execute('INSERT INTO settings VALUES (?,?)',('ai',config));sql=open('work/reserve.sql').read()
def reserve(i,user,amount=40,budget=100,limit=3,cfg=config):
 return c.execute(sql,(str(i),user,'2026-09','2026-09-16',amount,'model',cfg,'2026-09',amount,budget,'2026-09',user,limit,user)).rowcount
assert reserve(1,'a')==1;assert reserve(2,'a')==0 # one request per user
assert reserve(3,'b')==1;assert reserve(4,'c')==0 # two global
c.execute("UPDATE usage SET status='complete',actual=reserved")
assert reserve(5,'c')==0 # allowance exceeded
assert reserve(6,'c',amount=20)==1 # exact boundary
c.execute("UPDATE usage SET status='complete',actual=reserved")
assert reserve(7,'a',amount=1,budget=1000,limit=1)==0
c.execute('UPDATE settings SET data=?',('{"paused":true}',))
assert reserve(8,'a',budget=1000)==0 # atomic config change prevents admission
print('PASS: actual SQL reserve statement enforces global/user concurrency, monthly budget, per-user limit and configuration race.')
