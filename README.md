# The SYK Atelier · India — website and internship certificates

Static website (HTML5, CSS3, vanilla JavaScript) with Supabase (database, authentication,
storage), jsPDF certificates, QRCode.js verification codes, hosted on Netlify.
No build step and no npm install: every library is included in `/vendor`.

## Pages

| Page | URL | What it does |
| --- | --- | --- |
| Homepage | `/` | Hero from the client reference, menu, Shop Now / Cart, Explore Yojan Store, Internship Opportunities |
| Internship Opportunities | `/internships.html` | Completed-student directory (name, internship, completion date, View Certificate) |
| Certificate view | modal on the directory | Shows the **saved original PDF**, certificate ID, valid status, Download |
| Verification (QR target) | `/certificate/SYK-2026-0001` | Valid / invalid status, details, saved PDF, Download. Never regenerates anything |
| Admin | `/admin/` | Email + password login, dashboard, student records, Add New Student |

## How issuing works

1. Admin fills the 14 fields of **Add New Student** (student, father's name, course, semester,
   roll no., college, internship name, start and completion dates, hours ≥ 120, academic year,
   duties, signatory name and designation) and confirms the details.
2. The record is saved as **draft**; the database assigns the ID `SYK-<year>-<0001>`.
3. The browser builds the certificate PDF (A4 portrait, `js/certificate-pdf.js`) with a QR code
   for `SITE_URL/certificate/<ID>`.
4. The PDF is uploaded to the private Supabase Storage bucket `certificates`.
5. Only after the upload succeeds is the record switched to **published**, so it appears on the
   public Internship page. If step 4 fails, the record stays private and the admin can press
   **Finish issuing** in Student Records.

Published certificates can't be edited, so the stored PDF stays the original.

## Security

- Only the public **anon** key goes in `js/config.js`. Never put the service-role key in any file here.
- RLS: the `certificates` and `admins` tables are admin-only. Visitors read through two functions
  that return **published** certificates only and leave out father's name, roll number and
  college (those appear only on the certificate PDF itself).
- Storage bucket is **private**. A visitor can download a PDF only if its certificate is published.
- Admin actions require a Supabase user listed in `public.admins`. Turn off public sign-ups.

## Setup

### 1. Supabase
1. Create a project at supabase.com.
2. **SQL Editor → New query** → paste [`supabase/schema.sql`](supabase/schema.sql) → Run.
3. **Authentication → Sign In / Providers**: turn off "Allow new users to sign up".
4. **Authentication → Users → Add user**: create the admin (email, password, auto-confirm).
5. Make that user an admin (SQL editor):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'admin@example.com';
   ```

### 2. `js/config.js`
| Setting | Value |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SITE_URL` | The live address, e.g. `https://your-site.netlify.app`. **Printed in every QR code**, so set it before issuing real certificates |
| `STORE_URL`, `CART_URL` | Yojan Store and cart links. Until set, those buttons are shown but go nowhere |
| `ORG_ADDRESS`, `ORG_CONTACT` | Optional lines under the letterhead on certificates |
| `SIGNATURE_IMAGE`, `SEAL_IMAGE` | Optional transparent PNGs, e.g. `/assets/images/signature.png`. Without them the certificate shows a signature line and a "SEAL" circle for a physical stamp |

### 3. Hero photo
Replace `assets/images/hero.jpg` with the client's original photo (landscape, at least 2000 px
wide, model on the right). The current file is cropped from the design reference.

### 4. Netlify
Drag this folder into Netlify (or connect the GitHub repo, publish directory `.`, no build
command). `netlify.toml` already rewrites `/certificate/*` to the verification page and sets
security headers. Then add the Netlify address to Supabase → Authentication → URL Configuration.

### Local preview
Without Supabase keys the site runs as a **design preview** with sample students; the admin
login offers "Open dashboard preview", where submitting the form builds the PDF but saves
nothing. Serve the folder with any static server, e.g. `npx serve .` (the pretty
`/certificate/<ID>` link needs Netlify; locally use `/certificate.html?id=SYK-2026-0001`).

## Certificate format

The certificate includes every field from the brief: student name, father's name, course,
semester, roll number, college, internship name, organisation, start and completion dates,
total hours (minimum 120), academic year, duties and responsibilities, authorized signature,
seal and QR verification. The wording should be checked against Appendix-III of the
University of Rajasthan internship guidelines before real certificates are issued. The site
does not claim any University affiliation.

## Files

```
index.html, internships.html, certificate.html, admin/index.html
css/styles.css              design system (palette, type, components)
js/config.js                settings (keys, URLs, signature/seal)
js/common.js                header/menu, data access, PDF viewer, sample data
js/internships.js, js/verify.js, js/admin.js
js/certificate-pdf.js       certificate template (jsPDF + QRCode.js)
supabase/schema.sql         tables, RLS, functions, storage bucket and policies
vendor/                     supabase-js 2.119.2, jsPDF 2.5.2, QRCode.js 1.0.0, pdf.js 4.10.38
fonts/                      Playfair Display, DM Sans (self-hosted; fonts/ttf is used inside the PDF)
netlify.toml                redirects + headers
```
