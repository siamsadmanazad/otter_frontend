"use server";
import { Resend } from "resend";

let emailClient: any;

export async function getEmailInstance() { 
    const emailToken = process.env.RESEND_API_KEY;
    if (!emailToken) {
        throw new Error("Please set up resend api key");
    }
    if (!emailClient) {
        emailClient = new Resend(process.env.RESEND_API_KEY);
    }
    return emailClient;
}

// async function sendMail() { 
//     const emailInstance = await getEmailInstance()
//     emailInstance.emails.send({
//         from: "onboarding@resend.dev",
//         to: "asm.tareq.mahmood@g.bracu.ac.bd",
//         subject: "Hello World",
//         html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
//     });
// }
