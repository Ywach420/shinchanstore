import {
  db,
  firebaseConfigured
} from "./firebase.js";

import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


/* =========================
   CONFIG
========================= */

const WA_NUMBER = "94740491406";

const categories = [
  {
    name: "Semua Produk",
    emoji: "🛍️"
  },
  {
    name: "Mi Instan",
    emoji: "🍜",
    image: "./assets/categories/mi-instan.png"
  },
  {
    name: "Persambalan",
    emoji: "🌶️",
    image: "./assets/categories/persambalan.png"
  },
  {
    name: "Jajanan",
    emoji: "🍘",
    image: "./assets/categories/jajanan.png"
  },
  {
    name: "Snack",
    emoji: "🍟",
    image: "./assets/categories/snack.png"
  },
  {
    name: "Minuman",
    emoji: "🥤",
    image: "./assets/categories/minuman.png"
  },
  {
    name: "Bumbu Dapur",
    emoji: "🧂",
    image: "./assets/categories/bumbu-dapur.png"
  }
];


/* =========================
   DEMO PRODUCTS
========================= */

const demoProducts = [
  {
    id: "demo1",
    name: "Indomie Mi Goreng",
    category: "Mi Instan",
    price: 3500,
    stock: 30,
    emoji: "🍜",
    description: "Favorit sepanjang masa",
    badge: "Favorit"
  },
  {
    id: "demo2",
    name: "Sambal Bawang Pedas",
    category: "Persambalan",
    price: 28000,
    stock: 12,
    emoji: "🌶️",
    description: "Pedas gurih bikin nagih",
    badge: "Pedas"
  },
  {
    id: "demo3",
    name: "Chitato Rasa Sapi Panggang",
    category: "Snack",
    price: 12500,
    stock: 15,
    emoji: "🍟",
    description: "Camilan renyah",
    badge: "Populer"
  },
  {
    id: "demo4",
    name: "Nabati Wafer Cokelat",
    category: "Jajanan",
    price: 2000,
    stock: 50,
    emoji: "🍫",
    description: "Manis dan renyah",
    badge: ""
  },
  {
    id: "demo5",
    name: "Mie Sedaap Soto",
    category: "Mi Instan",
    price: 3500,
    stock: 25,
    emoji: "🍜",
    description: "Kuah soto yang nikmat",
    badge: ""
  },
  {
    id: "demo6",
    name: "Keripik Singkong Balado",
    category: "Jajanan",
    price: 10000,
    stock: 20,
    emoji: "🥔",
    description: "Gurih dengan sensasi pedas",
    badge: ""
  },
  {
    id: "demo7",
    name: "Es Teh Botol",
    category: "Minuman",
    price: 5000,
    stock: 18,
    emoji: "🥤",
    description: "Segar diminum kapan saja",
    badge: ""
  },
  {
    id: "demo8",
    name: "Bumbu Racik Serbaguna",
    category: "Bumbu Dapur",
    price: 4000,
    stock: 22,
    emoji: "🧂",
    description: "Praktis untuk masakan",
    badge: ""
  }
];


/* =========================
   STATE
========================= */

let products = [...demoProducts];
let activeCategory = "Semua Produk";
let cart = [];


/* =========================
   HELPERS
========================= */

const $ = id => document.getElementById(id);

const currencyFormatter = new Intl.NumberFormat("en-LK", {
  maximumFractionDigits: 0
});

const rupiah = value =>
  `LKR ${currencyFormatter.format(Number(value) || 0)}`;


function safeText(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char])
  );
}


/* =========================
   IMAGE OPTIMIZATION
========================= */

function optimizeImageUrl(url) {
  if (!url) return "";

  const githubPrefix =
    "https://raw.githubusercontent.com/Ywach420/shinchanstore/main/";

  if (url.startsWith(githubPrefix)) {
    return url.replace(
      githubPrefix,
      "https://cdn.jsdelivr.net/gh/Ywach420/shinchanstore@main/"
    );
  }

  return url;
}


