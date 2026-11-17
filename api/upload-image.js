import admin from "firebase-admin";

const OWNER = "Ywach420";
const REPO = "shinchanstore";
const BRANCH = "main";
const ADMIN_EMAIL = "admin123123@gmail.com";

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!raw) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON belum dikonfigurasi"
      );
    }

    let serviceAccount;

    try {
      serviceAccount = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON bukan JSON yang valid"
      );
    }

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

  return map[type] || null;
}

export default async function handler(req, res) {

  // =========================
  // METHOD
  // =========================

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    // =========================
    // CEK FIREBASE LOGIN
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
      console.error(
        "Firebase Admin error:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }

    let decoded;

    try {
      decoded = await admin
        .auth(firebaseApp)
        .verifyIdToken(idToken);
    } catch (error) {

      console.error(
        "Firebase token error:",
        error
      );

      return res.status(401).json({
        error:
          "Login Firebase tidak valid. Silakan login ulang."
      });
    }

    // =========================
    // CEK ADMIN
    // =========================

    if (decoded.email !== ADMIN_EMAIL) {
      return res.status(403).json({
        error: "Akses hanya untuk admin"
      });
    }

    // =========================
    // CEK GITHUB TOKEN
    // =========================

    const githubToken =
      process.env.GITHUB_TOKEN;

    if (!githubToken) {
      return res.status(500).json({
        error:
          "GITHUB_TOKEN belum tersedia di Vercel Production"
      });
    }

    // =========================
    // AMBIL DATA JSON
    // =========================

    const {
      fileName,
      content,
      contentType
    } = req.body || {};

    if (!fileName) {
      return res.status(400).json({
        error: "Nama file tidak ada"
      });
    }

    if (!content) {
      return res.status(400).json({
        error: "Data foto tidak ada"
      });
    }

    if (!contentType) {
      return res.status(400).json({
        error: "Tipe foto tidak ada"
      });
    }

    // =========================
    // CEK FORMAT
    // =========================

    const extension =
      getExtension(contentType);

    if (!extension) {
      return res.status(400).json({
        error:
          "Format foto tidak didukung. Gunakan JPG, PNG, WEBP atau GIF."
      });
    }

    // =========================
    // BASE64 -> BUFFER
    // =========================

    let buffer;

    try {
      buffer = Buffer.from(
        content,
        "base64"
      );
    } catch (error) {
      return res.status(400).json({
        error: "Data foto rusak atau bukan Base64 yang valid"
      });
    }

    // =========================
    // BATAS 2 MB
    // =========================

    if (
      buffer.length >
      2 * 1024 * 1024
    ) {
      return res.status(400).json({
        error:
          "Ukuran foto maksimal 2 MB"
      });
    }

    // =========================
    // NAMA FILE
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
    // UPLOAD GITHUB
    // =========================

    const githubUrl =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;

    const githubResponse =
      await fetch(
        githubUrl,
        {
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

            content:
              buffer.toString("base64"),

            branch: BRANCH
          })
        }
      );

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

    // =========================
    // GITHUB ERROR
    // =========================

    if (!githubResponse.ok) {

      console.error(
        "GitHub API error:",
        githubResponse.status,
        githubData
      );

      return res.status(500).json({
        error:
          `GitHub menolak upload (${githubResponse.status}): ${
            githubData.message ||
            "Tidak diketahui"
          }`
      });
    }

    // =========================
    // URL GAMBAR
    // =========================

    const imageUrl =
      `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;

    console.log(
      "IMAGE UPLOAD SUCCESS:",
      imageUrl
    );

    return res.status(200).json({
      success: true,
      imageUrl,
      imagePath: path
    });

  } catch (error) {

    console.error(
      "UPLOAD SERVER ERROR:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Upload server gagal"
    });
  }
}
