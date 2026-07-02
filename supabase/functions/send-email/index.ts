// Supabase Edge Function: send-email
// Handles sending confirmation emails to users and notification alerts to admins.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface ContactRecord {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  created_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 1. Check Payload Size Limit (Upload Fail Prevention)
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > 100 * 1024) {
    return new Response(JSON.stringify({ error: "Payload size is too large (maximum 100KB)." }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { record } = (await req.json()) as { record: ContactRecord };

    if (!record) {
      throw new Error("No record found in the request body.");
    }

    // 2. Validate input constraints (e.g. Email too large, message too large)
    if (record.email && record.email.length > 254) {
      return new Response(
        JSON.stringify({ error: "Email address exceeds maximum length of 254 characters." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (record.message && record.message.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Message content exceeds maximum length of 5000 characters." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (record.name && record.name.length > 100) {
      return new Response(
        JSON.stringify({ error: "Name exceeds maximum length of 100 characters." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`Processing contact submission: ${record.name} <${record.email}>`);

    const SENDGRID_KEY = Deno.env.get("SENDGRID_KEY");
    const FROM_EMAIL = "bountyhunter6oo7@gmail.com"; // In production, this must be a verified sender in SendGrid
    const ADMIN_EMAIL = "princedewangan2024@gmail.com";

    const sanitizedName = escapeHtml(record.name || "");
    const sanitizedEmail = escapeHtml(record.email || "");
    const sanitizedSubject = escapeHtml(record.subject || "General Inquiry");
    const sanitizedMessage = escapeHtml(record.message || "");

    // 1. User Confirmation/Welcome Email Content (Page 6 3-Part Structure)
    const userSubject = `Welcome to CodeBoard, ${sanitizedName}!`;
    const userHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to CodeBoard</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f6f9fc; padding: 40px 10px;">
            <tr>
              <td align="center">
                <!-- Email Container -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); overflow: hidden; border: 1px solid #eef2f6;">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 40px; text-align: center;">
                      <div style="display: inline-block; font-size: 24px; font-weight: 800; color: #10b981; letter-spacing: -0.025em; border: 2px solid #10b981; padding: 6px 16px; border-radius: 8px; background-color: rgba(16, 185, 129, 0.1);">
                        &lt;/&gt; CodeBoard
                      </div>
                      <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 20px 0 0 0; letter-spacing: -0.01em;">We've Received Your Message!</h1>
                    </td>
                  </tr>
                  <!-- Body Content -->
                  <tr>
                    <td style="padding: 40px; color: #334155; font-size: 15px; line-height: 1.6;">
                      <p style="margin-top: 0; font-size: 18px; font-weight: 600; color: #0f172a;">Hi ${sanitizedName},</p>
                      <p>Thank you for reaching out to us. We have successfully received your feedback regarding: <strong style="color: #0f172a;">"${sanitizedSubject}"</strong>.</p>
                      <p>Our developer and support team are already on it. We review every submission carefully and typically get back to you within 24 hours.</p>
                      
                      <!-- Action Card -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin: 30px 0;">
                        <tr>
                          <td style="padding: 24px; text-align: center;">
                            <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 500; color: #64748b;">In the meantime, you can jump straight back to your active spaces:</p>
                            <a href="https://codeboard-app.dev/dashboard" target="_blank" style="background-color: #10b981; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2); transition: background-color 0.2s ease;">Go to Dashboard</a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin-bottom: 0;">Best regards,<br><strong style="color: #0f172a;">The CodeBoard Team</strong></p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 30px 40px; border-top: 1px solid #eef2f6; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                      <p style="margin: 0 0 10px 0;">CodeBoard · Real-time Collaborative Coding Hub</p>
                      <p style="margin: 0 0 20px 0;">You received this email because you submitted a contact request on our website.</p>
                      <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 20px auto;">
                        <tr>
                          <td style="padding: 0 10px;"><a href="https://github.com" style="color: #64748b; text-decoration: none; font-weight: 500;">GitHub</a></td>
                          <td style="color: #cbd5e1;">•</td>
                          <td style="padding: 0 10px;"><a href="https://twitter.com" style="color: #64748b; text-decoration: none; font-weight: 500;">Twitter</a></td>
                          <td style="color: #cbd5e1;">•</td>
                          <td style="padding: 0 10px;"><a href="#" style="color: #64748b; text-decoration: none; font-weight: 500;">Support</a></td>
                        </tr>
                      </table>
                      <p style="margin: 0; font-size: 11px;">If you did not request this, you can safely ignore this email or <a href="#" style="color: #10b981; text-decoration: underline;">unsubscribe</a>.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    // 2. Admin Notification Email Content (Page 7 Notification checklist)
    const adminSubject = `[New Contact Form] ${sanitizedSubject} - from ${sanitizedName}`;
    const adminHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Contact Submission</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f6f9fc; padding: 40px 10px;">
            <tr>
              <td align="center">
                <!-- Email Container -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); overflow: hidden; border: 1px solid #eef2f6;">
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #0f172a; padding: 30px 40px;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td>
                            <div style="font-size: 18px; font-weight: 700; color: #10b981;">
                              &lt;/&gt; CodeBoard Alert
                            </div>
                          </td>
                          <td align="right" style="color: #94a3b8; font-size: 12px; font-weight: 500;">
                            New Submission
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Body Content -->
                  <tr>
                    <td style="padding: 40px; color: #334155; font-size: 15px; line-height: 1.6;">
                      <h2 style="margin-top: 0; font-size: 20px; font-weight: 700; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">Contact Form Submission</h2>
                      
                      <!-- Details Table -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
                        <tr>
                          <td width="30%" style="padding: 8px 0; font-weight: 600; color: #64748b; font-size: 14px; vertical-align: top;">Name:</td>
                          <td width="70%" style="padding: 8px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${sanitizedName}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; font-weight: 600; color: #64748b; font-size: 14px; vertical-align: top;">Email:</td>
                          <td style="padding: 8px 0; color: #0f172a; font-size: 14px; font-weight: 500;"><a href="mailto:${sanitizedEmail}" style="color: #10b981; text-decoration: none;">${sanitizedEmail}</a></td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; font-weight: 600; color: #64748b; font-size: 14px; vertical-align: top;">Subject:</td>
                          <td style="padding: 8px 0; color: #0f172a; font-size: 14px; font-weight: 500; text-transform: capitalize;">${sanitizedSubject}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; font-weight: 600; color: #64748b; font-size: 14px; vertical-align: top;">Submitted At:</td>
                          <td style="padding: 8px 0; color: #0f172a; font-size: 14px;">${new Date(record.created_at).toLocaleString()}</td>
                        </tr>
                      </table>

                      <!-- Message Container -->
                      <p style="margin: 30px 0 10px 0; font-weight: 600; color: #64748b; font-size: 14px;">User Message:</p>
                      <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 20px; border-radius: 0 8px 8px 0; border-top: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap; font-family: inherit;">${sanitizedMessage}</div>
                      
                      <!-- Quick Reply -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 35px; text-align: center;">
                        <tr>
                          <td>
                            <a href="mailto:${sanitizedEmail}?subject=Re: [CodeBoard] ${sanitizedSubject}" style="background-color: #0f172a; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px; transition: background-color 0.2s ease;">Reply Directly via Email</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 20px 40px; border-top: 1px solid #eef2f6; text-align: center; color: #94a3b8; font-size: 11px;">
                      This alert was automatically generated by the CodeBoard System database trigger.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    if (!SENDGRID_KEY) {
      console.warn("SENDGRID_KEY environment variable is not set. Running in MOCK mode.");
      console.log("--- MOCK EMAIL TO USER ---");
      console.log(`To: ${sanitizedEmail}\nSubject: ${userSubject}\nBody:\n${sanitizedMessage}`);
      console.log("--- MOCK EMAIL TO ADMIN ---");
      console.log(`To: ${ADMIN_EMAIL}\nSubject: ${adminSubject}`);

      return new Response(
        JSON.stringify({
          message: "Email processed successfully (Mock Mode: SENDGRID_KEY not set).",
          mock: true,
          record,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Send User Confirmation Email via SendGrid REST API
    const userMailRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SENDGRID_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: sanitizedEmail }] }],
        from: { email: FROM_EMAIL, name: "CodeBoard Support" },
        subject: userSubject,
        content: [{ type: "text/html", value: userHtml }],
      }),
    });

    if (!userMailRes.ok) {
      const errorText = await userMailRes.text();
      console.error(`SendGrid failed to send user confirmation: ${errorText}`);
    }

    // Send Admin Notification Email via SendGrid REST API
    const adminMailRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SENDGRID_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: ADMIN_EMAIL }] }],
        from: { email: FROM_EMAIL, name: "CodeBoard System" },
        subject: adminSubject,
        content: [{ type: "text/html", value: adminHtml }],
      }),
    });

    if (!adminMailRes.ok) {
      const errorText = await adminMailRes.text();
      console.error(`SendGrid failed to send admin notification: ${errorText}`);
    }

    return new Response(
      JSON.stringify({
        message: "Emails sent successfully.",
        userMailSent: userMailRes.ok,
        adminMailSent: adminMailRes.ok,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Error executing Edge Function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