/* =========================
   TOAST
========================= */

let toastTimer;

function toast(message) {
  const el = $("toast");

  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 2600);
}


/* =========================
   LOAD PRODUCTS
========================= */

async function loadProducts() {
  if (firebaseConfigured) {
    try {
      const productsQuery = query(
        collection(db, "products"),
        where("active", "==", true)
      );

      const snap = await getDocs(productsQuery);

      if (!snap.empty) {
        products = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }

    } catch (error) {
      console.warn(
        "Firestore belum siap; memakai data demo.",
        error
      );
    }
  }

  renderCategories();
  renderFilters();
  renderProducts();
}


/* =========================
   CATEGORIES
========================= */

function renderCategories() {
  const container = $("categories");

  if (!container) return;

  container.innerHTML = categories
    .slice(1)
    .map(category => `
      <button
        class="category ${activeCategory === category.name ? "active" : ""}"
        data-category="${safeText(category.name)}"
      >

        <span class="category-visual">

          ${
            category.image
              ? `
                <img
                  src="${safeText(category.image)}"
                  alt="${safeText(category.name)}"
                  loading="lazy"
                  decoding="async"
                  onerror="
                    this.style.display='none';
                    this.nextElementSibling.style.display='block'
                  "
                >
              `
              : ""
          }

          <span
            class="category-fallback"
            ${category.image ? 'style="display:none"' : ""}
          >
            ${category.emoji}
          </span>

        </span>

        <b>${safeText(category.name)}</b>

        <small>Lihat produk →</small>

      </button>
    `)
    .join("");

  container
    .querySelectorAll("[data-category]")
    .forEach(button => {
      button.onclick = () =>
        setCategory(button.dataset.category);
    });
}


/* =========================
   FILTERS
========================= */

function renderFilters() {
  const container = $("filters");

  if (!container) return;

  container.innerHTML = categories
    .map(category => `
      <button
        class="filter ${activeCategory === category.name ? "active" : ""}"
        data-category="${safeText(category.name)}"
      >
        ${category.emoji}
        ${safeText(category.name)}
      </button>
    `)
    .join("");

  container
    .querySelectorAll("[data-category]")
    .forEach(button => {
      button.onclick = () =>
        setCategory(button.dataset.category);
    });
}


/* =========================
   CATEGORY CHANGE
========================= */

