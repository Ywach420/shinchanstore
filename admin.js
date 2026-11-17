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


/* =========================
   BASIC HELPERS
========================= */

const $ = id => document.getElementById(id);

const rupiah = n =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(n || 0);

const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

function toast(message) {
  const t = $("toast");

  if (!t) return;

  t.textContent = message;
  t.classList.add("show");

  setTimeout(() => {
    t.classList.remove("show");
  }, 2600);
}


/* =========================
   STATE
========================= */

let products = [];
let orders = [];

let selectedImageFile = null;
let currentImageUrl = "";
let currentImagePath = "";


/* =========================
   IMAGE PREVIEW
========================= */

function validateImage(file) {
  if (!file) return false;

  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
  ];

  if (!allowed.includes(file.type)) {
    toast("Format foto harus JPG, PNG, WEBP, atau GIF.");
    return false;
  }

  if (file.size > 2 * 1024 * 1024) {
    toast("Ukuran foto maksimal 2 MB.");
    return false;
  }

  return true;
}


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


/* =========================
   IMAGE FILE CHANGE
========================= */

if ($("imageFile")) {

  $("imageFile").addEventListener("change", event => {

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


/* =========================
   FIREBASE NOTICE
========================= */

function demoNotice() {
  toast(
    "Firebase belum dikonfigurasi. Lengkapi firebase.js dan login admin."
  );
}


/* =========================
   AUTH
========================= */

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


/* =========================
   LOGIN
========================= */

$("login-form").addEventListener("submit", async e => {

  e.preventDefault();

  if (!firebaseConfigured) {
    demoNotice();
    return;
  }

  const form = new FormData(e.currentTarget);

  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

  } catch (err) {

    console.error(err);

    toast(
      "Login gagal. Periksa email, password, dan Firebase Authentication."
    );

  }

});


/* =========================
   LOGOUT
========================= */

$("logout").onclick = async () => {

  try {

    await signOut(auth);

  } catch (err) {

    console.error(err);

    toast("Gagal keluar dari dashboard.");

  }

};


/* =========================
   LOAD ALL
========================= */

async function loadAll() {

  await Promise.all([
    loadProducts(),
    loadOrders()
  ]);

}


/* =========================
   PRODUCTS
========================= */

async function loadProducts() {

  if (!firebaseConfigured) {

    $("admin-products").innerHTML =
      '<tr><td colspan="4">Konfigurasikan Firebase untuk mengelola produk.</td></tr>';

    return;
  }

  try {

    const snap = await getDocs(
      collection(db, "products")
    );

    products = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    renderProducts();

  } catch (err) {

    console.error(err);

    toast(
      "Tidak dapat membaca produk. Periksa Firestore Rules."
    );

  }

}


/* =========================
   RENDER PRODUCTS
========================= */

function renderProducts() {

  $("stat-products").textContent =
    products.filter(p => p.active !== false).length;

  $("admin-products").innerHTML =

    products.length

      ? products.map(p => `

        <tr>

          <td>

            <strong>
              ${esc(p.emoji || "🍪")} ${esc(p.name)}
            </strong>

            <small>
              ${esc(p.category || "Lainnya")}
            </small>

          </td>

          <td>
            ${rupiah(p.price)}
          </td>

          <td>
            ${Number(p.stock) || 0}
          </td>

          <td>

            <button
              class="table-action edit"
              data-edit="${esc(p.id)}"
            >
              Edit
            </button>

            <button
              class="table-action delete"
              data-delete="${esc(p.id)}"
            >
              Hapus
            </button>

          </td>

        </tr>

      `).join("")

      : `

        <tr>

          <td colspan="4">
            Belum ada produk. Tambahkan lewat formulir.
          </td>

        </tr>

      `;


  $("admin-products")
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.onclick = () =>
        editProduct(button.dataset.edit);

    });


  $("admin-products")
    .querySelectorAll("[data-delete]")
    .forEach(button => {

      button.onclick = () =>
        removeProduct(button.dataset.delete);

    });

}


