import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';

// Function to generate QR code with centered text
export const generateQRCode = async (data, libraryId) => {
  try {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', 'qr-codes');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `library-${libraryId}-${Date.now()}.png`;
    const filePath = path.join(uploadsDir, fileName);

    // Generate QR code to a data URL first
    const qrDataUrl = await QRCode.toDataURL(data, {
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      width: 300,
      margin: 2
    });

    // Create canvas to add text
    const canvas = createCanvas(300, 350); // Extra space at bottom for text
    const ctx = canvas.getContext('2d');

    // Load QR code image
    const img = await loadImage(qrDataUrl);
    
    // Draw QR code on canvas (centered horizontally)
    ctx.drawImage(img, (canvas.width - img.width) / 2, 0);

    // Add "bookMySpace" text in the center of the QR code
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    
    // Calculate text position (center of QR code)
    const textX = canvas.width / 2;
    const textY = img.height / 2 + 10; // Slightly below center
    
    // Add text background for better visibility
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const textWidth = ctx.measureText('bookMySpace').width;
    ctx.fillRect(
      textX - textWidth / 2 - 10,
      textY - 20,
      textWidth + 20,
      30
    );
    
    // Add text
    ctx.fillStyle = '#000000';
    ctx.fillText('bookMySpace', textX, textY);

    // Save the final image
    const out = fs.createWriteStream(filePath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    return new Promise((resolve, reject) => {
      out.on('finish', () => resolve(`qr-codes/${fileName}`));
      out.on('error', reject);
    });

  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};