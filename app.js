/* ============ 共用電商引擎 ============
   每個店面只要定義 window.SHOP（品牌 + 主題 + 商品），
   這支引擎負責：路由(可上一頁)、購物車(localStorage)、詳情頁、篩選排序搜尋。
====================================================== */
(function(){
  const SHOP = window.SHOP;
  const $ = s => document.querySelector(s);
  const view = h => { document.getElementById('app').innerHTML = h; };

  // ---- 狀態 ----
  let cart = {};
  let filter = { cat:'all', sort:'featured', q:'' };
  let detailQty = 1;

  // ---- 工具 ----
  const money = n => 'NT$' + n.toLocaleString();
  const find = id => SHOP.products.find(p => p.id === id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  const starSvg = f => `<svg viewBox="0 0 24 24" fill="${f?'var(--star)':'none'}" stroke="var(--star)" stroke-width="1.6"><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.6 3.2L6.7 14l-5-4.8 7-.9z"/></svg>`;
  function stars(r){ let h=''; for(let i=1;i<=5;i++) h+=starSvg(i<=Math.round(r)); return `<span class="stars">${h}</span>`; }

  // ---- 購物車存取 ----
  function loadCart(){ try{ cart = JSON.parse(localStorage.getItem(SHOP.key)||'{}'); }catch(e){ cart={}; } }
  function saveCart(){ try{ localStorage.setItem(SHOP.key, JSON.stringify(cart)); }catch(e){} }
  const cartCount = () => Object.values(cart).reduce((a,b)=>a+b,0);
  const cartSubtotal = () => Object.entries(cart).reduce((s,[id,q])=>{ const p=find(+id); return s+(p?p.price*q:0); },0);

  function syncAll(){ updateCartUI(); if(location.hash.startsWith('#/cart')) renderCartPage(); }
  function addToCart(id,n){ const p=find(id); if(!p||p.stock<=0) return;
    const before=cart[id]||0, next=Math.min(before+(n||1), p.stock);
    if(next===before){ toast('已達庫存上限，無法再加'); return; }
    cart[id]=next; saveCart(); syncAll(); toast(`已加入「${p.name}」`,true); }
  function setQty(id,q){ const p=find(id); q=Math.max(0, Math.min(q, p?p.stock:q));
    if(q<=0) delete cart[id]; else cart[id]=q; saveCart(); syncAll(); }
  function removeItem(id){ delete cart[id]; saveCart(); syncAll(); }

  // ---- 購物車 UI（徽章 + 側欄 + 免運條）----
  function updateCartUI(){
    const c=cartCount(); const badge=$('#cartBadge');
    badge.textContent=c; badge.classList.toggle('hide', c===0);

    const ids=Object.keys(cart).filter(id=>cart[id]>0 && find(+id));
    const items=$('#drawerItems');
    if(ids.length===0){
      items.innerHTML=`<div class="empty"><div class="big">${SHOP.emptyIcon||'🛒'}</div>購物車是空的<br>挑一個喜歡的吧</div>`;
    } else {
      items.innerHTML=ids.map(id=>{ const p=find(+id),q=cart[id];
        return `<div class="line">
          <div class="pic" onclick="SHOPAPP.go('#/product/${p.id}')">${SHOP.art(p,false)}</div>
          <div class="info">
            <b onclick="SHOPAPP.go('#/product/${p.id}')">${esc(p.name)}</b>
            <div class="p">${money(p.price)}</div>
            <div class="ctl">
              <div class="mini-step">
                <button onclick="SHOPAPP.setQty(${p.id},${q-1})">−</button><span>${q}</span>
                <button onclick="SHOPAPP.setQty(${p.id},${q+1})" ${q>=p.stock?'disabled':''}>＋</button>
              </div>
              <span class="lt">${money(p.price*q)}</span>
            </div>
            <button class="rm" onclick="SHOPAPP.removeItem(${p.id})">移除</button>
          </div></div>`; }).join('');
    }
    const sub=cartSubtotal(), need=SHOP.freeShip-sub, bar=$('#shipBar');
    if(need>0&&sub>0){ bar.className='ship-bar';
      bar.innerHTML=`再買 <b>${money(need)}</b> 即可免運費<div class="track"><div class="fill" style="width:${Math.min(100,sub/SHOP.freeShip*100)}%"></div></div>`; }
    else if(sub>0){ bar.className='ship-bar done'; bar.innerHTML='✓ 已達免運門檻，本單免運費'; }
    else { bar.className='ship-bar'; bar.innerHTML=`滿 ${money(SHOP.freeShip)} 免運費`; }
    const ship=sub>=SHOP.freeShip?0:SHOP.shipFee, payable=sub===0?0:sub+ship;
    $('#drawerSummary').innerHTML=`
      <div class="row"><span>小計</span><span>${money(sub)}</span></div>
      <div class="row"><span>運費</span><span>${sub===0?'—':(ship===0?'免運':money(ship))}</span></div>
      <div class="total"><span>應付總額</span><b>${money(payable)}</b></div>`;
  }

  function openCart(){ $('#overlay').classList.add('open'); $('#drawer').classList.add('open'); }
  function closeCart(){ $('#overlay').classList.remove('open'); $('#drawer').classList.remove('open'); }

  // ---- 篩選 ----
  function filtered(){
    let list=SHOP.products.slice();
    if(filter.cat!=='all') list=list.filter(p=>p.cat===filter.cat);
    if(filter.q){ const q=filter.q.toLowerCase(); list=list.filter(p=>(p.name+p.tag+p.desc).toLowerCase().includes(q)); }
    if(filter.sort==='price-asc') list.sort((a,b)=>a.price-b.price);
    else if(filter.sort==='price-desc') list.sort((a,b)=>b.price-a.price);
    else if(filter.sort==='rating') list.sort((a,b)=>b.rating-a.rating);
    return list;
  }

  function cardHtml(p){ const sold=p.stock<=0;
    return `<div class="card" onclick="SHOPAPP.go('#/product/${p.id}')">
      <div class="thumb">${SHOP.art(p,false)}
        ${p.badge?`<span class="flag">${esc(p.badge)}</span>`:''}
        ${sold?'<span class="flag soldout">已售完</span>':''}
        <div class="quick" onclick="event.stopPropagation()">
          <button class="qadd" ${sold?'disabled':''} onclick="SHOPAPP.add(${p.id})">${sold?'已售完':'加入購物車'}</button>
          <button class="qview" onclick="SHOPAPP.go('#/product/${p.id}')">查看</button>
        </div>
      </div>
      <div class="card-body">
        <div class="tag">${esc(p.tag)}</div>
        <h3>${esc(p.name)}</h3>
        <div class="rate">${stars(p.rating)} <span>${p.rating} · ${p.reviews} 則評價</span></div>
        <div class="price-row">
          <span class="price"><small>NT$</small> ${p.price.toLocaleString()}</span>
          ${p.origPrice?`<span class="orig">${money(p.origPrice)}</span>`:''}
        </div>
      </div></div>`;
  }

  // ---- 首頁 ----
  function renderHome(){
    $('#crumb').innerHTML='';
    const list=filtered();
    const cats=SHOP.categories.map(c=>`<button class="chip ${filter.cat===c.key?'on':''}" onclick="SHOPAPP.setCat('${c.key}')">${esc(c.label)}</button>`).join('');
    view(`
      <section class="hero">
        <div>
          <div class="eyebrow">${esc(SHOP.eyebrow)}</div>
          <h1>${SHOP.heroTitle}</h1>
          <p>${esc(SHOP.heroDesc)}</p>
          <a class="cta" onclick="SHOPAPP.scrollShop()">${esc(SHOP.heroCta)} →</a>
        </div>
        <div class="hero-art">${SHOP.heroArt}</div>
      </section>
      <div class="toolbar" id="shopTop">
        <div class="chips">${cats}</div>
        <div class="sortwrap">排序
          <select onchange="SHOPAPP.setSort(this.value)">
            <option value="featured" ${filter.sort==='featured'?'selected':''}>精選推薦</option>
            <option value="price-asc" ${filter.sort==='price-asc'?'selected':''}>價格：低到高</option>
            <option value="price-desc" ${filter.sort==='price-desc'?'selected':''}>價格：高到低</option>
            <option value="rating" ${filter.sort==='rating'?'selected':''}>評價最高</option>
          </select>
        </div>
      </div>
      <div class="result-count">共 ${list.length} 項商品${filter.q?`，搜尋「${esc(filter.q)}」`:''}${(filter.q||filter.cat!=='all')?` · <a onclick="SHOPAPP.clearFilter()" style="color:var(--accent);cursor:pointer;text-decoration:underline">清除篩選</a>`:''}</div>
      <div class="grid">${ list.length? list.map(cardHtml).join('') : `<div class="empty" style="grid-column:1/-1">找不到符合的商品。<br><button class="chip" style="margin-top:14px" onclick="SHOPAPP.clearFilter()">清除搜尋與篩選</button></div>` }</div>`);
  }

  // ---- 詳情頁 ----
  function renderDetail(id){
    const p=find(id); if(!p){ go('#/'); return; }
    const catLabel=(SHOP.categories.find(c=>c.key===p.cat)||{label:'全部商品'}).label;
    $('#crumb').innerHTML=`<a onclick="SHOPAPP.go('#/')">首頁</a><span class="sep">/</span><a onclick="SHOPAPP.goCat('${p.cat}')">${esc(catLabel)}</a><span class="sep">/</span><span>${esc(p.name)}</span>`;
    const sold=p.stock<=0;
    const specRows=(p.specs||[]).map(s=>`<tr><td>${esc(s.k)}</td><td>${esc(s.v)}</td></tr>`).join('');
    let rel=SHOP.products.filter(x=>x.id!==p.id&&x.cat===p.cat).slice(0,4);
    if(rel.length<4) rel=SHOP.products.filter(x=>x.id!==p.id).slice(0,4);
    detailQty=1;
    view(`
      <div class="wrap"><span class="back-link" onclick="SHOPAPP.go('#/')">← 回商品列表</span></div>
      <section class="detail">
        <div class="gallery">
          <div class="zoom" id="zoom" onmousemove="SHOPAPP.zoomMove(event)" onmouseleave="SHOPAPP.zoomOut()">
            ${SHOP.art(p,true)}
            <span class="zoom-hint">滑鼠移動查看</span>
          </div>
        </div>
        <div class="dinfo">
          <div class="tag">${esc(p.tag)}</div>
          <h1>${esc(p.name)}</h1>
          <div class="rate">${stars(p.rating)} <span>${p.rating} · ${p.reviews} 則評價</span></div>
          <div class="dprice">
            <span class="price">${money(p.price)}</span>
            ${p.origPrice?`<span class="orig">${money(p.origPrice)}</span><span class="save">省 ${money(p.origPrice-p.price)}</span>`:''}
          </div>
          <div class="stock ${p.stock<=5?'low':''}">${ sold?'目前缺貨':(p.stock<=5?`僅剩 ${p.stock} 件，要快`:`現貨供應中（庫存 ${p.stock}）`) }</div>
          <p class="long">${esc(p.longDesc||p.desc)}</p>
          <div class="qtybar">
            <div class="stepper">
              <button id="dMinus" onclick="SHOPAPP.dStep(-1)" disabled>−</button><span id="dQty">1</span><button id="dPlus" onclick="SHOPAPP.dStep(1)" ${p.stock<=1?'disabled':''}>＋</button>
            </div>
            <button class="buy" ${sold?'disabled':''} onclick="SHOPAPP.buyNow(${p.id})">${sold?'已售完':'加入購物車'}</button>
          </div>
          <div class="specs"><h3>商品規格</h3><table>${specRows}</table></div>
        </div>
      </section>
      <section class="related">
        <h2>你可能也會喜歡</h2>
        <div class="rel-grid">${rel.map(cardHtml).join('')}</div>
      </section>`);
  }
  function dStep(d){ const p=curProduct(); if(!p) return; const max=p.stock||0;
    const nv=Math.max(1, Math.min(detailQty+d, max||1));
    if(nv===detailQty && d>0) toast('已達庫存上限');
    detailQty=nv; const q=$('#dQty'); if(q) q.textContent=detailQty;
    const mn=$('#dMinus'), pl=$('#dPlus');
    if(mn) mn.disabled=detailQty<=1; if(pl) pl.disabled=detailQty>=max; }
  function buyNow(id){ addToCart(id, detailQty); openCart(); }
  function curProduct(){ const m=location.hash.match(/#\/product\/(\d+)/); return m?find(+m[1]):null; }
  function zoomMove(e){ const z=$('#zoom'); if(!z) return; const svg=z.querySelector('svg'); if(!svg) return;
    const r=z.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width*100, y=(e.clientY-r.top)/r.height*100;
    svg.style.transformOrigin=`${x}% ${y}%`; svg.style.transform='scale(2.2)'; }
  function zoomOut(){ const z=$('#zoom'); const svg=z&&z.querySelector('svg'); if(svg){ svg.style.transform='scale(1)'; svg.style.transformOrigin='center'; } }

  // ---- 購物車整頁 ----
  function renderCartPage(){
    $('#crumb').innerHTML=`<a onclick="SHOPAPP.go('#/')">首頁</a><span class="sep">/</span><span>購物車</span>`;
    const ids=Object.keys(cart).filter(id=>cart[id]>0 && find(+id));
    if(ids.length===0){
      view(`<div class="cartpage"><div class="cart-empty"><div class="big">${SHOP.emptyIcon||'🛒'}</div>
        <h1>購物車是空的</h1><p>還沒挑到喜歡的？回去逛逛吧。</p>
        <a class="cta" onclick="SHOPAPP.go('#/')">開始購物</a></div></div>`); return;
    }
    const sub=cartSubtotal(), ship=sub>=SHOP.freeShip?0:SHOP.shipFee;
    const rows=ids.map(id=>{ const p=find(+id),q=cart[id];
      return `<div class="cart-row">
        <div class="pic" onclick="SHOPAPP.go('#/product/${p.id}')">${SHOP.art(p,false)}</div>
        <div class="d">
          <b onclick="SHOPAPP.go('#/product/${p.id}')">${esc(p.name)}</b>
          <div class="tag">${esc(p.tag)}</div>
          <div class="unit">${money(p.price)} / 件</div>
        </div>
        <div class="stepper">
          <button onclick="SHOPAPP.setQty(${p.id},${q-1})">−</button><span>${q}</span>
          <button onclick="SHOPAPP.setQty(${p.id},${q+1})" ${q>=p.stock?'disabled':''}>＋</button>
        </div>
        <span class="lt">${money(p.price*q)}</span>
        <button class="rm" onclick="SHOPAPP.removeItem(${p.id})" data-tip="從購物車移除">✕</button>
      </div>`; }).join('');
    view(`<div class="cartpage">
      <h1>購物車（${cartCount()} 件）</h1>
      <div class="cart-layout">
        <div class="cart-items">${rows}</div>
        <div class="summary">
          <h3>訂單摘要</h3>
          <div class="row"><span>商品小計</span><span>${money(sub)}</span></div>
          <div class="row"><span>運費</span><span>${ship===0?'免運':money(ship)}</span></div>
          <div class="grand"><span>應付總額</span><b>${money(sub+ship)}</b></div>
          <button class="checkout" onclick="SHOPAPP.checkout()">前往結帳</button>
          <span class="continue" onclick="SHOPAPP.go('#/')">← 繼續購物</span>
        </div>
      </div></div>`);
  }

  let lastOrder=null;
  function orderNo(){ return 'KY'+Date.now().toString().slice(-8); }
  function checkout(){
    const ids=Object.keys(cart).filter(id=>cart[id]>0 && find(+id));
    if(ids.length===0){ toast('購物車是空的喔'); return; }
    const sub=cartSubtotal(), ship=sub>=SHOP.freeShip?0:SHOP.shipFee;
    lastOrder={ items:ids.map(id=>({p:find(+id),q:cart[id]})), sub, ship, total:sub+ship, no:orderNo() };
    cart={}; saveCart(); updateCartUI(); closeCart(); go('#/done'); }

  function renderDone(){
    $('#crumb').innerHTML=`<a onclick="SHOPAPP.go('#/')">首頁</a><span class="sep">/</span><span>訂單完成</span>`;
    if(!lastOrder){ go('#/'); return; }
    const o=lastOrder;
    const rows=o.items.map(it=>`<div class="cart-row">
        <div class="pic">${SHOP.art(it.p,false)}</div>
        <div class="d"><b>${esc(it.p.name)}</b><div class="unit">${money(it.p.price)} × ${it.q}</div></div>
        <span class="lt">${money(it.p.price*it.q)}</span></div>`).join('');
    view(`<div class="cartpage">
      <div class="done-head">
        <div class="done-ico"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6"><path d="M5 12l4.5 4.5L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <h1>訂單成立，謝謝你！</h1>
        <p>訂單編號 <b>${o.no}</b>　·　這是教學示範，不會真的扣款或出貨。</p>
      </div>
      <div class="cart-layout">
        <div class="cart-items">${rows}</div>
        <div class="summary">
          <h3>付款明細</h3>
          <div class="row"><span>商品小計</span><span>${money(o.sub)}</span></div>
          <div class="row"><span>運費</span><span>${o.ship===0?'免運':money(o.ship)}</span></div>
          <div class="grand"><span>實付金額</span><b>${money(o.total)}</b></div>
          <button class="checkout" onclick="SHOPAPP.go('#/')">繼續購物</button>
        </div>
      </div></div>`); }

  // ---- 路由 ----
  function router(){
    const h=location.hash||'#/'; const m=h.match(/^#\/product\/(\d+)/); closeCart();
    if(h.startsWith('#/cart')) renderCartPage();
    else if(h.startsWith('#/done')) renderDone();
    else if(m) renderDetail(+m[1]);
    else renderHome();
    window.scrollTo(0,0);
  }
  function go(hash){ location.hash=hash; }
  function back(){ go('#/'); }
  function scrollShop(){ const t=$('#shopTop'); if(t) t.scrollIntoView({behavior:'smooth'}); }
  function setCat(k){ filter.cat=k; renderHome(); }
  function setSort(v){ filter.sort=v; renderHome(); }
  function reSearch(){ const h=location.hash||'#/'; if(!/^#\/?$/.test(h)) location.hash='#/'; else renderHome(); }
  function doSearch(v){ filter.q=v; reSearch(); }
  function clearFilter(){ filter={cat:'all',sort:'featured',q:''}; const si=$('#searchInput'); if(si) si.value=''; reSearch(); }
  function goCat(k){ filter.cat=k; filter.q=''; const si=$('#searchInput'); if(si) si.value=''; reSearch(); }

  let tT;
  function toast(msg,ok){ const t=$('#toast'); t.innerHTML=(ok?'<span class="ok">✓</span>':'')+esc(msg);
    t.classList.add('show'); clearTimeout(tT); tT=setTimeout(()=>t.classList.remove('show'),1900); }

  // ---- 啟動 ----
  function boot(){
    const need=['key','brandName','freeShip','shipFee','categories','products','art','theme'];
    const miss = !window.SHOP ? need : need.filter(k=>SHOP[k]==null);
    if(miss.length){ document.body.innerHTML='<pre style="padding:40px;font:16px/1.6 system-ui;color:#a9542f">SHOP 設定缺少必填欄位：'+miss.join('、')+'</pre>'; return; }
    const badCat=SHOP.products.filter(p=>!SHOP.categories.some(c=>c.key===p.cat));
    if(badCat.length) console.warn('[SHOP] 以下商品的 cat 不在 categories 內：', badCat.map(p=>p.name));
    document.title=SHOP.brandName+' · '+SHOP.brandTagline;
    const r=document.documentElement.style;
    Object.entries(SHOP.theme||{}).forEach(([k,v])=>r.setProperty('--'+k,v));

    document.body.insertAdjacentHTML('afterbegin',`
      <header><div class="bar">
        <div class="brand" onclick="SHOPAPP.go('#/')">
          ${SHOP.logo}
          <div><b>${esc(SHOP.brandName)}</b><span>${esc(SHOP.brandEn)}</span></div>
        </div>
        <div class="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
          <input id="searchInput" placeholder="搜尋商品…" oninput="SHOPAPP.search(this.value)">
        </div>
        <div class="nav-actions">
          <button class="icon-btn" data-tip="購物車" onclick="SHOPAPP.openCart()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.4 12.3a1 1 0 0 0 1 .8h9.4a1 1 0 0 0 1-.8L21 7H6"/></svg>
            <span class="badge hide" id="cartBadge">0</span>
          </button>
        </div>
      </div></header>
      <div class="crumb" id="crumb"></div>
      <main id="app"></main>
      <footer>${esc(SHOP.brandName)} · ${esc(SHOP.footer||'這是一個教學示範網站')}</footer>
      <div class="overlay" id="overlay" onclick="SHOPAPP.closeCart()"></div>
      <aside class="drawer" id="drawer">
        <div class="drawer-head"><h2>購物車</h2><button class="close" onclick="SHOPAPP.closeCart()">×</button></div>
        <div class="ship-bar" id="shipBar"></div>
        <div class="items" id="drawerItems"></div>
        <div class="foot">
          <div id="drawerSummary"></div>
          <button class="checkout" onclick="SHOPAPP.go('#/cart')">查看購物車並結帳</button>
        </div>
      </aside>
      <div class="toast" id="toast"></div>`);

    window.SHOPAPP={ go, back, add:addToCart, setQty, removeItem, openCart, closeCart,
      setCat, setSort, search:doSearch, clearFilter, goCat, scrollShop, dStep, buyNow, zoomMove, zoomOut, checkout };

    loadCart();
    window.addEventListener('hashchange', router);
    document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeCart(); });
    router(); updateCartUI();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