/* =========================
   ORDERS
========================= */

async function loadOrders() {

  if (!firebaseConfigured) {

    $("admin-orders").innerHTML =
      '<tr><td colspan="6">Konfigurasikan Firebase untuk melihat pesanan.</td></tr>';

    return;
  }

  try {

    const snap = await getDocs(
      query(
        collection(db, "orders"),
        orderBy("createdAt", "desc")
      )
    );

    orders = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    renderOrders();

  } catch (err) {

    console.error(err);

    $("admin-orders").innerHTML =
      '<tr><td colspan="6">Gagal memuat pesanan. Periksa Firestore Rules.</td></tr>';

  }

}


/* =========================
   RENDER ORDERS
========================= */

function renderOrders() {

  $("stat-orders").textContent = orders.length;

  $("stat-sales").textContent = rupiah(
    orders
      .filter(o => o.status === "Selesai")
      .reduce(
        (sum, o) =>
          sum + (Number(o.total) || 0),
        0
      )
  );


  $("admin-orders").innerHTML =

    orders.length

      ? orders.map(o => `

        <tr>

          <td>

            <strong>
              ${esc(o.id.slice(0, 9))}
            </strong>

            <small>
              ${esc(o.customerName)} · ${esc(o.phone)}
            </small>

            <small>
              ${esc(o.address)}
            </small>

          </td>


          <td>

            ${(o.items || [])
              .map(i =>
                `${esc(i.name)} ×${Number(i.qty) || 1}`
              )
              .join("<br>")}

          </td>


          <td>
            <strong>
              ${rupiah(o.total)}
            </strong>
          </td>


          <td>
            ${esc(o.payment)}
          </td>


          <td>

            <span class="status-pill">
              ${esc(
                o.status ||
                "Menunggu konfirmasi"
              )}
            </span>

          </td>


          <td>

            <select
              class="status-select"
              data-status="${esc(o.id)}"
            >

              <option
                ${o.status === "Menunggu konfirmasi"
                  ? "selected"
                  : ""}
              >
                Menunggu konfirmasi
              </option>

              <option
                ${o.status === "Diproses"
                  ? "selected"
                  : ""}
              >
                Diproses
              </option>

              <option
                ${o.status === "Dikirim"
                  ? "selected"
                  : ""}
              >
                Dikirim
              </option>

              <option
                ${o.status === "Selesai"
                  ? "selected"
                  : ""}
              >
                Selesai
              </option>

              <option
                ${o.status === "Dibatalkan"
                  ? "selected"
                  : ""}
              >
                Dibatalkan
              </option>

            </select>

          </td>

        </tr>

      `).join("")

      : `

        <tr>

          <td colspan="6">
            Belum ada pesanan.
          </td>

        </tr>

      `;


  $("admin-orders")
    .querySelectorAll("[data-status]")
    .forEach(select => {

      select.onchange = () =>
        updateStatus(
          select.dataset.status,
          select.value
        );

    });

}


/* =========================
   EDIT PRODUCT
========================= */

function editProduct(id) {

  const product =
    products.find(p => p.id === id);

  if (!product) return;


  const form =
    $("product-form");


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

    showImagePreview(
      currentImageUrl
    );

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


/* =========================
   RESET FORM
========================= */

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


/* =========================
   UPLOAD IMAGE
========================= */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");

      // Buang prefix:
      // data:image/png;base64,
      const base64 = result.split(",")[1];

      if (!base64) {
        reject(new Error("Gagal membaca data foto."));
        return;
      }

      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error("Gagal membaca file foto."));
    };

    reader.readAsDataURL(file);
  });
}


