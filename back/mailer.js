import nodemailer from 'nodemailer';
var transport = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
        user: "cdf85978898207",
        pass: "10306a26daa846"
    }
});
export const sendMail = async ({ email, subject, text }) => {
    const info = await transport.sendMail({
        from: '"Simple EDA" <robot@simpleeda.edu>',
        to: email,
        subject: subject,
        text: text,
    });

    //console.log("Message sent:", info.messageId);
}