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


let products = [];
let orders = [];

let selectedImageFile = null;
let currentImageUrl = "";
let currentImagePath = "";


function demoNotice() {
  toast(
    "Firebase belum dikonfigurasi. Lengkapi firebase.js dan login admin."
  );
}
function previewImage(file) {
  const preview = $("image-preview");
  const img = $("image-preview-img");

  if (!file) {
    selectedImage = null;
    preview.hidden = true;
    img.src = "";
    return;
  }

  if (!file.type.startsWith("image/")) {
    toast("File harus berupa gambar.");
    $("imageFile").value = "";
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    toast("Ukuran foto maksimal 2 MB.");
    $("imageFile").value = "";
    return;
  }

  selectedImage = file;

  const reader = new FileReader();

  reader.onload = () => {
    img.src = reader.result;
    preview.hidden = false;
  };

  reader.readAsDataURL(file);
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
$("imageFile").addEventListener("change", e => {
  previewImage(e.target.files[0]);
});

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


async function uploadImage(file, productName) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Admin belum login.");
  }

  const idToken = await user.getIdToken();

  const formData = new FormData();

  formData.append("file", file);
  formData.append("productName", productName);

  const response = await fetch("/api/upload-image", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`
    },
    body: formData
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    throw new Error("Server mengirim response yang tidak valid.");
  }

  if (!response.ok) {
    throw new Error(
      data.error || "Upload foto gagal."
    );
  }

  return data;
}


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


$("login-form").addEventListener("submit", async e => {
  e.preventDefault();

  if (!firebaseConfigured) {
    demoNotice();
    return;
  }

  const f = new FormData(e.currentTarget);

  try {
    await signInWithEmailAndPassword(
      auth,
      f.get("email"),
      f.get("password")
    );
  } catch (err) {
    console.error(err);

    toast(
      "Login gagal: periksa email, password, dan pengaturan Firebase."
    );
  }
});


$("logout").onclick = () => signOut(auth);


async function loadAll() {
  await Promise.all([
    loadProducts(),
    loadOrders()
  ]);
}


async function loadProducts() {
  if (!firebaseConfigured) {
    $("admin-products").innerHTML =
      '<tr><td colspan="4">Konfigurasikan Firebase untuk mengelola produk secara online.</td></tr>';

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

  } catch (e) {
    toast(
      "Tidak dapat membaca produk. Periksa Firestore Rules."
    );

    console.error(e);
  }
}


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

  } catch (e) {
    $("admin-orders").innerHTML =
      '<tr><td colspan="6">Gagal memuat pesanan. Periksa Firestore Rules.</td></tr>';

    console.error(e);
  }
}


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
            <small>${esc(p.category)}</small>
          </td>

          <td>${rupiah(p.price)}</td>

          <td>${Number(p.stock) || 0}</td>

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


function renderOrders() {
  $("stat-orders").textContent = orders.length;

  $("stat-sales").textContent = rupiah(
    orders
      .filter(o => o.status === "Selesai")
      .reduce(
        (sum, o) => sum + (Number(o.total) || 0),
        0
      )
  );

  $("admin-orders").innerHTML =
    orders.length
      ? orders.map(o => `
        <tr>
          <td>
            <strong>${esc(o.id.slice(0, 9))}</strong>
            <small>
              ${esc(o.customerName)} · ${esc(o.phone)}
            </small>
            <small>${esc(o.address)}</small>
          </td>

          <td>
            ${(o.items || [])
              .map(
                i =>
                  `${esc(i.name)} ×${Number(i.qty) || 1}`
              )
              .join("<br>")}
          </td>

          <td>
            <strong>${rupiah(o.total)}</strong>
          </td>

          <td>${esc(o.payment)}</td>

          <td>
            <span class="status-pill">
              ${esc(o.status || "Menunggu konfirmasi")}
            </span>
          </td>

          <td>
            <select
              class="status-select"
              data-status="${esc(o.id)}"
            >
              <option ${o.status === "Menunggu konfirmasi" ? "selected" : ""}>
                Menunggu konfirmasi
              </option>

              <option ${o.status === "Diproses" ? "selected" : ""}>
                Diproses
              </option>

              <option ${o.status === "Dikirim" ? "selected" : ""}>
                Dikirim
              </option>

              <option ${o.status === "Selesai" ? "selected" : ""}>
                Selesai
              </option>

              <option ${o.status === "Dibatalkan" ? "selected" : ""}>
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


function editProduct(id) {
  const p = products.find(x => x.id === id);

  if (!p) return;

  const f = $("product-form");

  for (
    const key of [
      "id",
      "name",
      "category",
      "price",
      "stock",
      "emoji",
      "description",
      "badge"
    ]
  ) {
    if (f.elements[key]) {
      f.elements[key].value = p[key] ?? "";
    }
  }

  selectedImage = null;

  $("imageFile").value = "";

  if (p.imageUrl) {
    $("image-preview-img").src = p.imageUrl;
    $("image-preview").hidden = false;
  } else {
    $("image-preview-img").src = "";
    $("image-preview").hidden = true;
  }

  $("product-form-title").textContent = "Edit produk";

  f.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
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


function resetForm() {
  $("product-form").reset();

  $("product-form").elements.id.value = "";
  $("product-form").elements.emoji.value = "🍜";

  $("imageFile").value = "";
  $("image-preview-img").src = "";
  $("image-preview").hidden = true;

  selectedImage = null;

  $("product-form-title").textContent = "Tambah produk";
}


$("cancel-edit").onclick = resetForm;


$("imageFile").addEventListener(
  "change",
  event => {
    const file =
      event.target.files?.[0];

    if (!file) {
      selectedImageFile = null;
      return;
    }

    if (!validateImage(file)) {
      clearImageSelection();
      return;
    }

    selectedImageFile = file;

    const previewUrl =
      URL.createObjectURL(file);

    showImagePreview(previewUrl);
  }
);


$("product-form").addEventListener("submit", async e => {
  e.preventDefault();

  if (!firebaseConfigured) {
    demoNotice();
    return;
  }

  const f = new FormData(e.currentTarget);
  const id = String(f.get("id") || "");

  const submitButton = e.currentTarget.querySelector(
    'button[type="submit"]'
  );

  const originalText = submitButton.textContent;

  try {
    submitButton.disabled = true;
    submitButton.textContent = "Mengupload...";

    let imageUrl = "";

    // Kalau sedang edit dan tidak memilih foto baru,
    // pertahankan foto lama.
    if (id) {
      const oldProduct = products.find(p => p.id === id);
      imageUrl = oldProduct?.imageUrl || "";
    }

    // Kalau pilih foto baru → upload
    if (selectedImage) {
      toast("Mengupload foto...");

      imageUrl = await uploadProductImage(selectedImage);

      if (!imageUrl) {
        throw new Error("URL foto tidak diterima.");
      }
    }

    const payload = {
      name: String(f.get("name") || "").trim(),
      category: String(f.get("category") || ""),
      price: Number(f.get("price")),
      stock: Number(f.get("stock")),
      emoji: String(f.get("emoji") || "🍪"),
      imageUrl,
      description: String(f.get("description") || ""),
      badge: String(f.get("badge") || ""),
      active: true,
      updatedAt: serverTimestamp()
    };

    if (!payload.name) {
      throw new Error("Nama produk wajib diisi.");
    }

    if (!Number.isFinite(payload.price) || payload.price < 0) {
      throw new Error("Harga produk tidak valid.");
    }

    if (!Number.isFinite(payload.stock) || payload.stock < 0) {
      throw new Error("Stok produk tidak valid.");
    }

    if (id) {
      await updateDoc(
        doc(db, "products", id),
        payload
      );
    } else {
      await addDoc(
        collection(db, "products"),
        {
          ...payload,
          createdAt: serverTimestamp()
        }
      );
    }

    resetForm();

    selectedImage = null;

    $("imageFile").value = "";
    $("image-preview").hidden = true;
    $("image-preview-img").src = "";

    toast(
      id
        ? "Produk berhasil diperbarui."
        : "Produk berhasil ditambahkan."
    );

    await loadProducts();

  } catch (err) {
    console.error(err);

    toast(
      err.message ||
      "Gagal menyimpan produk."
    );

  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
});

    e.preventDefault();

    if (!firebaseConfigured) {
      demoNotice();
      return;
    }

    const form =
      new FormData(e.currentTarget);

    const id =
      String(form.get("id") || "");

    const productName =
      String(form.get("name") || "").trim();

    try {

      let imageUrl = currentImageUrl;
      let imagePath = currentImagePath;

      if (selectedImageFile) {

        toast("Mengupload foto...");

        const uploaded =
          await uploadImage(
            selectedImageFile,
            productName
          );

        imageUrl =
          uploaded.imageUrl;

        imagePath =
          uploaded.imagePath;
      }

      const payload = {
        name: productName,

        category:
          String(form.get("category")),

        price:
          Number(form.get("price")),

        stock:
          Number(form.get("stock")),

        emoji:
          String(form.get("emoji") || "🍪"),

        imageUrl,

        imagePath,

        description:
          String(form.get("description") || ""),

        badge:
          String(form.get("badge") || ""),

        active: true,

        updatedAt:
          serverTimestamp()
      };

      if (id) {

        await updateDoc(
          doc(db, "products", id),
          payload
        );

      } else {

        await addDoc(
          collection(db, "products"),
          {
            ...payload,
            createdAt:
              serverTimestamp()
          }
        );
      }

      resetForm();

      toast(
        "Produk berhasil disimpan! 🎉"
      );

      await loadProducts();

    } catch (err) {

      console.error(err);

      toast(
        err.message ||
        "Gagal menyimpan produk."
      );
    }
  }
);


async function removeProduct(id) {
  const product =
    products.find(p => p.id === id);

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
      doc(db, "products", id)
    );

    toast("Produk dihapus.");

    await loadProducts();

  } catch (e) {

    console.error(e);

    toast(
      "Gagal menghapus produk. Periksa Firestore Rules."
    );
  }
}


async function updateStatus(id, status) {
  try {

    await updateDoc(
      doc(db, "orders", id),
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

  } catch (e) {

    console.error(e);

    toast(
      "Gagal memperbarui status. Periksa Firestore Rules."
    );
  }
}
async function uploadProductImage(file) {
  if (!file) return "";

  const user = auth.currentUser;

  if (!user) {
    throw new Error("Sesi admin sudah habis. Silakan login lagi.");
  }

  const idToken = await user.getIdToken();

  const reader = new FileReader();

  const base64 = await new Promise((resolve, reject) => {
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");

      if (comma === -1) {
        reject(new Error("Format gambar tidak valid."));
        return;
      }

      resolve(result.substring(comma + 1));
    };

    reader.onerror = () => {
      reject(new Error("Gagal membaca file."));
    };

    reader.readAsDataURL(file);
  });

  const response = await fetch("/api/upload-image", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`
    },

    body: JSON.stringify({
      fileName: file.name,
      content: base64,
      contentType: file.type
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Upload foto gagal.");
  }

  return data.imageUrl;
}

$("refresh").onclick =
  loadProducts;

$("refresh-orders").onclick =
  loadOrders;