async function uploadImage(file, productName) {

  if (!file) {
    return null;
  }

  const user = auth.currentUser;

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

  toast("Mempersiapkan foto...");

  const idToken = await user.getIdToken();

  const content = await fileToBase64(file);

  const payload = {
    fileName: file.name,
    content,
    contentType: file.type,
    productName: productName
  };

  const response = await fetch(
    "/api/upload-image",
    {
      method: "POST",

      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Content-Type": "application/json"
      },

      body: JSON.stringify(payload)
    }
  );

  let data = {};

  const responseText = await response.text();

  try {
    data = responseText
      ? JSON.parse(responseText)
      : {};
  } catch (err) {

    console.error(
      "Response server bukan JSON:",
      responseText
    );

    throw new Error(
      `Server upload error (${response.status}).`
    );
  }

  if (!response.ok) {

    console.error(
      "Upload API error:",
      data
    );

    throw new Error(
      data.error ||
      `Upload foto gagal (${response.status}).`
    );
  }

  if (!data.imageUrl) {
    throw new Error(
      "Upload berhasil tetapi URL foto tidak diterima."
    );
  }

  return data;
}


/* =========================
   SAVE PRODUCT
========================= */

$("product-form")
  .addEventListener(
    "submit",
    async e => {

      e.preventDefault();


      if (!firebaseConfigured) {

        demoNotice();

        return;

      }


      const form =
        new FormData(
          e.currentTarget
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
        e.currentTarget.querySelector(
          'button[type="submit"]'
        );


      const originalText =
        submitButton.textContent;


      try {

        submitButton.disabled = true;

        submitButton.textContent =
          "Menyimpan...";


        let imageUrl =
          currentImageUrl;

        let imagePath =
          currentImagePath;


        /*
          Kalau memilih foto baru,
          upload terlebih dahulu.
        */

        if (selectedImageFile) {

          toast(
            "Mengupload foto..."
          );


          const uploaded =
            await uploadImage(
              selectedImageFile,
              productName
            );


          imageUrl =
            uploaded.imageUrl ||
            uploaded.url ||
            "";


          imagePath =
            uploaded.imagePath ||
            "";

        }


        const payload = {

          name:
            productName,

          category:
            String(
              form.get("category") || ""
            ),

          price:
            Number(
              form.get("price")
            ),

          stock:
            Number(
              form.get("stock")
            ),

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


        if (!payload.name) {

          throw new Error(
            "Nama produk wajib diisi."
          );

        }


        if (
          !Number.isFinite(
            payload.price
          ) ||
          payload.price < 0
        ) {

          throw new Error(
            "Harga produk tidak valid."
          );

        }


        if (
          !Number.isFinite(
            payload.stock
          ) ||
          payload.stock < 0
        ) {

          throw new Error(
            "Stok produk tidak valid."
          );

        }


        /* EDIT */

        if (id) {

          await updateDoc(
            doc(
              db,
              "products",
              id
            ),
            payload
          );


        /* TAMBAH */

        } else {

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

        }


        resetForm();


        toast(
          id
            ? "Produk berhasil diperbarui! 🎉"
            : "Produk berhasil ditambahkan! 🎉"
        );


        await loadProducts();


      } catch (err) {

        console.error(
          "PRODUCT ERROR:",
          err
        );


        toast(
          err.message ||
          "Gagal menyimpan produk."
        );


      } finally {

        submitButton.disabled =
          false;

        submitButton.textContent =
          originalText;

      }

    }
  );


/* =========================
   DELETE PRODUCT
========================= */

async function removeProduct(id) {

  const product =
    products.find(
      p => p.id === id
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


  } catch (err) {

    console.error(err);

    toast(
      "Gagal menghapus produk. Periksa Firestore Rules."
    );

  }

}


/* =========================
   UPDATE ORDER STATUS
========================= */

async function updateStatus(
  id,
  status
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


  } catch (err) {

    console.error(err);

    toast(
      "Gagal memperbarui status. Periksa Firestore Rules."
    );

  }

}


/* =========================
   REFRESH
========================= */

$("refresh").onclick =
  loadProducts;

$("refresh-orders").onclick =
  loadOrders;
