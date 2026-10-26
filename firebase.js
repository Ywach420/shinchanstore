import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCorfaQPcT3sQk_Rmoh7gDKRqeqjmkVg-c",
  authDomain: "store-248d7.firebaseapp.com",
  projectId: "store-248d7",
  messagingSenderId: "426211801861",
  appId: "1:426211801861:web:fcb1d49f59d94938ab156c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
