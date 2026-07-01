import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { action, identifier, otp, newPassword } = await req.json();

    if (action === "request") {
      // Generate 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      // Check if identifier exists in profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .or(`email.eq.${identifier},phone.eq.${identifier}`)
        .maybeSingle();

      if (!profile) {
        return new Response(
          JSON.stringify({ error: "No account found with this email or phone number." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Invalidate previous OTPs for this identifier
      await supabase
        .from("password_resets")
        .update({ used: true })
        .eq("identifier", identifier)
        .eq("used", false);

      // Insert new OTP
      await supabase.from("password_resets").insert({
        identifier,
        otp_code: otpCode,
        expires_at: expiresAt,
      });

      // In production, send via email/SMS. For now, return it (demo mode).
      return new Response(
        JSON.stringify({ success: true, otp: otpCode, message: "OTP generated successfully." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      // Verify OTP
      const { data: resetRecord, error } = await supabase
        .from("password_resets")
        .select("*")
        .eq("identifier", identifier)
        .eq("otp_code", otp)
        .eq("used", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !resetRecord) {
        return new Response(
          JSON.stringify({ error: "Invalid OTP code." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new Date(resetRecord.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "OTP has expired. Please request a new one." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark as used
      await supabase
        .from("password_resets")
        .update({ used: true })
        .eq("id", resetRecord.id);

      return new Response(
        JSON.stringify({ success: true, verified: true, message: "OTP verified." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reset") {
      // Set new password (OTP already verified)
      if (!newPassword || newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const passwordHash = await sha256(newPassword);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ password_hash: passwordHash })
        .or(`email.eq.${identifier},phone.eq.${identifier}`);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to update password." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Password updated successfully." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'request', 'verify', or 'reset'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
