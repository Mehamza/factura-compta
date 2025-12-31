import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ContactEmailRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, subject, message }: ContactEmailRequest = await req.json();

    // Validate inputs
    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "Tous les champs sont requis" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Format d'email invalide" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Send email to admin
    const emailResponse = await resend.emails.send({
      from: "Facture Pro <onboarding@resend.dev>",
      to: ["hamzaallagui510@gmail.com"],
      subject: `[Facture Pro Contact] ${subject}`,
      html: `
        <h1>Nouveau message de contact</h1>
        <p><strong>De:</strong> ${name} (${email})</p>
        <p><strong>Sujet:</strong> ${subject}</p>
        <hr />
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr />
        <p style="color: #666; font-size: 12px;">Ce message a été envoyé depuis le formulaire de contact de Facture Pro.</p>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    // Send confirmation email to user
    await resend.emails.send({
      from: "Facture Pro <onboarding@resend.dev>",
      to: [email],
      subject: "Nous avons bien reçu votre message - Facture Pro",
      html: `
        <h1>Merci de nous avoir contactés, ${name}!</h1>
        <p>Nous avons bien reçu votre message et nous vous répondrons dans les plus brefs délais.</p>
        <hr />
        <p><strong>Votre message:</strong></p>
        <p><strong>Sujet:</strong> ${subject}</p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr />
        <p>Cordialement,<br>L'équipe Facture Pro</p>
      `,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-contact-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
