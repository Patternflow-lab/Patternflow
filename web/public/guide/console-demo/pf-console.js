(function(){
if(window.PF)return;
var W=window,D=document,H=D.documentElement,L=location,light=false;
// Theme before first paint: this script is parser-blocking in <head>.
try{light=localStorage.getItem('pf-theme')==='light'}catch(e){}
if(light)H.setAttribute('data-theme','light');
var st=D.createElement('style');
// --pf-chrome-h is the header's exact height (see the shadow CSS below).
st.textContent='html[data-theme=light]{color-scheme:light;--cream:#F4EFE6;--cream2:#FFFCFA;--ink:#1A1814;--muted:#6B6558;--faint:#9A9486;--rule:#D9D1C2;--rule-soft:#E8E2D6;--led:#FF5C2E;--ok:#2F8A55;--warn:#B88120;--panel:#FFFCFA;--bg:#F4EFE6;--ghost:#E0D9CC;--card:#FFFCFA;--card2:#E8E2D6;--fg:#1A1814;--mut:#6B6558;--ln:#D9D1C2;--bad:#B8402E;--bar:#E0D9CC;--bar-on:#FF5C2E;--accent:#FF5C2E}'
+':root{color-scheme:dark;--pf-chrome-h:81px}@media(min-width:720px){:root{--pf-chrome-h:41px}}'
+'html:not(.pf-mounted) body::before{content:"";display:block;box-sizing:border-box;height:var(--pf-chrome-h);border-bottom:1px solid var(--rule,#242118);background:var(--cream,var(--bg,#0C0B09))}'
+'@media(pointer:coarse){input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]),select,textarea{font-size:16px!important}}'
+'.pf-busy{opacity:.55;cursor:progress}';
(D.head||H).appendChild(st);

var PF=W.PF={v:null,state:'connecting',dirty:false},
nf=W.fetch,T=[],cur=null,Q=[],lb=0,run=1,P=[],S=null,subs=[],sq=null,sb=0,wms=1/0,sp=null,
rtt=null,fails=0,off=0,alien=0,rs=0,holds=0,guards=0,leaveOk=0,RH={},bc=null,
me=Math.random().toString(36).slice(2),touched=0,pd=0,nv=0,nvT,pgT,
adopted=0,healed=0,stale=null,pft=0,ct=0,cn=null,fnav=[],drawn='',
sr,hl,ver,vb,nav,ch,tg,pg,tw,tq,tt,SKIP={},
// The core's pages and nothing else; features add theirs via featureNav at
// NAV_AT. Third field: prefetch order, smallest page first.
NAV=[['/','Console',5],['/patterns','Patterns',6],['/status','Status',2],['/wifi','Wi-Fi',4],['/knobs','Knobs',1],['/update','Update',3]],NAV_AT=2;
try{PF.v=new URLSearchParams(L.search).get('v')}catch(e){}
var docB=PF.v;
H.classList.add('pf-connecting');
try{cn=JSON.parse(localStorage.getItem('pf-nav'))}catch(e){}
if(cn&&Array.isArray(cn.nav)&&(!PF.v||cn.build===PF.v))fnav=cn.nav;

function now(){return Date.now()}
function call(f,a,b){try{f(a,b)}catch(x){setTimeout(function(){throw x})}}
function ev(n,d){D.dispatchEvent(new CustomEvent(n,{detail:d}))}
function drop(e){var i=T.indexOf(e);if(i>-1)T.splice(i,1)}

// fetch wrapper: same-origin GETs get a controller a tab switch can abort.
function tf(u,o,k){
var c=new AbortController(),e={c:c,u:new URL(u,L.href).href,t:now(),k:k},i={},n;
for(n in o)i[n]=o[n];
i.signal=c.signal;
for(n=T.length;n--;)if(e.t-T[n].t>6e4)T.splice(n,1);
T.push(e);if(cur)cur.push(e);
e.p=nf.call(W,u,i);
return e;
}
W.fetch=function(u,o){
var m=String(o&&o.method||'GET').toUpperCase(),ok=false,e;
try{ok=(typeof u==='string'||u instanceof URL)&&(m==='GET'||m==='HEAD')&&!(o&&(o.signal||o.keepalive))&&new URL(u,L.href).origin===L.origin}catch(x){}
if(!ok)return nf.apply(W,arguments);
e=tf(u,o||{},cur?'bg':'fg');
e.p.then(function(){drop(e)},function(){drop(e)});
return e.p;
};
// 12 s at least: on the hotspot with the station also up, a small reply
// queued behind a page on the one-connection server took 4-5 s (bench
// 2026-09-24), and a 5 s floor called that link dead.
function tmo(){return Math.min(3e4,Math.max(12e3,4*rtt))}
// A PF request (mode json|text|st|pre): tracked until its body is read; the
// timeout bounds the reply and then the body, so a big body on a slow link
// is not "offline". Only replies from this origin (the panel) feed the RTT
// and the connection state; another site failing says nothing about it.
function rq(u,k,mode,ms){
var pre=mode==='pre',e=tf(u,pre?{}:{cache:'no-store'},k),t0=now(),to,same=new URL(e.u).origin===L.origin;
function arm(){clearTimeout(to);to=setTimeout(function(){e.why='t';e.c.abort()},ms||tmo())}
function fin(){clearTimeout(to);drop(e)}
arm();
return e.p.then(function(r){
arm();
if(pre)return r.arrayBuffer();
if(same){var d=now()-t0;rtt=rtt===null?d:rtt*.7+d*.3}
if(mode==='st')return r.text().then(function(t){var s=null;try{s=JSON.parse(t)}catch(x){}
// Broken JSON is the panel's own reply gone wrong, not another device.
if(!s&&/^\s*\{/.test(t)){seen();throw Error('unreadable status')}
if(!s||!s.version){foreign();throw Error('not a Patternflow panel')}alien=0;seen();return s});
if(same)seen();
if(!r.ok)return r.text().then(function(t){var x=Error(t||'HTTP '+r.status);x.status=r.status;throw x});
return mode==='text'?r.text():r.json();
}).then(function(d){fin();return d},function(x){fin();
if(e.why==='t'){x=Error('timeout');x.timeout=1}
if(e.why==='nav')x.nav=1;
else if(same&&!pre&&(x.timeout||x.name==='TypeError'))fail(x.timeout);
throw x});
}

// Background lane: one request in flight, FIFO. The panel serves one
// connection at a time; parallel polls would only queue there.
function enq(f,dead){return new Promise(function(y,n){Q.push({f:f,y:y,n:n,d:dead});pump()})}
function pump(){var j;while(!lb&&run&&!holds&&Q.length){j=Q.shift();if(j.d&&j.d())j.n(SKIP);else go(j)}}
function go(j){var p;lb=1;try{p=Promise.resolve(j.f())}catch(x){p=Promise.reject(x)}
p.then(function(d){lb=0;j.y(d);pump()},function(x){lb=0;j.n(x);pump()})}
// A function source: the fetches it starts synchronously are tracked as
// background and share the lane's timeout.
function fsrc(f){
var c=cur=[],p;
try{p=Promise.resolve(f())}catch(x){p=Promise.reject(x)}
cur=null;
return new Promise(function(y,n){
var to=setTimeout(function(){var x=Error('timeout');x.timeout=1;c.forEach(function(e){e.why='t';e.c.abort()});fail(1);n(x)},tmo());
p.then(function(d){clearTimeout(to);seen();y(d)},function(x){clearTimeout(to);
if(c.some(function(e){return e.why==='nav'})){x=Error('aborted');x.nav=1}
else if(x&&x.name==='TypeError')fail();
n(x)});
});
}
function rhold(){for(var k in RH)if(now()-RH[k]<6e5)return true;return false}
PF.poll=function(src,ms,cb,o){
var h={ms:ms,ew:0,t:0,on:1,q:0,w:0};
function next(){return Math.max(h.ms,2*h.ew,S&&S.busy||rhold()?5e3:0)}
function sched(d){clearTimeout(h.t);h.t=setTimeout(h.go,d)}
h.go=function(){
clearTimeout(h.t);h.t=0;
if(!h.on||h.q)return;
if(D.hidden||!run){h.w=1;return}
var t0;h.q=1;
enq(function(){t0=now();return typeof src==='function'?(src.pf?src():fsrc(src)):rq(src,'bg','json')},function(){return !h.on})
.then(function(d){done(1,d)},function(x){done(0,x)});
function done(ok,v){
h.q=0;
if(v===SKIP||!h.on)return;
if(!ok&&v&&v.nav){h.w=1;return}
if(ok){var d=now()-t0;h.ew=h.ew?h.ew*.7+d*.3:d}
sched(next());
ok?call(cb,v,null):call(cb,null,v);
}
};
P.push(h);
if(o&&o.first===false)sched(ms);else h.go();
return{stop:function(){h.on=0;clearTimeout(h.t);var i=P.indexOf(h);if(i>-1)P.splice(i,1)},
now:h.go,set:function(n){h.ms=n;if(h.t)sched(next())}};
};
function resume(){for(var i=0;i<P.length;i++)if(P[i].w){P[i].w=0;P[i].go()}}

// Status: one source for every page.
function stGet(){return rq('/api/status','bg','st').then(deliver)}
stGet.pf=1;
// Until a status arrives nothing else asks for one, so a failed fetch is
// retried (2 s, doubling to 30 s) unless offline's probe has taken over.
function fetchStatus(){if(!sq)sq=enq(stGet).then(clr,function(){clr();
if(!S&&!rs&&PF.state!=='offline')setTimeout(need,sb=Math.min(2*sb||2e3,3e4))});function clr(){sq=null}}
function need(){if(!S)fetchStatus()}
// Status is also kept fresh while it says busy, which floors every poll
// (not while restarting: waitForDevice is already polling it).
function sw(){
var ms=Math.min(wms,PF.state==='offline'||S&&S.busy&&!rs?5e3:1/0);
if(ms===1/0){if(sp){sp.stop();sp=null}}
else if(sp)sp.set(ms);
else sp=PF.poll(stGet,ms,function(){},{first:false});
}
function deliver(s){
S=W.pfStatus=s;sb=0;
var fn=Array.isArray(s.featureNav)?s.featureNav:[];
if(s.build+JSON.stringify(fn)!==drawn){fnav=fn;try{localStorage.setItem('pf-nav',JSON.stringify({build:s.build,nav:fn}))}catch(x){}drawNav()}
badge();
for(var i=0;i<subs.length;i++)call(subs[i],s);
ev('pf-status',s);
if(!pft)pft=setTimeout(prefetch,5e3+Math.random()*1e4);
sw();
if(s.build)vcheck(s.build);
return s;
}
PF.status=function(cb){if(cb){subs.push(cb);if(S)call(cb,S)}need()};
PF.watchStatus=function(ms){if(ms<wms)wms=ms;need();sw()};
PF.get=function(u,o){o=o||{};return rq(u,'fg',o.text?'text':'json',o.timeout)};
PF.inflight=function(){for(var n=0,i=0;i<T.length;i++)if(T[i].k==='fg'&&now()-T[i].t<6e4)n++;return n};

// Connection state.
function setState(s){
if(PF.state===s)return;
if(s==='offline')off=now();
PF.state=s;
H.classList.remove('pf-connecting','pf-offline','pf-restarting');
if(s!=='live')H.classList.add('pf-'+s);
chip();sw();ev('pf-state',s);
}
function seen(){fails=0;if(alien||rs)return;if(PF.state==='offline'&&now()-off>5e3)toast('back online','ok');setState('live')}
// Two in a row, timeouts included: one slow reply is a slow link, not a
// dead one, and calling it offline made a working console look broken.
function fail(){if(++fails>1&&!rs)setState('offline')}
function foreign(){alien=1;if(!rs)setState('offline');chip()}
PF.waitForDevice=function(o){
o=o||{};
var end=now()+(o.timeout||9e4),t0;
rs++;setState('restarting');
return new Promise(function(y,n){
function again(){setTimeout(go,Math.max(0,t0+2e3-now()))}
function go(){
if(now()>=end){if(!--rs){fails=0;setState('offline')}chip();n(Error('timeout'));return}
if(nv){setTimeout(go,500);return}
t0=now();
rq('/api/status','bg','st',3e3).then(function(s){
var ok=!(o.build&&s.build===o.build);
if(ok){rs--;seen()}
deliver(s);
ok?y(s):again();
},again);
}
go();
});
};

// Holds: an upload owns the link. This tab's lane waits; other tabs are told.
function tx(h,q){var m={id:me,h:h?1:0,q:q?1:0,t:now()};try{bc?bc.postMessage(m):localStorage.setItem('pf-hold',JSON.stringify(m))}catch(x){}}
function rx(m){if(!m||m.id===me)return;if(m.h)RH[m.id]=now();else delete RH[m.id];if(m.q&&holds)tx(1)}
try{bc=new BroadcastChannel('pf');bc.onmessage=function(e){rx(e.data)}}catch(x){bc=null}
W.addEventListener('storage',function(e){if(e.key==='pf-hold'&&e.newValue)try{rx(JSON.parse(e.newValue))}catch(x){}});
tx(0,1);
function bu(e){if(guards&&!leaveOk){e.preventDefault();e.returnValue='';return ''}}
PF.hold=function(p,o){
var g=o&&o.guard,d=0,t;
holds++;
if(g&&!guards++)W.addEventListener('beforeunload',bu);
tx(1);
function fin(){if(d)return;d=1;clearTimeout(t);holds--;if(g&&!--guards)W.removeEventListener('beforeunload',bu);tx(holds>0);pump()}
t=setTimeout(fin,6e5);
Promise.resolve(p).then(fin,fin);
return p;
};

// Version check: a page older than the firmware replaces itself, once.
function vurl(b){var u=new URL(L.href);u.searchParams.set('v',b);return u.href}
function navType(){
try{var n=performance.getEntriesByType('navigation')[0];if(n&&n.type)return n.type}catch(x){}
try{return ['navigate','reload','back_forward'][performance.navigation.type]||'navigate'}catch(x){}
return 'navigate';
}
function vcheck(b){
if(!docB&&!adopted){adopted=1;var t=navType();if(t==='navigate'||t==='reload'){docB=PF.v=b;try{history.replaceState(history.state,'',vurl(b))}catch(x){}}}
if(docB===b){if(stale){stale=null;chip()}return}
stale=b;
var a=D.activeElement,k='pf-heal:'+L.pathname+':'+b,ok=0;
if(!healed&&!holds&&!PF.dirty&&!touched&&!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))){
try{if(!sessionStorage.getItem(k)){sessionStorage.setItem(k,'1');ok=1}}catch(x){}
if(ok){healed=1;L.replace(vurl(b));return}
}
chip();
}

// Prefetch: versioned pages are immutable, so one fetched now is a tab
// switch that costs no request later. Only on a quiet, fast home link.
function pfOk(b){
var s=S,c=navigator.connection,i,l;
if(!s||s.build!==b||s.viaHotspot||s.busy||holds||rhold()||D.hidden||!run||PF.state!=='live'||c&&c.saveData||!(s.uptime>30)||rtt===null||rtt>=150||now()-pd<2e3)return false;
for(i=0;i<P.length;i++)if(P[i].ms<1e3)return false;
try{l=JSON.parse(localStorage.getItem('pf-prefetch'));if(l&&l.id!==me&&now()-l.t<6e4||sessionStorage.getItem('pf-pf:'+b))return false;
localStorage.setItem('pf-prefetch',JSON.stringify({id:me,t:now()}))}catch(x){return false}
return true;
}
function prefetch(){
var b=S&&S.build,p=here(),l=[],n=0,a=NAV.slice().sort(function(x,y){return x[2]-y[2]}).concat(fnav),i;
for(i=0;i<a.length;i++)if(a[i]&&a[i][0]!==p&&/^\/(?!\/)/.test(a[i][0]))l.push(a[i][0]);
(function step(){
if(!b||!pfOk(b))return;
if(lb||Q.length||PF.inflight()){setTimeout(step,1e3);return}
if(n>=l.length){try{sessionStorage.setItem('pf-pf:'+b,'1')}catch(x){}return}
enq(function(){return rq(l[n++]+'?v='+b,'prefetch','pre')}).then(function(){setTimeout(step,1e3)},function(){});
})();
}

// Shared UI.
function toast(t,k){
if(!tw){tq=[t,k];return}
clearTimeout(tt);tw.textContent='';
var d=D.createElement('div');d.className='t'+(k==='err'?' e':'');d.textContent=t;tw.appendChild(d);
tt=setTimeout(function(){tw.textContent=''},k==='err'?6e3:3500);
}
PF.say=function(t,k,el){
k=k||'info';
if(!el){toast(t,k);return}
clearTimeout(el._pfT);
el.textContent=t;
el.classList.remove('pf-ok','pf-err','pf-info');
el.classList.add('pf-'+k);
if(k==='ok')el._pfT=setTimeout(function(){if(el.textContent===t){el.textContent='';el.classList.remove('pf-ok')}},4e3);
};
PF.busy=function(b,p){
function f(on){if(!b)return;b.disabled=on;b.classList.toggle('pf-busy',on);if(on)b.setAttribute('aria-busy','true');else b.removeAttribute('aria-busy')}
f(true);
Promise.resolve(p).then(function(){f(false)},function(){f(false)});
return p;
};

// The header, in a shadow root. Fixed heights, matching --pf-chrome-h:
// phone 40px brand row + 40px nav row + 1px rule = 81; desktop 40 + 1 = 41.
var CSS=':host{all:initial;display:block!important;position:relative;box-sizing:border-box!important;height:var(--pf-chrome-h)!important;'
+'--a:var(--led,#FF5C2E);--i:var(--ink,var(--fg,#EDE7DB));--u:var(--rule,#242118);--k:var(--cream,var(--bg,#0C0B09));'
+'border-bottom:1px solid var(--u);background:var(--k);color:var(--muted,#8A8272);font:10px/1 var(--mono,ui-monospace,SFMono-Regular,Menlo,monospace)}'
+'[hidden]{display:none!important}a{color:inherit;text-decoration:none}a:focus-visible,button:focus-visible{outline:2px solid var(--a);outline-offset:-2px}'
+'.in{max-width:1140px;height:80px;margin:0 auto;padding:0 16px;display:grid;grid-template:"b c t" 40px "n n n" 40px/minmax(0,1fr) auto auto;column-gap:12px;align-items:center}'
+'.b{grid-area:b;display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden;white-space:nowrap}'
+'.h{display:flex;align-items:center;gap:8px;letter-spacing:.14em;text-transform:uppercase}'
+'.d{flex:none;width:5px;height:5px;border-radius:50%;background:var(--a);box-shadow:0 0 6px var(--a)}.ver{color:var(--faint,#5A5546);letter-spacing:.08em}'
+'.vb{padding:1px 6px;border:1px solid var(--a);border-radius:2px;color:var(--a);letter-spacing:.1em;text-transform:uppercase}.vb:hover{background:var(--a);color:var(--k)}'
+'.n{grid-area:n;min-width:0;height:40px;display:flex;overflow-x:auto;scrollbar-width:none;scroll-snap-type:x proximity;margin:0 -16px;padding:0 6px;font-size:11px;letter-spacing:.04em;'
+'--p:#000;--q:#000;--m:linear-gradient(90deg,var(--p),#000 24px,#000 calc(100% - 24px),var(--q));-webkit-mask-image:var(--m);mask-image:var(--m)}'
+'.n::-webkit-scrollbar{display:none}.fl{--p:transparent}.fr{--q:transparent}'
+'.n a{flex:none;display:flex;align-items:center;padding:0 10px;white-space:nowrap;scroll-snap-align:center}.n a:hover{color:var(--a)}.n a.on{color:var(--i);box-shadow:inset 0 -2px var(--a)}'
+'button{all:unset;box-sizing:border-box;height:24px;padding:0 7px;border:1px solid transparent;border-radius:2px;cursor:pointer;white-space:nowrap;letter-spacing:.1em;text-transform:uppercase}'
+'.c{grid-area:c;max-width:46vw;overflow:hidden;text-overflow:ellipsis;border-color:var(--u);letter-spacing:.04em;text-transform:none}.c.w{border-color:var(--a);color:var(--a)}.tg{grid-area:t}.tg:hover{color:var(--i)}'
+'.pg{position:absolute;left:0;top:0;width:0;height:2px;background:var(--a)}.pg.on{animation:pg 4s cubic-bezier(.1,.8,.2,1) forwards}@keyframes pg{to{width:92%}}'
+'.tw{position:fixed;left:0;right:0;bottom:24px;display:flex;justify-content:center;pointer-events:none;z-index:2147483647}'
+'.t{max-width:calc(100vw - 32px);box-sizing:border-box;padding:8px 12px;font-size:11px;line-height:1.4;border:1px solid var(--u);border-radius:2px;background:var(--panel,var(--cream2,#131110));color:var(--i)}.t.e{border-color:var(--a)}'
+'@media(max-width:479px){.ver{display:none}}'
+'@media(min-width:720px){.in{height:40px;padding:0 20px;grid-template:"b n c t" 40px/auto minmax(0,1fr) auto auto;column-gap:18px}.n{margin:0;padding:0}}';
function here(){return L.pathname.replace(/\/+$/,'')||'/'}
function bld(){return S&&S.build||PF.v||cn&&cn.build||''}
function href(p){var b=bld();return p+(b?'?v='+b:'')}
function drawNav(){
if(!nav)return;
var l=NAV.slice(),p=here(),i,j=0,a,e,r;
for(i=0;i<fnav.length;i++){e=fnav[i];if(e&&typeof e[0]==='string'&&/^\/(?!\/)/.test(e[0])&&e[1])l.splice(NAV_AT+j++,0,e)}
drawn=bld()+JSON.stringify(fnav);
nav.textContent='';
for(i=0;i<l.length;i++){a=D.createElement('a');a.href=href(l[i][0]);a.textContent=l[i][1];if(l[i][0]===p){a.className='on';a.setAttribute('aria-current','page')}nav.appendChild(a)}
hl.href=href('/');
// scrollLeft, not scrollIntoView, which would scroll the page too.
a=nav.querySelector('.on');
if(a){e=nav.getBoundingClientRect();r=a.getBoundingClientRect();nav.scrollLeft+=r.left+r.width/2-e.left-e.width/2}
fades();
}
function fades(){if(!nav)return;var s=nav.scrollLeft;nav.classList.toggle('fl',s>1);nav.classList.toggle('fr',s<nav.scrollWidth-nav.clientWidth-1)}
function badge(){
if(!sr||!S)return;
var s=S,v=s.variant&&s.variant!=='core';
ver.textContent=s.version?(v?'core v':'v')+s.version:'';
vb.hidden=!v;
if(v){vb.textContent=s.variant+(s.variantVersion?' '+s.variantVersion:'');vb.href='https://patternflow.work/editions#'+encodeURIComponent(s.variant)}
}
function chip(){
if(!ch)return;
var s=PF.state,t=s==='restarting'?'restarting\u2026':alien?'not a Patternflow panel':s==='offline'?'offline \u2014 retrying':stale?'Console updated \u2014 tap to reload':s==='connecting'&&ct?'connecting\u2026':'';
ch.textContent=t;ch.hidden=!t;ch.className=t&&s!=='connecting'?'c w':'c';
}
function tgl(){var l=H.getAttribute('data-theme')==='light';tg.textContent=l?'Dark':'Light';tg.title='Switch to '+(l?'dark':'light')+' theme'}
function mount(){
if(sr||!D.body)return;
if(!D.querySelector('link[rel~="icon"]')){var ic=D.createElement('link');ic.rel='icon';ic.href='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"%3E%3Ccircle cx="8" cy="8" r="5" fill="%23FF5C2E"/%3E%3C/svg%3E';(D.head||H).appendChild(ic)}
var host=D.createElement('pf-chrome');host.id='pfChrome';
sr=host.attachShadow({mode:'open'});
sr.innerHTML='<style>'+CSS+'</style><div class="in"><div class="b"><a class="h" href="/"><i class="d"></i>Patternflow <span class="ver"></span></a><a class="vb" target="_blank" rel="noopener" hidden></a></div>'
+'<nav class="n" aria-label="Console"></nav><button class="c" type="button" hidden></button><button class="tg" type="button"></button></div><div class="pg"></div><div class="tw" aria-live="polite"></div>';
function q(c){return sr.querySelector('.'+c)}
hl=q('h');ver=q('ver');vb=q('vb');nav=q('n');ch=q('c');tg=q('tg');pg=q('pg');tw=q('tw');
D.body.insertBefore(host,D.body.firstChild);
H.classList.add('pf-mounted');
nav.addEventListener('scroll',fades,{passive:true});
W.addEventListener('resize',fades);
tg.onclick=function(){var l=H.getAttribute('data-theme')!=='light';H.setAttribute('data-theme',l?'light':'dark');try{localStorage.setItem('pf-theme',l?'light':'dark')}catch(x){}tgl()};
ch.onclick=function(){if(stale)L.replace(vurl(stale));else if(PF.state==='offline')fetchStatus()};
tgl();drawNav();badge();chip();
setTimeout(function(){ct=1;chip()},800);
if(tq){toast(tq[0],tq[1]);tq=null}
// The page's own first requests go before status (up to 1.2 s).
var t0=now();
(function w(){if(S||sq)return;if(PF.inflight()&&now()-t0<1200)setTimeout(w,50);else fetchStatus()})();
}

// Navigation.
function anchor(e){
var p=e.composedPath?e.composedPath():[],i,t=e.target;
for(i=0;i<p.length;i++)if(p[i].tagName==='A'&&p[i].href)return p[i];
return t&&t.closest?t.closest('a[href]'):null;
}
// Site links carry this panel's address (?device=), so the site need not
// resolve patternflow.local to reach it.
D.addEventListener('click',function(e){
var a=anchor(e),ip;
if(!a||!/^https:\/\/([a-z0-9-]+\.)*patternflow\.work([\/?#]|$)/.test(a.href))return;
ip=/^\d+\.\d+\.\d+\.\d+$/.test(L.hostname)?L.hostname:S&&S.ip;
if(!ip)return;
try{var u=new URL(a.href);if(!u.searchParams.has('device')){u.searchParams.set('device',ip);a.href=u.href}}catch(x){}
},true);
function isPage(p){
var i;for(i=0;i<NAV.length;i++)if(NAV[i][0]===p)return 1;
for(i=0;i<fnav.length;i++)if(fnav[i]&&fnav[i][0]===p)return 1;
return 0;
}
function restore(){
nv=0;leaveOk=0;run=1;clearTimeout(pgT);clearTimeout(nvT);
if(pg)pg.className='pg';
drawNav();need();resume();pump();
}
// A tab switch frees the device's one connection for the next page at once.
D.addEventListener('click',function(e){
if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
var a=anchor(e),g,u,i;
if(!a||a.hasAttribute('download'))return;
g=a.getAttribute('target');if(g&&g!=='_self')return;
try{u=new URL(a.href,L.href)}catch(x){return}
if(u.origin!==L.origin)return;
// A page's own links to console pages get the version too, so they come
// out of the cache like the tabs do.
if(!u.searchParams.has('v')&&bld()&&isPage(u.pathname)){u.searchParams.set('v',bld());a.href=u.href}
if(u.pathname+u.search===L.pathname+L.search)return;
if(guards){if(!confirm('An upload is running \u2014 leave anyway?')){e.preventDefault();return}leaveOk=1}
nv=1;run=0;
for(i=T.length;i--;)if(!(T[i].k==='prefetch'&&T[i].u===u.href)){T[i].why='nav';T[i].c.abort()}
if(nav)for(i=0;i<nav.children.length;i++)nav.children[i].className=nav.children[i].pathname===u.pathname?'on':'';
clearTimeout(pgT);clearTimeout(nvT);
pgT=setTimeout(function(){if(pg)pg.className='pg on'},150);
// Still visible 3 s on: the navigation was cancelled.
nvT=setTimeout(function chk(){if(D.hidden)nvT=setTimeout(chk,3e3);else restore()},3e3);
});
W.addEventListener('pagehide',function(){
run=0;
for(var i=T.length;i--;){T[i].why='nav';T[i].c.abort()}
for(i=0;i<P.length;i++){clearTimeout(P[i].t);P[i].t=0;P[i].w=1}
if(holds)tx(0);
});
W.addEventListener('pageshow',function(e){
if(!e.persisted)return;
S=null;
if(holds)tx(1);
restore();
ev('pf-restore');
});
D.addEventListener('visibilitychange',function(){if(!D.hidden&&run)resume()});
['pointerdown','keydown','input'].forEach(function(t){D.addEventListener(t,function(){touched=1;if(t==='pointerdown')pd=now()},true)});
if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',mount);else mount();
})();
