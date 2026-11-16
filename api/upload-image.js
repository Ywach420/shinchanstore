import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const OWNER = "Ywach420";
const REPO = "shinchanstore";
const BRANCH = "main";
const MAX_SIZE = 2 * 1024 * 1024;

const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

function getFirebaseAdmin() {
  if (getApps().length) return getApps()[0];

  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  );

  return initializeApp({
    credential: cert(serviceAccount)
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

export async function POST(request) {
  try {
    if (!process.env.GITHUB_TOKEN) {
      return json({ error: "GITHUB_TOKEN belum dikonfigurasi." }, 500);
    }

    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      return json(
        { error: "Firebase Admin belum dikonfigurasi." },
        500
      );
    }

    const authHeader = request.headers.get("authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Tidak terautentikasi." }, 401);
    }

    const idToken = authHeader.substring(7);

    getFirebaseAdmin();

    const decoded = await getAuth().verifyIdToken(idToken);

    // Harus akun admin yang sama dengan yang dipakai
    // oleh Firestore Rules.
    if (decoded.email !== "admin123123@gmail.com") {
      return json({ error: "Akses admin ditolak." }, 403);
    }

    const form = await request.formData();
    const file = form.get("file");
    const productName = String(form.get("productName") || "produk");

    if (!(file instanceof File)) {
      return json({ error: "File foto tidak ditemukan." }, 400);
    }

    if (!ALLOWED_TYPES[file.type]) {
      return json(
        { error: "Format harus JPG, PNG, WEBP, atau GIF." },
        400
      );
    }

    if (file.size <= 0 || file.size > MAX_SIZE) {
      return json(
        { error: "Ukuran foto maksimal 2 MB." },
        400
      );
    }

    const extension = ALLOWED_TYPES[file.type];

    const safeName = productName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "produk";

    const uniqueId =
      `${Date.now()}-${crypto.randomUUID()}`;

    const path =
      `product-images/${safeName}-${uniqueId}.${extension}`;

    const bytes = new Uint8Array(await file.arrayBuffer());

    let binary = "";
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(
        ...bytes.subarray(i, i + chunkSize)
      );
    }

    const base64 = btoa(binary);

    const githubResponse = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
          "X-GitHub-Api-Version": "2026-03-10",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Upload product image: ${safeName}`,
          content: base64,
          branch: BRANCH
        })
      }
    );

    const githubData = await githubResponse.json();

    if (!githubResponse.ok) {
      console.error("GitHub API:", githubData);

      return json(
        {
          error:
            githubData.message ||
            "Gagal mengupload foto ke GitHub."
        },
        githubResponse.status
      );
    }

    const imageUrl =
      `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;

    return json({
      success: true,
      imageUrl,
      imagePath: path
    });

  } catch (error) {
    console.error(error);

    return json(
      {
        error: "Upload gagal. Periksa konfigurasi server."
      },
      500
    );
  }
}
