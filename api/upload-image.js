async function uploadImage(file, productName) {

  if (!file) {
    throw new Error("Foto produk belum dipilih.");
  }

  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "Sesi admin sudah habis. Silakan login lagi."
    );
  }

  // =========================
  // FILE → BASE64
  // =========================

  const content = await new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onload = () => {

      const result = String(reader.result || "");

      // Buang prefix:
      // data:image/png;base64,
      const base64 = result.split(",")[1];

      if (!base64) {
        reject(
          new Error("Foto gagal diproses.")
        );
        return;
      }

      resolve(base64);
    };

    reader.onerror = () => {
      reject(
        new Error("Gagal membaca file foto.")
      );
    };

    reader.readAsDataURL(file);

  });


  // =========================
  // FIREBASE LOGIN TOKEN
  // =========================

  const idToken =
    await user.getIdToken();


  // =========================
  // KIRIM KE API
  // =========================

  const response = await fetch(
    "/api/upload-image",
    {
      method: "POST",

      headers: {
        "Authorization":
          `Bearer ${idToken}`,

        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({

        fileName:
          file.name,

        content:
          content,

        contentType:
          file.type

      })

    }
  );


  let data = {};

  try {

    data =
      await response.json();

  } catch {

    throw new Error(
      "Server upload tidak memberikan response JSON."
    );

  }


  if (!response.ok) {

    throw new Error(
      data.error ||
      "Upload foto gagal."
    );

  }


  if (!data.imageUrl) {

    throw new Error(
      "Upload berhasil tetapi URL foto tidak diterima."
    );

  }


  return {

    imageUrl:
      data.imageUrl,

    imagePath:
      data.path || "",

    productName

  };

}
