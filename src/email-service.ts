import nodemailer from 'nodemailer';

// Configure your email service (using Gmail as example)
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmailNotification(options: EmailOptions): Promise<boolean> {
  try {
    const mailOptions = {
      from: `"Solana Bot" <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
    };

    await transporter.sendMail(mailOptions);
    console.log('📧 Email notification sent');
    return true;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return false;
  }
}