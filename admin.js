import { auth, db, firebaseConfigured } from "./firebase.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


/* =========================================================
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);

const currencyFormatter = new Intl.NumberFormat("en-LK", {
  maximumFractionDigits: 0
});

const rupiah = n =>
  `LKR ${currencyFormatter.format(Number(n) || 0)}`;

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));


function toast(message) {
  const element = $("toast");

  if (!element) return;

  element.textContent = message;
  element.classList.add("show");

  setTimeout(() => {
    element.classList.remove("show");
  }, 2600);
}


function demoNotice() {
  toast("Firebase belum dikonfigurasi. Lengkapi firebase.js.");
}


/* =========================================================
   STATE
========================================================= */

let products = [];
let orders = [];

let selectedImageFile = null;
let currentImageUrl = "";
let currentImagePath = "";

// Product catalog UI state
let productPage = 1;
const PRODUCT_PAGE_SIZE = 20;
let productSearch = "";
let productCategory = "Semua";


/* =========================================================
   IMAGE VALIDATION
========================================================= */

function validateImage(file) {
  if (!file) return false;

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
  ];

  if (!allowedTypes.includes(file.type)) {
    toast("Format foto harus JPG, PNG, WEBP, atau GIF.");
    return false;
  }

  /*
    Batas file asli tetap 2 MB.
    Setelah itu foto akan dikompres sebelum upload.
  */
  if (file.size > 2 * 1024 * 1024) {
    toast("Ukuran foto maksimal 2 MB.");
    return false;
  }

  return true;
}


/* =========================================================
   IMAGE PREVIEW
========================================================= */

function showImagePreview(url = "") {
  const preview = $("image-preview");
  const image = $("image-preview-img");

  if (!preview || !image) return;

  if (url) {
    image.src = url;
    preview.hidden = false;
  } else {
    image.removeAttribute("src");
    preview.hidden = true;
  }
}


function clearImageSelection() {
  selectedImageFile = null;

  const input = $("imageFile");

  if (input) {
    input.value = "";
  }
}


/* =========================================================
   FILE INPUT
========================================================= */

const imageFileInput = $("imageFile");

if (imageFileInput) {

  imageFileInput.addEventListener("change", event => {

    const file = event.target.files?.[0];

    if (!file) {
      clearImageSelection();
      return;
    }

    if (!validateImage(file)) {
      clearImageSelection();
      return;
    }

    selectedImageFile = file;

    const previewUrl = URL.createObjectURL(file);

    showImagePreview(previewUrl);
  });

}


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(auth, user => {

  if (user) {

    $("login-panel").hidden = true;
    $("dashboard").hidden = false;

    loadAll();

  } else {

    $("login-panel").hidden = false;
    $("dashboard").hidden = true;

  }

});


/* =========================================================
   LOGIN
========================================================= */

$("login-form").addEventListener("submit", async event => {

  event.preventDefault();

  if (!firebaseConfigured) {
    demoNotice();
    return;
  }

  const form = new FormData(event.currentTarget);

  const email =
    String(form.get("email") || "").trim();

  const password =
    String(form.get("password") || "");

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

  } catch (error) {

    console.error("LOGIN ERROR:", error);

    toast(
      "Login gagal. Periksa email, password, dan Firebase Authentication."
    );

  }

});


/* =========================================================
   LOGOUT
========================================================= */

$("logout").onclick = async () => {

  try {

    await signOut(auth);

  } catch (error) {

    console.error("LOGOUT ERROR:", error);

    toast("Gagal keluar dari dashboard.");

  }

};


/* =========================================================
   LOAD ALL
========================================================= */

async function loadAll() {

  await Promise.all([
    loadProducts(),
    loadOrders()
  ]);

}


/* =========================================================
   PRODUCTS
========================================================= */

async function loadProducts() {

  if (!firebaseConfigured) {

    $("admin-products").innerHTML =
      '<tr><td colspan="4">Konfigurasikan Firebase untuk mengelola produk.</td></tr>';

    return;
  }

  try {

    const snapshot = await getDocs(
      collection(db, "products")
    );

    products = snapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    }));

    populateProductCategories();
    renderProducts();

  } catch (error) {

    console.error("LOAD PRODUCTS ERROR:", error);

    toast(
      "Tidak dapat membaca produk. Periksa Firestore Rules."
    );

  }

}


