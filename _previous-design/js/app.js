/* ============================================================
   DEEPDREAMS — APP LOGIC
   You don't need to edit this. All your details live in config.js
   ============================================================ */
const CFG = window.DD_CONFIG;

/* ---------- helpers ---------- */
const $ = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
const ytId = u=>{ if(!u) return ""; u=(""+u).trim();
  const m=u.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([\w-]{11})/);
  return m?m[1]:(u.length===11?u:""); };
const thumb = id=>`https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const waLink = ()=>`https://wa.me/${CFG.WHATSAPP}?text=${encodeURIComponent(CFG.WHATSAPP_MSG)}`;

/* ---------- wire up config-driven links ---------- */
$('#yr').textContent = new Date().getFullYear();
[ '#heroWa','#waBtn','#fab' ].forEach(s=>{ const el=$(s); if(el) el.href=waLink(); });
$('#mailBtn').href = `mailto:${CFG.EMAIL}`;
$('#igLink').href  = CFG.INSTAGRAM;
$('#ytLink').href  = CFG.YOUTUBE;
[ '#heroWa','#waBtn','#fab','#igLink','#ytLink' ].forEach(s=>{ const el=$(s); if(el){el.target="_blank";el.rel="noopener";} });

/* hero featured video */
(()=>{ const id=ytId(CFG.HERO_VIDEO);
  $('#heroFrame').src=`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&playsinline=1&rel=0`;
})();

/* ---------- preloader ---------- */
window.addEventListener('load',()=>{
  if(window.gsap) {
    const tl=gsap.timeline({
      onComplete:()=>{
        document.body.classList.remove('loading');
        initHero();
      }
    });
    tl.to('.pre-bar i',{width:'100%',duration:1.4,ease:'power2.inOut'})
      .to('.pre-logo',{opacity:0,scale:0.8,duration:0.4,ease:'power2.in'},'-=0.1')
      .to('.pre-bar',{opacity:0,duration:0.25},'-=0.25')
      .to('.preloader',{yPercent:-100,duration:0.75,ease:'power3.inOut'})
      .set('.preloader',{display:'none'});
  } else {
    setTimeout(()=>{ $('#preloader').classList.add('done'); document.body.classList.remove('loading'); initHero(); },800);
  }
});
document.body.classList.add('loading');

/* ---------- Lenis smooth scroll ---------- */
let lenis;
if(window.Lenis && !matchMedia('(prefers-reduced-motion:reduce)').matches){
  lenis=new Lenis({lerp:.09,wheelMultiplier:1,smoothTouch:false});
  function raf(t){lenis.raf(t);requestAnimationFrame(raf);} requestAnimationFrame(raf);
  if(window.ScrollTrigger){ lenis.on('scroll',()=>ScrollTrigger.update()); }
}
/* anchor links via Lenis */

$$('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
  const t=$(a.getAttribute('href')); if(!t)return; e.preventDefault();
  lenis?lenis.scrollTo(t,{offset:-10}):t.scrollIntoView({behavior:'smooth'});
}));

/* ---------- GSAP entrance animations ---------- */
function initHero(){
  if(!window.gsap)return;
  gsap.registerPlugin(ScrollTrigger);
  const tl=gsap.timeline({defaults:{ease:'power3.out'}});
  tl.to('.hero-title .line>span',{y:0,duration:1,stagger:.12})
    .from('.eyebrow',{y:24,opacity:0,duration:.7},'-=.9')
    .from('.hero-sub',{y:24,opacity:0,duration:.7},'-=.6')
    .from('.hero-actions',{y:24,opacity:0,duration:.7},'-=.5')
    .to('.hero-video',{opacity:1,scale:1,duration:1.1,ease:'power3.out'},'-=.5');

  /* scroll reveals */

  $$('.reveal').forEach(el=>{
    gsap.to(el,{y:0,opacity:1,duration:1,ease:'power3.out',
      scrollTrigger:{trigger:el,start:'top 86%'}});
  });

  $$('.reveal-scale').forEach(el=>{
    gsap.to(el,{scale:1,opacity:1,duration:1,ease:'power3.out',
      scrollTrigger:{trigger:el,start:'top 88%'}});
  });

  /* word-by-word statement */
  const st=$('.reveal-words');
  if(st){ st.innerHTML=st.innerHTML.replace(/(<em>.*?<\/em>|[^<>\s]+)/g,m=>`<span>${m}</span> `);
    gsap.to('.reveal-words span',{opacity:1,stagger:.06,ease:'none',
      scrollTrigger:{trigger:st,start:'top 80%',end:'bottom 60%',scrub:true}});
  }

  /* count-up stats */

  $$('[data-count]').forEach(el=>{
    const end=+el.dataset.count;
    ScrollTrigger.create({trigger:el,start:'top 90%',once:true,onEnter:()=>{
      gsap.to(el,{innerText:end,duration:1.6,snap:{innerText:1},ease:'power2.out'});
    }});
  });

  /* orbs float via CSS keyframes */
}