function setCategory(name) {
  activeCategory = name;

  renderCategories();
  renderFilters();
  renderProducts();

  const section = $("produk");

  if (section) {
    section.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}


/* =========================
   PRODUCTS
========================= */

function renderProducts() {
  const search = $("search");

  const term = search
    ? search.value.trim().toLowerCase()
    : "";

  const list = products.filter(product => {

    const matchesCategory =
      activeCategory === "Semua Produk" ||
      product.category === activeCategory;

    const searchableText =
      `${product.name} ${product.category} ${product.description || ""}`
        .toLowerCase();

    return matchesCategory &&
      searchableText.includes(term);
  });


  $("product-grid").innerHTML = list.length
    ? list.map(product => {

        const stock = Number(product.stock || 0);
        const soldOut = stock <= 0;

        const imageUrl =
          optimizeImageUrl(product.imageUrl);

        return `
          <article
            class="product-card ${soldOut ? "sold-out" : ""}"
          >

            <div class="product-image">

              ${
                imageUrl
                  ? `
                    <img
                      class="product-photo"
                      src="${safeText(imageUrl)}"
                      alt="${safeText(product.name)}"
                      loading="lazy"
                      decoding="async"
                      onerror="
                        this.style.display='none';
                        this.nextElementSibling.style.display='grid'
                      "
                    >
                  `
                  : ""
              }

              <span
                class="emoji"
                ${imageUrl ? `style="display:none"` : ""}
              >
                ${safeText(product.emoji || "🍪")}
              </span>


              ${
                soldOut
                  ? `
                    <span class="sold-out-badge">
                      SOLD OUT
                    </span>
                  `
                  : product.badge
                    ? `
                      <span class="badge">
                        ${safeText(product.badge)}
                      </span>
                    `
                    : ""
              }

            </div>


            <div class="product-info">

              <span class="category-name">
                ${safeText(product.category || "Lainnya")}
              </span>

              <h3>
                ${safeText(product.name)}
              </h3>

              <p class="desc">
                ${safeText(
                  product.description ||
                  "Jajanan pilihan Shinchan Store"
                )}
              </p>


              <div class="product-bottom">

                <div>

                  <span class="price">
                    ${rupiah(product.price)}
                  </span>

                  <span
                    class="old-price ${soldOut ? "stock-empty" : ""}"
                  >
                    ${
                      soldOut
                        ? "Stok habis"
                        : `Stok: ${stock}`
                    }
                  </span>

                </div>


                <button
                  class="add-btn"
                  data-add="${safeText(product.id)}"
                  aria-label="Tambah ${safeText(product.name)}"
                  ${soldOut ? "disabled" : ""}
                >
                  ${soldOut ? "×" : "+"}
                </button>

              </div>

            </div>

          </article>
        `;

      }).join("")

    : `
      <div class="empty">
        Belum ada produk yang cocok.
        Coba kata pencarian lain ya! 😊
      </div>
    `;


  $("product-grid")
    .querySelectorAll("[data-add]:not([disabled])")
    .forEach(button => {
      button.onclick = () =>
        addToCart(button.dataset.add);
    });
}


/* =========================
   CART
========================= */

function addToCart(id) {
  const product = products.find(
    item => item.id === id
  );

  if (!product) return;

  const existing = cart.find(
    item => item.id === id
  );

  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      ...product,
      qty: 1
    });
  }

  renderCart();

  toast(
    `${product.name} ditambahkan ke keranjang 🛒`
  );
}


function renderCart() {
  const count = cart.reduce(
    (total, item) => total + item.qty,
    0
  );

  $("cart-count").textContent = count;


  $("cart-items").innerHTML = cart.length

    ? cart.map(product => `
        <div class="cart-item">

          <div class="cart-emoji">
            ${safeText(product.emoji || "🍪")}
          </div>

          <div>

            <h4>
              ${safeText(product.name)}
            </h4>

            <small>
              ${rupiah(product.price)}
            </small>

            <div class="qty">

              <button
                data-qty="${safeText(product.id)}"
                data-delta="-1"
              >
                −
              </button>

              <span>
                ${product.qty}
              </span>

              <button
                data-qty="${safeText(product.id)}"
                data-delta="1"
              >
                +
              </button>

            </div>

          </div>

          <button
            class="icon-btn"
            data-remove="${safeText(product.id)}"
            aria-label="Hapus item"
          >
            ×
          </button>

        </div>
      `).join("")

    : `
      <div class="empty">
        Keranjangmu masih kosong 🍜
        <br>
        Yuk pilih jajanan favoritmu!
      </div>
    `;


  const total = cart.reduce(
    (sum, product) =>
      sum + product.price * product.qty,
    0
  );

  const formattedTotal = rupiah(total);

  $("cart-total").textContent = formattedTotal;
  $("checkout-total").textContent = formattedTotal;


  $("cart-items")
    .querySelectorAll("[data-qty]")
    .forEach(button => {

      button.onclick = () => {

        const product = cart.find(
          item => item.id === button.dataset.qty
        );

        if (!product) return;

        product.qty += Number(
          button.dataset.delta
        );

        if (product.qty <= 0) {
          cart = cart.filter(
            item => item.id !== product.id
          );
        }

        renderCart();
      };
    });


  $("cart-items")
    .querySelectorAll("[data-remove]")
    .forEach(button => {

      button.onclick = () => {

        cart = cart.filter(
          item => item.id !== button.dataset.remove
        );

        renderCart();
      };
    });
}


/* =========================
   DRAWER / CHECKOUT
========================= */