/* =========================================================
   RENDER PRODUCTS
========================================================= */

function getFilteredProducts() {
  const search = productSearch.trim().toLowerCase();

  return products.filter(product => {
    const matchesCategory =
      productCategory === "Semua" ||
      String(product.category || "Lainnya") === productCategory;

    const haystack = [
      product.name,
      product.category,
      product.description,
      product.badge
    ].map(value => String(value || "").toLowerCase()).join(" ");

    return matchesCategory && (!search || haystack.includes(search));
  });
}

function stockMeta(stock) {
  const value = Number(stock) || 0;

  if (value <= 0) {
    return { className: "stock-zero", label: "Habis", dot: "🔴" };
  }

  if (value <= 5) {
    return { className: "stock-low", label: String(value), dot: "🟡" };
  }

  return { className: "stock-good", label: String(value), dot: "🟢" };
}

function renderProductPagination(total, totalPages) {
  const pagination = $("product-pagination");
  const range = $("product-range");

  if (!pagination || !range) return;

  if (!total) {
    range.textContent = "0 produk";
    pagination.innerHTML = "";
    return;
  }

  const start = (productPage - 1) * PRODUCT_PAGE_SIZE + 1;
  const end = Math.min(productPage * PRODUCT_PAGE_SIZE, total);

  range.textContent = `${start}–${end} dari ${total} produk`;

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  const buttons = [];

  buttons.push(`
    <button class="page-btn" type="button" data-page="${productPage - 1}"
      ${productPage === 1 ? "disabled" : ""} aria-label="Halaman sebelumnya">‹</button>
  `);

  const pages = new Set([1, totalPages]);

  for (let page = productPage - 2; page <= productPage + 2; page++) {
    if (page > 0 && page <= totalPages) pages.add(page);
  }

  const sortedPages = [...pages].sort((a, b) => a - b);
  let previous = 0;

  sortedPages.forEach(page => {
    if (previous && page - previous > 1) {
      buttons.push(`<span class="page-dots">…</span>`);
    }

    buttons.push(`
      <button class="page-btn ${page === productPage ? "active" : ""}"
        type="button" data-page="${page}">${page}</button>
    `);

    previous = page;
  });

  buttons.push(`
    <button class="page-btn" type="button" data-page="${productPage + 1}"
      ${productPage === totalPages ? "disabled" : ""} aria-label="Halaman berikutnya">›</button>
  `);

  pagination.innerHTML = buttons.join("");

  pagination.querySelectorAll("[data-page]").forEach(button => {
    button.onclick = () => {
      const nextPage = Number(button.dataset.page);
      if (!Number.isFinite(nextPage)) return;

      productPage = Math.min(Math.max(nextPage, 1), totalPages);
      renderProducts();
      $("product-table")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
  });
}


async function adjustProductStock(id, delta) {
  const product = products.find(item => item.id === id);
  if (!product) return;

  const currentStock = Math.max(0, Number(product.stock) || 0);
  const nextStock = Math.max(0, currentStock + Number(delta || 0));

  if (nextStock === currentStock) {
    toast(nextStock <= 0 ? "Stok sudah 0." : "Stok tidak berubah.");
    return;
  }

  const buttons = document.querySelectorAll(`[data-stock-plus="${CSS.escape(id)}"], [data-stock-minus="${CSS.escape(id)}"]`);
  buttons.forEach(button => { button.disabled = true; });

  try {
    await updateDoc(doc(db, "products", id), {
      stock: nextStock,
      updatedAt: serverTimestamp()
    });

    product.stock = nextStock;
    renderProducts();
    toast(`${product.name}: stok ${nextStock}`);
  } catch (error) {
    console.error("QUICK STOCK ERROR:", error);
    toast("Gagal mengubah stok. Periksa Firestore Rules.");
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

function openOrderDetail(id) {
  const order = orders.find(item => item.id === id);
  const modal = $("order-detail-modal");
  const content = $("order-detail-content");
  if (!order || !modal || !content) return;

  const items = Array.isArray(order.items) ? order.items : [];
  const status = order.status || "Menunggu konfirmasi";
  const phoneRaw = String(order.phone || "").replace(/[^0-9+]/g, "");
  let waPhone = phoneRaw.replace(/^00/, "");
  if (waPhone.startsWith("0")) waPhone = "94" + waPhone.slice(1);

  const waText = encodeURIComponent(
    `Halo ${order.customerName || "Kak"}, kami dari Shinchan Store terkait pesanan #${order.id.slice(0, 9)}.`
  );

  content.innerHTML = `
    <div class="order-detail-head">
      <div>
        <span class="eyebrow">DETAIL PESANAN</span>
        <h2>#${esc(order.id.slice(0, 9))}</h2>
      </div>
      <span class="status-pill status-${status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}">${esc(status)}</span>
    </div>

    <div class="order-customer-card">
      <div class="order-avatar">${esc((order.customerName || "?").trim().charAt(0).toUpperCase())}</div>
      <div>
        <strong>${esc(order.customerName || "Pelanggan")}</strong>
        <small>📱 ${esc(order.phone || "-")}</small>
        <small>📍 ${esc(order.address || "-")}</small>
      </div>
    </div>

    <div class="order-detail-section">
      <div class="detail-section-title">🛒 Item pesanan <span>${items.length} item</span></div>
      <div class="order-items-list">
        ${items.length ? items.map(item => `
          <div class="order-item-row">
            <div>
              <strong>${esc(item.name || "Produk")}</strong>
              <small>${Number(item.qty) || 1} × ${rupiah(item.price)}</small>
            </div>
            <strong>${rupiah((Number(item.price) || 0) * (Number(item.qty) || 1))}</strong>
          </div>
        `).join("") : `<div class="order-empty">Tidak ada detail item.</div>`}
      </div>
    </div>

    <div class="order-total-box">
      <span>Total pesanan</span>
      <strong>${rupiah(order.total)}</strong>
    </div>

    <div class="order-detail-grid">
      <div><small>Pembayaran</small><strong>💳 ${esc(order.payment || "-")}</strong></div>
      <div><small>Status</small><select id="detail-status-select" class="status-select">
        ${["Menunggu konfirmasi", "Diproses", "Dikirim", "Selesai", "Dibatalkan"].map(option =>
          `<option value="${esc(option)}" ${option === status ? "selected" : ""}>${esc(option)}</option>`
        ).join("")}
      </select></div>
    </div>

    <div class="order-note">
      <small>📝 Catatan</small>
      <p>${esc(order.note || "Tidak ada catatan.")}</p>
    </div>

    <div class="order-detail-actions">
      ${waPhone ? `<a class="button primary" href="https://wa.me/${encodeURIComponent(waPhone)}?text=${waText}" target="_blank" rel="noopener">💬 Chat WhatsApp</a>` : ""}
      <button class="button ghost" type="button" id="detail-close-bottom">Tutup</button>
    </div>
  `;

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  $("detail-status-select").onchange = event => {
    updateStatus(order.id, event.target.value, true);
  };
  $("detail-close-bottom").onclick = closeOrderDetail;
}

function closeOrderDetail() {
  const modal = $("order-detail-modal");
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function renderProducts() {
  const activeProducts = products.filter(product => product.active !== false);
  $("stat-products").textContent = activeProducts.length;

  const lowStockCount = activeProducts.filter(product => Number(product.stock) > 0 && Number(product.stock) <= 5).length;
  const soldOutCount = activeProducts.filter(product => Number(product.stock) <= 0).length;

  if ($("stat-low-stock")) {
    $("stat-low-stock").textContent = lowStockCount;
  }

  if ($("stat-sold-out")) {
    $("stat-sold-out").textContent = soldOutCount;
  }

  const filtered = getFilteredProducts();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCT_PAGE_SIZE));

  if (productPage > totalPages) productPage = totalPages;

  const start = (productPage - 1) * PRODUCT_PAGE_SIZE;
  const visible = filtered.slice(start, start + PRODUCT_PAGE_SIZE);
  const tbody = $("admin-products");

  tbody.innerHTML = visible.length
    ? visible.map(product => {
        const stock = Number(product.stock) || 0;
        const meta = stockMeta(stock);

        return `
          <tr>
            <td>
              <div class="product-table-name">
                <span class="product-table-emoji">${esc(product.emoji || "🍪")}</span>
                <div>
                  <strong>${esc(product.name)}</strong>
                  <small>${esc(product.category || "Lainnya")}</small>
                </div>
              </div>
            </td>

            <td><strong>${rupiah(product.price)}</strong></td>

            <td>
              <div class="stock-control">
                <button class="stock-step" type="button" data-stock-minus="${esc(product.id)}" aria-label="Kurangi stok">−</button>
                <span class="stock-badge ${meta.className}">${meta.dot} ${meta.label}</span>
                <button class="stock-step" type="button" data-stock-plus="${esc(product.id)}" aria-label="Tambah stok">+</button>
              </div>
            </td>

            <td class="actions-cell">
              <button class="table-action edit" data-edit="${esc(product.id)}">Edit</button>
              <button class="table-action delete" data-delete="${esc(product.id)}">Hapus</button>
            </td>
          </tr>
        `;
      }).join("")
    : `
      <tr>
        <td colspan="4" class="empty-products">
          <div>🍜</div>
          <strong>${products.length ? "Produk tidak ditemukan." : "Belum ada produk."}</strong>
          <small>${products.length ? "Coba kata kunci atau kategori lain." : "Tambahkan produk lewat formulir."}</small>
        </td>
      </tr>
    `;

  tbody.querySelectorAll("[data-edit]").forEach(button => {
    button.onclick = () => editProduct(button.dataset.edit);
  });

  tbody.querySelectorAll("[data-delete]").forEach(button => {
    button.onclick = () => removeProduct(button.dataset.delete);
  });

  tbody.querySelectorAll("[data-stock-plus]").forEach(button => {
    button.onclick = () => adjustProductStock(button.dataset.stockPlus, 1);
  });

  tbody.querySelectorAll("[data-stock-minus]").forEach(button => {
    button.onclick = () => adjustProductStock(button.dataset.stockMinus, -1);
  });

  renderProductPagination(filtered.length, totalPages);

  const count = $("catalog-count");
  if (count) count.textContent = `${filtered.length} produk`;
}


/* =========================================================
   PRODUCT SEARCH / FILTER
========================================================= */

function setupProductFilters() {
  const search = $("product-search");
  const category = $("product-category-filter");

  if (search && !search.dataset.bound) {
    search.dataset.bound = "true";

    let timer;

    search.addEventListener("input", event => {
      clearTimeout(timer);

      timer = setTimeout(() => {
        productSearch = String(event.target.value || "");
        productPage = 1;
        renderProducts();
      }, 120);
    });
  }

  if (category && !category.dataset.bound) {
    category.dataset.bound = "true";

    category.addEventListener("change", event => {
      productCategory = event.target.value;
      productPage = 1;
      renderProducts();
    });
  }
}

function populateProductCategories() {
  const select = $("product-category-filter");
  if (!select) return;

  const categories = [...new Set(
    products
      .map(product => String(product.category || "Lainnya").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const current = productCategory;

  select.innerHTML = `
    <option value="Semua">Semua kategori</option>
    ${categories.map(category => `
      <option value="${esc(category)}">${esc(category)}</option>
    `).join("")}
  `;

  select.value = categories.includes(current) ? current : "Semua";
  productCategory = select.value;
}


/* =========================================================
   ORDERS
========================================================= */

async function loadOrders() {

  if (!firebaseConfigured) {

    $("admin-orders").innerHTML =
      '<tr><td colspan="6">Konfigurasikan Firebase untuk melihat pesanan.</td></tr>';

    return;
  }

  try {

    const snapshot = await getDocs(
      query(
        collection(db, "orders"),
        orderBy("createdAt", "desc")
      )
    );

    orders = snapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    }));

    renderOrders();

  } catch (error) {

    console.error("LOAD ORDERS ERROR:", error);

    $("admin-orders").innerHTML =
      '<tr><td colspan="6">Gagal memuat pesanan. Periksa Firestore Rules.</td></tr>';

  }

}


/* =========================================================
   RENDER ORDERS
========================================================= */

function renderOrders() {

  $("stat-orders").textContent = orders.length;

  $("stat-sales").textContent = rupiah(
    orders
      .filter(order => order.status === "Selesai")
      .reduce((total, order) => total + (Number(order.total) || 0), 0)
  );

  $("admin-orders").innerHTML = orders.length
    ? orders.map(order => {
        const items = Array.isArray(order.items) ? order.items : [];
        const itemCount = items.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
        const status = order.status || "Menunggu konfirmasi";

        return `
          <tr>
            <td>
              <strong>${esc(order.id.slice(0, 9))}</strong>
              <small>${esc(order.customerName || "Pelanggan")} · ${esc(order.phone || "-")}</small>
              <small>${esc(order.address || "-")}</small>
            </td>

            <td>
              <strong>${itemCount} item</strong>
              <small>${items.slice(0, 2).map(item => `${esc(item.name)} ×${Number(item.qty) || 1}`).join(" · ")}${items.length > 2 ? " · ..." : ""}</small>
            </td>

            <td><strong>${rupiah(order.total)}</strong></td>
            <td>${esc(order.payment || "-")}</td>
            <td><span class="status-pill">${esc(status)}</span></td>
            <td>
              <div class="order-actions">
                <button class="table-action detail" data-order-detail="${esc(order.id)}">Detail</button>
                <select class="status-select" data-status="${esc(order.id)}">
                  ${["Menunggu konfirmasi", "Diproses", "Dikirim", "Selesai", "Dibatalkan"].map(option => `
                    <option ${status === option ? "selected" : ""}>${option}</option>
                  `).join("")}
                </select>
              </div>
            </td>
          </tr>
        `;
      }).join("")
    : `
      <tr>
        <td colspan="6">
          <div class="empty-orders">📦<strong>Belum ada pesanan.</strong><small>Pesanan baru akan muncul di sini.</small></div>
        </td>
      </tr>
    `;

  $("admin-orders").querySelectorAll("[data-status]").forEach(select => {
    select.onchange = () => updateStatus(select.dataset.status, select.value);
  });

  $("admin-orders").querySelectorAll("[data-order-detail]").forEach(button => {
    button.onclick = () => openOrderDetail(button.dataset.orderDetail);
  });
}


/* =========================================================
   EDIT PRODUCT
========================================================= */

function editProduct(id) {

  const product =
    products.find(item => item.id === id);

  if (!product) return;

  const form = $("product-form");


  for (const key of [
    "id",
    "name",
    "category",
    "price",
    "stock",
    "emoji",
    "description",
    "badge"
  ]) {

    if (form.elements[key]) {

      form.elements[key].value =
        product[key] ?? "";

    }

  }


  currentImageUrl =
    product.imageUrl || "";

  currentImagePath =
    product.imagePath || "";


  clearImageSelection();


  if (currentImageUrl) {
    showImagePreview(currentImageUrl);
  } else {
    showImagePreview("");
  }


  $("product-form-title").textContent =
    "Edit produk";


  form.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

}


/* =========================================================
   RESET FORM
========================================================= */

function resetForm() {

  $("product-form").reset();

  $("product-form").elements.id.value = "";

  $("product-form").elements.emoji.value =
    "🍜";

  currentImageUrl = "";
  currentImagePath = "";

  clearImageSelection();

  showImagePreview("");

  $("product-form-title").textContent =
    "Tambah produk";

}


$("cancel-edit").onclick =
  resetForm;


/* =========================================================
   IMAGE COMPRESSION
========================================================= */

/*
  Foto akan diproses di browser sebelum dikirim
  ke server.

  Maksimal:
  - lebar/tinggi: 1200px
  - format output: WebP
  - quality: 78%

  GIF tidak dikompres supaya animasinya tetap aman.
*/

async function compressImage(file) {

  if (!file) {
    throw new Error("File foto tidak ditemukan.");
  }


  /*
    GIF jangan diubah menjadi WebP karena
    animasinya bisa hilang.
  */
  if (file.type === "image/gif") {
    return file;
  }


  toast("Mengoptimalkan foto...");


  const bitmap =
    await createImageBitmap(file);


  const MAX_SIZE = 1200;

  const scale =
    Math.min(
      1,
      MAX_SIZE / Math.max(
        bitmap.width,
        bitmap.height
      )
    );


  const width =
    Math.max(
      1,
      Math.round(bitmap.width * scale)
    );


  const height =
    Math.max(
      1,
      Math.round(bitmap.height * scale)
    );


  const canvas =
    document.createElement("canvas");


  canvas.width = width;
  canvas.height = height;


  const context =
    canvas.getContext("2d", {
      alpha: true
    });


  if (!context) {
    bitmap.close();
    throw new Error(
      "Browser tidak mendukung pemrosesan gambar."
    );
  }


  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";


  context.drawImage(
    bitmap,
    0,
    0,
    width,
    height
  );


  bitmap.close();


  const blob =
    await new Promise(resolve => {

      canvas.toBlob(
        resolve,
        "image/webp",
        0.78
      );

    });


  if (!blob) {
    throw new Error(
      "Gagal mengompres foto."
    );
  }


  /*
    Kalau hasil WebP ternyata lebih besar
    daripada file asli, gunakan file asli.
  */
  if (blob.size >= file.size) {
    return file;
  }


  const safeName =
    file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "-");


  return new File(
    [blob],
    `${safeName}.webp`,
    {
      type: "image/webp",
      lastModified: Date.now()
    }
  );
}


/* =========================================================
   FILE → BASE64
========================================================= */

function fileToBase64(file) {

  return new Promise((resolve, reject) => {

    const reader =
      new FileReader();


    reader.onload = () => {

      const result =
        String(reader.result || "");


      const parts =
        result.split(",");


      if (parts.length < 2) {

        reject(
          new Error(
            "Gagal membaca data foto."
          )
        );

        return;
      }


      const base64 =
        parts[1];


      if (!base64) {

        reject(
          new Error(
            "Data foto kosong."
          )
        );

        return;
      }


      resolve(base64);

    };


    reader.onerror = () => {

      reject(
        new Error(
          "Gagal membaca file foto."
        )
      );

    };


    reader.readAsDataURL(file);

  });

}


/* =========================================================
   UPLOAD IMAGE
========================================================= */

async function uploadImage(file, productName) {

  if (!file) {
    return null;
  }


  const user =
    auth.currentUser;


  if (!user) {

    throw new Error(
      "Sesi admin sudah habis. Silakan login lagi."
    );

  }


  if (!validateImage(file)) {

    throw new Error(
      "Foto tidak valid atau ukurannya terlalu besar."
    );

  }


  /*
    Kompres terlebih dahulu.
  */
  const optimizedFile =
    await compressImage(file);


  const originalKB =
    Math.round(file.size / 1024);

  const optimizedKB =
    Math.round(optimizedFile.size / 1024);


  console.log(
    `IMAGE OPTIMIZED: ${originalKB} KB → ${optimizedKB} KB`
  );


  toast(
    optimizedFile !== file
      ? `Foto dioptimalkan: ${originalKB} KB → ${optimizedKB} KB`
      : "Foto siap diupload..."
  );


  const idToken =
    await user.getIdToken();


  const content =
    await fileToBase64(optimizedFile);


  const payload = {

    fileName:
      optimizedFile.name,

    content,

    contentType:
      optimizedFile.type,

    productName

  };


  const response =
    await fetch(
      "/api/upload-image",
      {

        method: "POST",

        headers: {

          "Authorization":
            `Bearer ${idToken}`,

          "Content-Type":
            "application/json",

          "Accept":
            "application/json"

        },

        body:
          JSON.stringify(payload)

      }
    );


  const responseText =
    await response.text();


  let data = {};


  if (responseText) {

    try {

      data =
        JSON.parse(responseText);

    } catch (error) {

      console.error(
        "SERVER RESPONSE BUKAN JSON:",
        responseText
      );

      throw new Error(
        `Server upload error (${response.status}).`
      );

    }

  }


  if (!response.ok) {

    console.error(
      "UPLOAD API ERROR:",
      data
    );

    throw new Error(
      data.error ||
      `Upload foto gagal (${response.status}).`
    );

  }


  if (!data.imageUrl) {

    throw new Error(
      "Upload berhasil tetapi URL foto tidak diterima server."
    );

  }


  return data;

}


/* =========================================================
   SAVE PRODUCT
========================================================= */

$("product-form")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      if (!firebaseConfigured) {

        demoNotice();

        return;

      }


      const form =
        new FormData(
          event.currentTarget
        );


      const id =
        String(
          form.get("id") || ""
        );


      const productName =
        String(
          form.get("name") || ""
        ).trim();


      const submitButton =
        event.currentTarget.querySelector(
          'button[type="submit"]'
        );


      const originalText =
        submitButton
          ? submitButton.textContent
          : "Simpan produk";


      try {

        if (submitButton) {

          submitButton.disabled = true;

          submitButton.textContent =
            "Menyimpan...";

        }


        if (!productName) {

          throw new Error(
            "Nama produk wajib diisi."
          );

        }


        const price =
          Number(form.get("price"));


        const stock =
          Number(form.get("stock"));


        if (
          !Number.isFinite(price) ||
          price < 0
        ) {

          throw new Error(
            "Harga produk tidak valid."
          );

        }


        if (
          !Number.isFinite(stock) ||
          stock < 0
        ) {

          throw new Error(
            "Stok produk tidak valid."
          );

        }


        let imageUrl =
          currentImageUrl;


        let imagePath =
          currentImagePath;


        /* -----------------------------------------
           UPLOAD FOTO BARU
        ----------------------------------------- */

        if (selectedImageFile) {

          toast(
            "Mengupload foto yang sudah dioptimalkan..."
          );


          const uploaded =
            await uploadImage(
              selectedImageFile,
              productName
            );


          imageUrl =
            uploaded.imageUrl || "";


          imagePath =
            uploaded.path ||
            uploaded.imagePath ||
            "";

        }


        /* -----------------------------------------
           PRODUCT DATA
        ----------------------------------------- */

        const payload = {

          name:
            productName,

          category:
            String(
              form.get("category") || ""
            ),

          price,

          stock,

          emoji:
            String(
              form.get("emoji") ||
              "🍪"
            ),

          imageUrl,

          imagePath,

          description:
            String(
              form.get("description") ||
              ""
            ),

          badge:
            String(
              form.get("badge") ||
              ""
            ),

          active: true,

          updatedAt:
            serverTimestamp()

        };


        /* -----------------------------------------
           EDIT
        ----------------------------------------- */

        if (id) {

          await updateDoc(
            doc(
              db,
              "products",
              id
            ),
            payload
          );


          toast(
            "Produk berhasil diperbarui! 🎉"
          );

        }


        /* -----------------------------------------
           TAMBAH
        ----------------------------------------- */

        else {

          await addDoc(
            collection(
              db,
              "products"
            ),
            {
              ...payload,

              createdAt:
                serverTimestamp()
            }
          );


          toast(
            "Produk berhasil ditambahkan! 🎉"
          );

        }


        resetForm();

        await loadProducts();


      } catch (error) {

        console.error(
          "PRODUCT SAVE ERROR:",
          error
        );


        toast(
          error.message ||
          "Gagal menyimpan produk."
        );


      } finally {

        if (submitButton) {

          submitButton.disabled =
            false;

          submitButton.textContent =
            originalText;

        }

      }

    }
  );