/* ---------- header scroll state ---------- */
let lastY=0;
(lenis||window).addEventListener?.('scroll',()=>{},{});
function onScroll(y){
  const h=$('#header');
  h.classList.toggle('scrolled',y>40);
  h.classList.toggle('hide',y>lastY&&y>140);
  lastY=y;
}
if(lenis){ lenis.on('scroll',({scroll})=>onScroll(scroll)); }
else { window.addEventListener('scroll',()=>onScroll(window.scrollY),{passive:true}); }

/* ---------- starfield canvas ---------- */
(()=>{
  const c=$('#stars'),x=c.getContext('2d'); let w,hh,stars;
  function size(){w=c.width=innerWidth;hh=c.height=innerHeight;
    stars=[...Array(70)].map(()=>({x:Math.random()*w,y:Math.random()*hh,r:Math.random()*1.3,a:Math.random(),s:Math.random()*.02+.005}));}
  function draw(){x.clearRect(0,0,w,hh);
    stars.forEach(st=>{st.a+=st.s;st.y-=st.s*15;if(st.y<0)st.y=hh;
      const o=(Math.sin(st.a)+1)/2;
      x.beginPath();x.arc(st.x,st.y,st.r,0,7);
      x.fillStyle=`rgba(${o>.6?'95,208,255':'227,193,121'},${o*.6})`;x.fill();});
    requestAnimationFrame(draw);}
  size();draw();addEventListener('resize',size);
})();

/* ---------- cursor glow (desktop) ---------- */
(()=>{ const g=$('#cursorGlow');
  if(matchMedia('(hover:hover)').matches){
    addEventListener('mousemove',e=>{g.style.left=e.clientX+'px';g.style.top=e.clientY+'px';});
  }
})();

/* ---------- magnetic buttons (desktop) ---------- */
if(matchMedia('(hover:hover)').matches){

  $$('[data-magnetic]').forEach(el=>{
    el.addEventListener('mousemove',e=>{const r=el.getBoundingClientRect();
      gsap?.to(el,{x:(e.clientX-r.left-r.width/2)*.3,y:(e.clientY-r.top-r.height/2)*.3,duration:.4});});
    el.addEventListener('mouseleave',()=>gsap?.to(el,{x:0,y:0,duration:.5,ease:'elastic.out(1,.4)'}));
  });
}

/* ============================================================
   GALLERY — pulled live from your Google Sheet
   ============================================================ */
let VIDEOS=[];
const DEMO=[
  {title:'In Loving Memory — Grandmother',youtube:'dQw4w9WgXcQ',category:'Memorial'},
  {title:'Wedding Tribute — A & R',youtube:'dQw4w9WgXcQ',category:'Wedding'},
  {title:'A Father, A Life Well Lived',youtube:'dQw4w9WgXcQ',category:'Memorial'},
  {title:'Birthday Celebration Film',youtube:'dQw4w9WgXcQ',category:'Celebration'},
  {title:'Anniversary Story — 25 Years',youtube:'dQw4w9WgXcQ',category:'Wedding'},
  {title:'Baby\'s First Year',youtube:'dQw4w9WgXcQ',category:'Celebration'}
];

async function loadVideos(){
  const g=$('#gallery');
  if(!CFG.SHEET_ID||CFG.SHEET_ID==="PASTE_YOUR_SHEET_ID_HERE"){
    VIDEOS=DEMO; buildFilters(); render(VIDEOS); return;
  }
  const url=`https://docs.google.com/spreadsheets/d/${CFG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(CFG.SHEET_TAB)}`;
  try{
    const t=await (await fetch(url)).text();
    const j=JSON.parse(t.substring(t.indexOf('{'),t.lastIndexOf('}')+1));
    const cols=j.table.cols.map(c=>{
      const lbl = (c.label||'').toLowerCase().trim();
      if(lbl.includes('youtube')) return 'youtube';
      if(lbl.includes('title')) return 'title';
      if(lbl.includes('category')) return 'category';
      if(lbl.includes('featured')) return 'featured';
      return lbl;
    });
    VIDEOS=j.table.rows.map(r=>{const o={};r.c.forEach((cell,i)=>{if(cols[i])o[cols[i]]=cell?cell.v:'';});return o;})
      .filter(r=>r.youtube);
    if(!VIDEOS.length){VIDEOS=DEMO;}
    /* featured first */
    VIDEOS.sort((a,b)=>(/yes|true|1/i.test(b.featured)?1:0)-(/yes|true|1/i.test(a.featured)?1:0));
  }catch(e){ console.warn('Sheet fetch failed, using demo:',e); VIDEOS=DEMO; }
  buildFilters(); render(VIDEOS);
}

