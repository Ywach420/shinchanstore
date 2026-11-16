import admin from "firebase-admin";

const OWNER = "Ywach420";
const REPO = "shinchanstore";
const BRANCH = "main";
const ADMIN_EMAIL = "admin123123@gmail.com";

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON belum dikonfigurasi");
    }

    const serviceAccount = JSON.parse(raw);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  return admin.app();
}

function cleanFileName(name = "image") {
  return name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getExtension(type) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif"
  };

  return map[type];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    // =========================
    // 1. CEK FIREBASE LOGIN
    // =========================

    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Login admin diperlukan"
      });
    }

    const idToken = authHeader.substring(7);

    const firebaseApp = getFirebaseAdmin();
    const decoded = await admin
      .auth(firebaseApp)
      .verifyIdToken(idToken);

    if (decoded.email !== ADMIN_EMAIL) {
      return res.status(403).json({
        error: "Akses hanya untuk admin"
      });
    }

    // =========================
    // 2. CEK GITHUB TOKEN
    // =========================

    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
      return res.status(500).json({
        error: "GITHUB_TOKEN belum dikonfigurasi di Vercel"
      });
    }

    // =========================
    // 3. AMBIL DATA FOTO
    // =========================

    const { fileName, content, contentType } = req.body || {};

    if (!fileName || !content || !contentType) {
      return res.status(400).json({
        error: "Data foto tidak lengkap"
      });
    }

    const extension = getExtension(contentType);

    if (!extension) {
      return res.status(400).json({
        error: "Format foto tidak didukung"
      });
    }

    // Maksimal 2 MB setelah decode
    const estimatedBytes = Math.floor((content.length * 3) / 4);

    if (estimatedBytes > 2 * 1024 * 1024) {
      return res.status(400).json({
        error: "Ukuran foto maksimal 2 MB"
      });
    }

    // =========================
    // 4. BUAT NAMA FILE
    // =========================

    const baseName =
      cleanFileName(fileName.replace(/\.[^/.]+$/, "")) ||
      "product";

    const uniqueName =
      `${Date.now()}-${baseName}.${extension}`;

    const path =
      `product-images/${uniqueName}`;

    // =========================
    // 5. UPLOAD KE GITHUB
    // =========================

    const githubResponse = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${githubToken}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Upload product image: ${uniqueName}`,
          content,
          branch: BRANCH
        })
      }
    );

    const githubData = await githubResponse.json();

    if (!githubResponse.ok) {
      console.error("GitHub error:", githubData);

      return res.status(500).json({
        error: "Gagal upload foto ke GitHub"
      });
    }

    // =========================
    // 6. URL FOTO
    // =========================

    const imageUrl =
      `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;

    return res.status(200).json({
      success: true,
      imageUrl,
      path
    });

  } catch (error) {
    console.error("Upload error:", error);

    return res.status(500).json({
      error: error.message || "Upload gagal"
    });
  }
}