/* =========================================================
   DELETE PRODUCT
========================================================= */

async function removeProduct(id) {

  const product =
    products.find(
      item => item.id === id
    );


  if (
    !product ||
    !confirm(
      `Hapus produk "${product.name}"?`
    )
  ) {

    return;

  }


  try {

    await deleteDoc(
      doc(
        db,
        "products",
        id
      )
    );


    toast(
      "Produk dihapus."
    );


    await loadProducts();


  } catch (error) {

    console.error(
      "DELETE PRODUCT ERROR:",
      error
    );


    toast(
      "Gagal menghapus produk. Periksa Firestore Rules."
    );

  }

}


/* =========================================================
   UPDATE ORDER STATUS
========================================================= */

async function updateStatus(
  id,
  status,
  fromDetail = false
) {

  try {

    await updateDoc(
      doc(
        db,
        "orders",
        id
      ),
      {
        status,

        updatedAt:
          serverTimestamp()
      }
    );


    toast(
      "Status pesanan diperbarui."
    );


    await loadOrders();

    if (fromDetail) {
      openOrderDetail(id);
    }


  } catch (error) {

    console.error(
      "UPDATE STATUS ERROR:",
      error
    );


    toast(
      "Gagal memperbarui status. Periksa Firestore Rules."
    );

  }

}


/* =========================================================
   PRODUCT UI INIT
========================================================= */

setupProductFilters();

/* =========================================================
   REFRESH
========================================================= */

$("refresh").onclick =
  loadProducts;

$("refresh-orders").onclick =
  loadOrders;

console.log("Shinchan Admin JS loaded successfully.");

/* =========================================================
   ORDER DETAIL MODAL / TOP LOGOUT
========================================================= */

$("order-detail-close")?.addEventListener("click", closeOrderDetail);
$("order-detail-modal")?.addEventListener("click", event => {
  if (event.target.id === "order-detail-modal") closeOrderDetail();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeOrderDetail();
});

$("logout-top")?.addEventListener("click", () => $("logout")?.click());
