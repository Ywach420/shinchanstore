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

function renderProducts() {

  $("stat-products").textContent =
    products.filter(product => product.active !== false).length;

  $("admin-products").innerHTML = products.length

    ? products.map(product => `

      <tr>

        <td>

          <strong>
            ${esc(product.emoji || "🍪")}
            ${esc(product.name)}
          </strong>

          <small>
            ${esc(product.category || "Lainnya")}
          </small>

        </td>

        <td>
          ${rupiah(product.price)}
        </td>

        <td>
          ${Number(product.stock) || 0}
        </td>

        <td>

          <button
            class="table-action edit"
            data-edit="${esc(product.id)}"
          >
            Edit
          </button>

          <button
            class="table-action delete"
            data-delete="${esc(product.id)}"
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

  $("stat-orders").textContent =
    orders.length;

  $("stat-sales").textContent =
    rupiah(
      orders
        .filter(order => order.status === "Selesai")
        .reduce(
          (total, order) =>
            total + (Number(order.total) || 0),
          0
        )
    );


  $("admin-orders").innerHTML = orders.length

    ? orders.map(order => `

      <tr>

        <td>

          <strong>
            ${esc(order.id.slice(0, 9))}
          </strong>

          <small>
            ${esc(order.customerName)}
            ·
            ${esc(order.phone)}
          </small>

          <small>
            ${esc(order.address)}
          </small>

        </td>


        <td>

          ${(order.items || [])
            .map(item =>
              `${esc(item.name)} ×${Number(item.qty) || 1}`
            )
            .join("<br>")}

        </td>


        <td>

          <strong>
            ${rupiah(order.total)}
          </strong>

        </td>


        <td>
          ${esc(order.payment)}
        </td>


        <td>

          <span class="status-pill">
            ${esc(
              order.status ||
              "Menunggu konfirmasi"
            )}
          </span>

        </td>


        <td>

          <select
            class="status-select"
            data-status="${esc(order.id)}"
          >

            <option
              ${order.status === "Menunggu konfirmasi"
                ? "selected"
                : ""}
            >
              Menunggu konfirmasi
            </option>

            <option
              ${order.status === "Diproses"
                ? "selected"
                : ""}
            >
              Diproses
            </option>

            <option
              ${order.status === "Dikirim"
                ? "selected"
                : ""}
            >
              Dikirim
            </option>

            <option
              ${order.status === "Selesai"
                ? "selected"
                : ""}
            >
              Selesai
            </option>

            <option
              ${order.status === "Dibatalkan"
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
   REFRESH
========================================================= */

$("refresh").onclick =
  loadProducts;

$("refresh-orders").onclick =
  loadOrders;

console.log("Shinchan Admin JS loaded successfully.");
