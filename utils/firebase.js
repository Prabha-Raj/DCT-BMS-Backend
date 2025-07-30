// utils/firebase.js
import admin from "firebase-admin";
import serviceAccount from "../firebaseServiceAccount.json";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
