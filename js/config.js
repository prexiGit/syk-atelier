/*
 * THE SYK ATELIER — site settings.
 * Fill these in before going live. Only the public "anon" key belongs here:
 * NEVER put the Supabase service-role key in any frontend file.
 */
window.SYK_CONFIG = {
  // Supabase → Project Settings → API
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Live website address. It is printed inside every certificate QR code,
  // e.g. https://thesykatelier.netlify.app  →  /certificate/SYK-2026-0001
  SITE_URL: "",

  // Header and hero links. Leave empty to hide the button (no invented destinations).
  STORE_URL: "", // "Explore Yojan Store" and "Shop Now"
  CART_URL: "",  // "Cart"

  // Organisation details printed on certificates
  ORG_NAME: "The SYK Atelier",
  ORG_PLACE: "India",
  ORG_ADDRESS: "", // optional full address line for the certificate header
  ORG_CONTACT: "", // optional email / phone line for the certificate header

  // Optional transparent PNGs drawn on certificates, e.g. "/assets/images/signature.png"
  SIGNATURE_IMAGE: "",
  SEAL_IMAGE: "",
};