function buildFilters(){
  const cats=['All',...new Set(VIDEOS.map(v=>v.category).filter(Boolean))];
  $('#filters').innerHTML=cats.map((c,i)=>`<button class="chip ${i?'':'active'}" data-cat="${c}">${c}</button>`).join('');

  $$('#filters .chip').forEach(chip=>chip.addEventListener('click',()=>{

    $$('#filters .chip').forEach(c=>c.classList.remove('active'));
    chip.classList.add('active');
    const cat=chip.dataset.cat;
    render(cat==='All'?VIDEOS:VIDEOS.filter(v=>v.category===cat));
  }));
}

function render(list){
  const g=$('#gallery');
  g.innerHTML=list.map(v=>{const id=ytId(v.youtube);
    return `<div class="gallery-item reveal">
      <div class="card" data-id="${id}" data-title="${(v.title||'Tribute Film').replace(/"/g,'&quot;')}">
        <img loading="lazy" src="${thumb(id)}" alt="${v.title||'Tribute film'}">
        <div class="play"><b></b></div>
        <button class="card-wa-btn" data-title="${(v.title||'Tribute Film').replace(/"/g,'&quot;')}" data-id="${id}" title="Order this style">
          <svg viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.737-.979z"/></svg>
        </button>
      </div>
      <div class="card-meta">
        <small>${v.category||'Tribute'}</small>
        <h3>${v.title||'Tribute Film'}</h3>
      </div>
    </div>`;}).join('');

  $$('#gallery .card').forEach(c=>c.addEventListener('click',()=>openLB(c.dataset.id,c.dataset.title)));

  $$('#gallery .card-wa-btn').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const title=b.dataset.title;
    const id=b.dataset.id;
    const msg=`Hi DeepDreams, I would like to get a video tribute similar to: "${title}" (https://youtu.be/${id})`;
    window.open(`https://wa.me/${CFG.WHATSAPP}?text=${encodeURIComponent(msg)}`,'_blank','noopener');
  }));

  /* re-run reveal for freshly added cards */
  if(window.gsap){ $$('#gallery .reveal').forEach((el,i)=>{
    gsap.fromTo(el,{y:30,opacity:0},{y:0,opacity:1,duration:.7,delay:i*.08,ease:'power3.out',
      scrollTrigger:{trigger:el,start:'top 92%'}}); }); }
}

/* ---------- lightbox ---------- */
function openLB(id,title){
  const msg=`Hi DeepDreams, I would like to get a video tribute similar to: "${title||'Tribute Film'}" (https://youtu.be/${id})`;
  const link=`https://wa.me/${CFG.WHATSAPP}?text=${encodeURIComponent(msg)}`;
  $('#lbInner').innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
  $('#lbTitle').innerHTML=`<span>${title||''}</span>
    <a href="${link}" target="_blank" rel="noopener" class="lb-wa-btn">
      <svg viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.737-.979z"/></svg>
      Order this Style
    </a>`;
  $('#lb').classList.add('open'); lenis?.stop();
}
function closeLB(){ $('#lb').classList.remove('open'); lenis?.start();
  setTimeout(()=>{$('#lbInner').innerHTML='';$('#lbTitle').textContent='';},400); }
$('#lbClose').addEventListener('click',closeLB);
$('#lb').addEventListener('click',e=>{if(e.target.id==='lb')closeLB();});

/* ---------- UPI ---------- */
$('#upiId').textContent=CFG.UPI_ID;
$('#upiPay').href=`upi://pay?pa=${encodeURIComponent(CFG.UPI_ID)}&pn=${encodeURIComponent(CFG.UPI_NAME)}&cu=INR`;
$('#upiBtn').addEventListener('click',()=>{$('#upiModal').classList.add('open');lenis?.stop();});
$('#upiClose').addEventListener('click',()=>{$('#upiModal').classList.remove('open');lenis?.start();});
$('#upiModal').addEventListener('click',e=>{if(e.target.id==='upiModal'){$('#upiModal').classList.remove('open');lenis?.start();}});
$('#upiId').addEventListener('click',()=>{navigator.clipboard?.writeText(CFG.UPI_ID);$('#upiId').textContent='Copied ✓';setTimeout(()=>$('#upiId').textContent=CFG.UPI_ID,1400);});

/* ---------- marquee ---------- */
(()=>{ const words=['Tribute Films','Memorial Videos','Wedding Stories','AI Cinematics','Websites','Chrome Extensions','AI Agents'];
  const set=`<span>${words.join('</span><span>')}</span>`;
  $('#marquee').innerHTML=set+set; })();

/* ---------- esc to close modals ---------- */
addEventListener('keydown',e=>{if(e.key==='Escape'){closeLB();$('#upiModal').classList.remove('open');lenis?.start();}});

/* go */
loadVideos();
