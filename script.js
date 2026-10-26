import { db, firebaseConfigured } from "./firebase.js";
import { collection, getDocs, addDoc, serverTimestamp, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const WA_NUMBER = "94740491406";
const categories = [
  {name:"Semua Produk",emoji:"🛍️"},{name:"Mi Instan",emoji:"🍜"},{name:"Persambalan",emoji:"🌶️"},
  {name:"Jajanan",emoji:"🍘"},{name:"Snack",emoji:"🍟"},{name:"Minuman",emoji:"🥤"},{name:"Bumbu Dapur",emoji:"🧂"}
];
const demoProducts = [
  {id:"demo1",name:"Indomie Mi Goreng",category:"Mi Instan",price:3500,stock:30,emoji:"🍜",description:"Favorit sepanjang masa",badge:"Favorit"},
  {id:"demo2",name:"Sambal Bawang Pedas",category:"Persambalan",price:28000,stock:12,emoji:"🌶️",description:"Pedas gurih bikin nagih",badge:"Pedas"},
  {id:"demo3",name:"Chitato Rasa Sapi Panggang",category:"Snack",price:12500,stock:15,emoji:"🍟",description:"Camilan renyah",badge:"Populer"},
  {id:"demo4",name:"Nabati Wafer Cokelat",category:"Jajanan",price:2000,stock:50,emoji:"🍫",description:"Manis dan renyah",badge:""},
  {id:"demo5",name:"Mie Sedaap Soto",category:"Mi Instan",price:3500,stock:25,emoji:"🍜",description:"Kuah soto yang nikmat",badge:""},
  {id:"demo6",name:"Keripik Singkong Balado",category:"Jajanan",price:10000,stock:20,emoji:"🥔",description:"Gurih dengan sensasi pedas",badge:""},
  {id:"demo7",name:"Es Teh Botol",category:"Minuman",price:5000,stock:18,emoji:"🥤",description:"Segar diminum kapan saja",badge:""},
  {id:"demo8",name:"Bumbu Racik Serbaguna",category:"Bumbu Dapur",price:4000,stock:22,emoji:"🧂",description:"Praktis untuk masakan",badge:""}
];
let products = [...demoProducts], activeCategory = "Semua Produk", cart = [];
const $ = id => document.getElementById(id);
const rupiah = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n||0);
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
function safeText(value=""){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function loadProducts(){
  if(firebaseConfigured){try{const snap=await getDocs(query(collection(db,"products"),where("active","==",true)));if(!snap.empty)products=snap.docs.map(d=>({id:d.id,...d.data()}));}catch(e){console.warn("Firestore belum siap; memakai data demo.",e)}}
  renderCategories();renderFilters();renderProducts();
}
function renderCategories(){
  $("categories").innerHTML=categories.slice(1).map(c=>`<button class="category ${activeCategory===c.name?"active":""}" data-category="${safeText(c.name)}"><span class="emoji">${c.emoji}</span><b>${safeText(c.name)}</b><small>Lihat produk →</small></button>`).join("");
  $("categories").querySelectorAll("[data-category]").forEach(b=>b.onclick=()=>setCategory(b.dataset.category));
}
function renderFilters(){
  $("filters").innerHTML=categories.map(c=>`<button class="filter ${activeCategory===c.name?"active":""}" data-category="${safeText(c.name)}">${c.emoji} ${safeText(c.name)}</button>`).join("");
  $("filters").querySelectorAll("[data-category]").forEach(b=>b.onclick=()=>setCategory(b.dataset.category));
}
function setCategory(name){activeCategory=name;renderCategories();renderFilters();renderProducts();$("produk").scrollIntoView({behavior:"smooth",block:"start"})}
function renderProducts(){
  const term=$("search").value.trim().toLowerCase();
  const list=products.filter(p=>(activeCategory==="Semua Produk"||p.category===activeCategory)&&(`${p.name} ${p.category} ${p.description||""}`).toLowerCase().includes(term));
  $("product-grid").innerHTML=list.length?list.map(p=>`<article class="product-card"><div class="product-image">${p.imageUrl?`<img class="product-photo" src="${safeText(p.imageUrl)}" alt="${safeText(p.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">`:""}<span class="emoji" ${p.imageUrl?`style="display:none"`:""}>${safeText(p.emoji||"🍪")}</span>${p.badge?`<span class="badge">${safeText(p.badge)}</span>`:""}</div><div class="product-info"><span class="category-name">${safeText(p.category||"Lainnya")}</span><h3>${safeText(p.name)}</h3><p class="desc">${safeText(p.description||"Jajanan pilihan Shinchan Store")}</p><div class="product-bottom"><div><span class="price">${rupiah(p.price)}</span><span class="old-price">${Number(p.stock||0)>0?`Stok: ${Number(p.stock)}`:"Stok belum tersedia"}</span></div><button class="add-btn" data-add="${safeText(p.id)}" aria-label="Tambah ${safeText(p.name)}" ${Number(p.stock||0)<=0?"disabled":""}>+</button></div></div></article>`).join(""):`<div class="empty">Belum ada produk yang cocok. Coba kata pencarian lain ya! 😊</div>`;
  $("product-grid").querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>addToCart(b.dataset.add));
}
function addToCart(id){const p=products.find(x=>x.id===id);if(!p)return;const row=cart.find(x=>x.id===id);if(row)row.qty++;else cart.push({...p,qty:1});renderCart();toast(`${p.name} ditambahkan ke keranjang 🛒`)}
function renderCart(){
  $("cart-count").textContent=cart.reduce((s,x)=>s+x.qty,0);
  $("cart-items").innerHTML=cart.length?cart.map(p=>`<div class="cart-item"><div class="cart-emoji">${safeText(p.emoji||"🍪")}</div><div><h4>${safeText(p.name)}</h4><small>${rupiah(p.price)}</small><div class="qty"><button data-qty="${safeText(p.id)}" data-delta="-1">−</button><span>${p.qty}</span><button data-qty="${safeText(p.id)}" data-delta="1">+</button></div></div><button class="icon-btn" data-remove="${safeText(p.id)}" aria-label="Hapus item">×</button></div>`).join(""):`<div class="empty">Keranjangmu masih kosong 🍜<br>Yuk pilih jajanan favoritmu!</div>`;
  $("cart-total").textContent=rupiah(cart.reduce((s,p)=>s+p.price*p.qty,0));$("checkout-total").textContent=$("cart-total").textContent;
  $("cart-items").querySelectorAll("[data-qty]").forEach(b=>b.onclick=()=>{const p=cart.find(x=>x.id===b.dataset.qty);if(p){p.qty+=Number(b.dataset.delta);if(p.qty<=0)cart=cart.filter(x=>x.id!==p.id);renderCart()}});
  $("cart-items").querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{cart=cart.filter(x=>x.id!==b.dataset.remove);renderCart()});
}
function openDrawer(){ $("cart-drawer").classList.add("open");$("cart-drawer").setAttribute("aria-hidden","false") }
function closeDrawer(){ $("cart-drawer").classList.remove("open");$("cart-drawer").setAttribute("aria-hidden","true") }
function openCheckout(){if(!cart.length){toast("Keranjang masih kosong, boss 😄");return}closeDrawer();$("checkout-modal").classList.add("open");$("checkout-modal").setAttribute("aria-hidden","false")}
function closeCheckout(){$("checkout-modal").classList.remove("open");$("checkout-modal").setAttribute("aria-hidden","true")}
$("search").addEventListener("input",renderProducts);
$("cart-open").onclick=openDrawer;$("cart-close").onclick=closeDrawer;$("cart-drawer").onclick=e=>{if(e.target===$("cart-drawer"))closeDrawer()};
$("checkout-open").onclick=openCheckout;$("checkout-close").onclick=closeCheckout;$("checkout-modal").onclick=e=>{if(e.target===$("checkout-modal"))closeCheckout()};
$("checkout-form").addEventListener("submit",async e=>{
  e.preventDefault();if(!cart.length)return;
  const form=new FormData(e.currentTarget), orderItems=cart.map(p=>({productId:p.id,name:p.name,price:p.price,qty:p.qty}));
  const order={customerName:String(form.get("name")).trim(),phone:String(form.get("phone")).trim(),address:String(form.get("address")).trim(),payment:String(form.get("payment")),note:String(form.get("note")||"").trim(),items:orderItems,total:cart.reduce((s,p)=>s+p.price*p.qty,0),status:"Menunggu konfirmasi",createdAt:firebaseConfigured?serverTimestamp():new Date().toISOString()};
  let orderId="LOCAL-"+Date.now();
  if(firebaseConfigured){try{const doc=await addDoc(collection(db,"orders"),{...order,createdAt:serverTimestamp()});orderId=doc.id}catch(err){console.error(err);toast("Pesanan belum tersimpan. Firebase/Rules perlu diperiksa.");return}}
  const lines=orderItems.map(p=>`• ${p.name} x${p.qty} — ${rupiah(p.price*p.qty)}`).join("\n");
  const message=`Halo Shinchan Store! Saya mau pesan:\n\n${lines}\n\nTotal: ${rupiah(order.total)}\nNama: ${order.customerName}\nNo. WA: ${order.phone}\nAlamat: ${order.address}\nPembayaran: ${order.payment}\nCatatan: ${order.note||"-"}\nID pesanan: ${orderId}\n\nMohon konfirmasi pesanan saya ya.`;
  cart=[];renderCart();closeCheckout();e.currentTarget.reset();
  toast(firebaseConfigured?"Pesanan tersimpan! Membuka WhatsApp...":"Mode demo: pesanan belum tersimpan ke database. Membuka WhatsApp...");
  window.open(`https://wa.me/${94740491406}?text=${encodeURIComponent(message)}`,"_blank","noopener");
});
$("whatsapp-help").href=`https://wa.me/${94740491406}?text=${encodeURIComponent("Halo Shinchan Store, saya mau tanya produk.")}`;
$("year").textContent=new Date().getFullYear();renderCart();loadProducts();
