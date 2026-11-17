import admin from "firebase-admin";

const OWNER = "Ywach420";
const REPO = "shinchanstore";
const BRANCH = "main";
const ADMIN_EMAIL = "admin123123@gmail.com";

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON tidak ditemukan");
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
    // 1. CEK AUTH
    // =========================

    const authHeader =
      req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Login admin diperlukan"
      });
    }

    const idToken =
      authHeader.substring(7);

    let firebaseApp;

    try {
      firebaseApp = getFirebaseAdmin();
    } catch (error) {
      console.error("FIREBASE INIT ERROR:", error);

      return res.status(500).json({
        error: "Firebase Admin gagal dijalankan: " + error.message
      });
    }

    let decoded;

    try {
      decoded = await admin
        .auth(firebaseApp)
        .verifyIdToken(idToken);
    } catch (error) {
      console.error("FIREBASE AUTH ERROR:", error);

      return res.status(401).json({
        error: "Token login Firebase tidak valid atau sudah expired"
      });
    }

    if (decoded.email !== ADMIN_EMAIL) {
      return res.status(403).json({
        error: "Akses hanya untuk admin"
      });
    }

    // =========================
    // 2. CEK GITHUB TOKEN
    // =========================

    const githubToken =
      process.env.GITHUB_TOKEN;

    if (!githubToken) {
      return res.status(500).json({
        error: "GITHUB_TOKEN belum tersedia di Vercel Production"
      });
    }

    // =========================
    // 3. BACA MULTIPART FORM
    // =========================

    const formidableModule =
      await import("formidable");

    const formidable =
      formidableModule.default ||
      formidableModule.formidable;

    const form =
      formidable({
        multiples: false,
        maxFileSize: 2 * 1024 * 1024
      });

    const [fields, files] =
      await form.parse(req);

    const uploadedFile =
      files.file?.[0] || files.file;

    if (!uploadedFile) {
      return res.status(400).json({
        error: "File foto tidak ditemukan"
      });
    }

    const fileName =
      uploadedFile.originalFilename ||
      "product-image";

    const contentType =
      uploadedFile.mimetype ||
      "";

    // =========================
    // 4. VALIDASI FILE
    // =========================

    const extension =
      getExtension(contentType);

    if (!extension) {
      return res.status(400).json({
        error:
          "Format foto tidak didukung. Gunakan JPG, PNG, WEBP atau GIF."
      });
    }

    if (
      uploadedFile.size >
      2 * 1024 * 1024
    ) {
      return res.status(400).json({
        error: "Ukuran foto maksimal 2 MB"
      });
    }

    // =========================
    // 5. BACA FILE
    // =========================

    const fs =
      await import("fs/promises");

    const buffer =
      await fs.readFile(
        uploadedFile.filepath
      );

    const content =
      buffer.toString("base64");

    // =========================
    // 6. NAMA FILE
    // =========================

    const baseName =
      cleanFileName(
        fileName.replace(
          /\.[^/.]+$/,
          ""
        )
      ) || "product";

    const uniqueName =
      `${Date.now()}-${baseName}.${extension}`;

    const path =
      `product-images/${uniqueName}`;

    // =========================
    // 7. UPLOAD KE GITHUB
    // =========================

    const githubUrl =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;

    const githubResponse =
      await fetch(githubUrl, {
        method: "PUT",

        headers: {
          Authorization:
            `Bearer ${githubToken}`,

          Accept:
            "application/vnd.github+json",

          "X-GitHub-Api-Version":
            "2022-11-28",

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          message:
            `Upload product image: ${uniqueName}`,

          content,

          branch: BRANCH
        })
      });

    const githubText =
      await githubResponse.text();

    let githubData = {};

    try {
      githubData =
        JSON.parse(githubText);
    } catch {
      githubData = {
        raw: githubText
      };
    }

    if (!githubResponse.ok) {

      console.error(
        "GITHUB ERROR:",
        githubData
      );

      return res.status(500).json({
        error:
          `GitHub menolak upload (${githubResponse.status}): ${
            githubData.message ||
            "Unknown error"
          }`
      });
    }

    // =========================
    // 8. URL FOTO
    // =========================

    const imageUrl =
      `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;

    return res.status(200).json({
      success: true,
      imageUrl,
      imagePath: path
    });

  } catch (error) {

    console.error(
      "UPLOAD IMAGE ERROR:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Upload server gagal"
    });
  }
}
