// utils/mailer.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465, // SSL
  secure: true, // true = use SSL
  auth: {
    user: process.env.SMTP_EMAIL, // ex: bookmyspace.today@gmail.com
    pass: process.env.SMTP_APP_PASS, // yaha app password dalna hai (16 char)
  },
});

export const sendMail = async (to, subject, text, html = null) => {
  try {
    const mailOptions = {
      from: `"BookMySpace" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      text,
      ...(html && { html }),
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Mail Error:", error);
    return false;
  }
};
