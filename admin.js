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
  const product =
    products.find(p => p.id === id);

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


function resetForm() {
  $("product-form").reset();

  $("product-form").elements.id.value = "";

  $("product-form").elements.emoji.value =
    "🍜";

  $("product-form-title").textContent =
    "Tambah produk";

  selectedImageFile = null;
  currentImageUrl = "";
  currentImagePath = "";

  clearImageSelection();
  showImagePreview("");
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


$("product-form").addEventListener(
  "submit",
  async e => {

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


$("refresh").onclick =
  loadProducts;

$("refresh-orders").onclick =
  loadOrders;
