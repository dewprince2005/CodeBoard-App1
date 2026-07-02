# Email Automation System & Contact Form Integration

This document outlines the detailed technical specifications and setup instructions for the automated email system implemented in this project.

---

## 1. Database Specifications

### Table: `public.contact_messages`
Stores contact form submissions securely.

* **Schema**:
  * `id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
  * `name`: `TEXT` (Name of sender)
  * `email`: `TEXT` (Email address of sender)
  * `subject`: `TEXT` (Subject category: `feedback`, `bug`, `feature`, `business`)
  * `message`: `TEXT` (Form message content)
  * `created_at`: `TIMESTAMPTZ` (Insertion timestamp, Default: `now()`)

* **Database Validations (CHECK Constraints)**:
  * Name validation: `length(trim(name)) >= 2 AND length(name) <= 100`
  * Email format verification: `email ~* '^[A-Za-z0-9._%+!-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AND length(email) <= 254`
  * Subject dropdown safety check: `subject IN ('feedback', 'bug', 'feature', 'business')`
  * Message validation: `length(trim(message)) >= 10 AND length(message) <= 5000`

* **Security (Row Level Security)**:
  * Policy: `Anyone can submit contact messages` (Allows anonymous insert access from the public form).
  * Policy: `Admins and moderators can view contact messages` (Restricts read access to authenticated admins/moderators only).

---

## 2. Trigger Flow

1. An `INSERT` to the `contact_messages` table fires the database trigger `on_new_contact`.
2. The trigger executes `public.on_contact_message_inserted()`.
3. This helper routes an HTTP POST request to the Supabase Edge Function endpoint (`https://syjlssrxnrhjiszpxuoj.supabase.co/functions/v1/send-email`) using the `pg_net` extension.

---

## 3. Edge Function specifications (`send-email`)

Located at [supabase/functions/send-email/index.ts](file:///c:/Users/Asus/Downloads/codeboard-whisperer-2dd41a71-main/codeboard-whisperer-2dd41a71-main/supabase/functions/send-email/index.ts).

* **Payload and Validation Guards**:
  * Rejects request payload sizes exceeding `100KB` (`413 Payload Too Large`).
  * Validates string sizes (`name <= 100`, `email <= 254`, `message <= 5000`) before template formatting.
  * Sanitizes all user inputs (`escapeHtml`) to prevent HTML/XSS injection inside email bodies.
* **Email Templates**:
  * **User Onboarding welcome email**: Sent to the submitter using your verified SendGrid address, containing a responsive dark-themed header and a dashboard redirection CTA button.
  * **Admin notification alert**: Sent to `princedewangan2024@gmail.com` detailing the sender's name, email, subject dropdown selection, and full message block.
* **Fallback Simulator**: If `SENDGRID_KEY` is not present, prints the complete email payloads to the console/logs and exits gracefully.

---

## 4. Environment Secrets Configuration

Configure your SendGrid verified sender key in your Supabase dashboard or terminal:
```bash
supabase secrets set SENDGRID_KEY=SG.your_sendgrid_api_key
```

*Note: Ensure `FROM_EMAIL = "bountyhunter6oo7@gmail.com"` remains verified inside your SendGrid dashboard settings.*
