import nodemailer from "nodemailer";

const sendEmail = async ({ email, subject, message }) => {
    // For now, we'll just log the email to the console as a mock
    // console.log(`--- MOCK EMAIL SENT ---`);
    // console.log(`To: ${email}`);
    // console.log(`Subject: ${subject}`);
    // console.log(`Message: ${message}`);
    // console.log(`------------------------`);

    // In a real scenario, you'd use nodemailer or a service like Resend
    
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const mailOptions = {
        from: process.env.SMTP_FROM,
        to: email,
        subject: subject,
        text: message,
    };

    await transporter.sendMail(mailOptions);
    
};

export { sendEmail };