function openDrawer() {
  $("cart-drawer").classList.add("open");
  $("cart-drawer").setAttribute(
    "aria-hidden",
    "false"
  );
}


function closeDrawer() {
  $("cart-drawer").classList.remove("open");
  $("cart-drawer").setAttribute(
    "aria-hidden",
    "true"
  );
}


function openCheckout() {

  if (!cart.length) {
    toast("Keranjang masih kosong, boss 😄");
    return;
  }

  closeDrawer();

  $("checkout-modal").classList.add("open");

  $("checkout-modal").setAttribute(
    "aria-hidden",
    "false"
  );
}


function closeCheckout() {
  $("checkout-modal").classList.remove("open");

  $("checkout-modal").setAttribute(
    "aria-hidden",
    "true"
  );
}


/* =========================
   SEARCH
========================= */

let searchTimer;

$("search").addEventListener("input", () => {

  clearTimeout(searchTimer);

  searchTimer = setTimeout(() => {
    renderProducts();
  }, 120);

});


/* =========================
   BUTTON EVENTS
========================= */

$("cart-open").onclick = openDrawer;
$("cart-close").onclick = closeDrawer;

$("cart-drawer").onclick = event => {

  if (event.target === $("cart-drawer")) {
    closeDrawer();
  }

};


$("checkout-open").onclick = openCheckout;
$("checkout-close").onclick = closeCheckout;

$("checkout-modal").onclick = event => {

  if (event.target === $("checkout-modal")) {
    closeCheckout();
  }

};


/* =========================
   CHECKOUT
========================= */

$("checkout-form").addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!cart.length) return;


    const form = new FormData(
      event.currentTarget
    );


    const orderItems = cart.map(product => ({
      productId: product.id,
      name: product.name,
      price: product.price,
      qty: product.qty
    }));


    const total = cart.reduce(
      (sum, product) =>
        sum + product.price * product.qty,
      0
    );


    const order = {

      customerName:
        String(form.get("name")).trim(),

      phone:
        String(form.get("phone")).trim(),

      address:
        String(form.get("address")).trim(),

      payment:
        String(form.get("payment")),

      note:
        String(form.get("note") || "").trim(),

      items: orderItems,

      total,

      status:
        "Menunggu konfirmasi",

      createdAt:
        serverTimestamp()
    };


    let orderId =
      `LOCAL-${Date.now()}`;


    if (firebaseConfigured) {

      try {

        const doc = await addDoc(
          collection(db, "orders"),
          order
        );

        orderId = doc.id;

      } catch (error) {

        console.error(error);

        toast(
          "Pesanan belum tersimpan. Firebase/Rules perlu diperiksa."
        );

        return;
      }
    }


    const lines = orderItems
      .map(product =>
        `• ${product.name} x${product.qty} — ${rupiah(product.price * product.qty)}`
      )
      .join("\n");


    const message =
      `Halo Shinchan Store! Saya mau pesan:\n\n` +
      `${lines}\n\n` +
      `Total: ${rupiah(total)}\n` +
      `Nama: ${order.customerName}\n` +
      `No. WA: ${order.phone}\n` +
      `Alamat: ${order.address}\n` +
      `Pembayaran: ${order.payment}\n` +
      `Catatan: ${order.note || "-"}\n` +
      `ID pesanan: ${orderId}\n\n` +
      `Mohon konfirmasi pesanan saya ya.`;


    cart = [];

    renderCart();
    closeCheckout();

    event.currentTarget.reset();


    toast(
      firebaseConfigured
        ? "Pesanan tersimpan! Membuka WhatsApp..."
        : "Mode demo: pesanan belum tersimpan ke database. Membuka WhatsApp..."
    );


    window.open(
      `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener"
    );

  }
);


/* =========================
   WHATSAPP HELP
========================= */

$("whatsapp-help").href =
  `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    "Halo Shinchan Store, saya mau tanya produk."
  )}`;


/* =========================
   INITIALIZE
========================= */

$("year").textContent =
  new Date().getFullYear();

renderCart();

loadProducts();
