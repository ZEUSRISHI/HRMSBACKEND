"use strict";

/* ============================================================
   Disables response compression signaling for any request
   carrying an Authorization header (authenticated API calls
   that return tokens or user-specific data), and for auth
   routes generally. This removes the BREACH precondition
   (secret + reflected input compressed together) for the
   responses most likely to carry sensitive tokens.

   IMPORTANT LIMITATION: this only affects compression that
   YOUR Node process applies. If gzip/brotli is being added by
   Render's or Vercel's edge/proxy layer (which is the case for
   this app — there is no compression() middleware in app.js),
   this header can be ignored or overwritten by that layer.
   True control over edge compression requires a CDN you
   configure directly (e.g. Cloudflare Transform Rules).
   ============================================================ */
function noCompressionForAuth(req, res, next) {
  if (req.headers.authorization || req.originalUrl.includes("/auth/")) {
    res.setHeader("Content-Encoding", "identity");
  }
  next();
}

module.exports = noCompressionForAuth;
