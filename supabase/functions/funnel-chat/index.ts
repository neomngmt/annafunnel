// Supabase Edge Function: funnel-chat
// Backend for the model chat pages. A visitor passes the 18+ step, chats with
// the model's labelled AI version, and gets her OnlyFans link. Chat text is not
// stored, only the counters behind the funnel_stats view.
//
// Deploy (public endpoint, abuse limits live in core.ts):
//   supabase functions deploy funnel-chat --no-verify-jwt
//
// Secrets needed (Supabase Dashboard -> Edge Functions -> Secrets):
//   ANTHROPIC_API_KEY
//   FUNNEL_IP_SALT - any long random string
//   FUNNEL_ALLOWED_ORIGIN - optional, the page's origin, defaults to *
//   FUNNEL_MODEL - optional, overrides the Claude model
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleRequest, modelRequest, readModelResponse, type Deps, type Page, type Session } from "./core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("FUNNEL_ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const anthropic = new Anthropic();
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function toRow(patch: Partial<Session>) {
  const row: Record<string, unknown> = {};
  if (patch.turns !== undefined) row.turns = patch.turns;
  if (patch.linkSent !== undefined) row.link_sent = patch.linkSent;
  if (patch.photoSent !== undefined) row.photo_sent = patch.photoSent;
  if (patch.linkClicked !== undefined) row.link_clicked = patch.linkClicked;
  if (patch.blocked !== undefined) row.blocked = patch.blocked;
  return row;
}

const deps: Deps = {
  ipSalt: Deno.env.get("FUNNEL_IP_SALT") || "",

  async getPage(slug) {
    const { data: page, error } = await supabase
      .from("funnel_pages").select("*").eq("slug", slug).eq("active", true).maybeSingle();
    if (error) throw error;
    if (!page) return null;
    return {
      slug: page.slug,
      name: page.model_name,
      language: page.language,
      opener: page.opener,
      photoUrl: page.photo_url,
      teasePhotos: page.tease_photos || [],
      persona: page.persona || "",
      style: page.style || "",
      offer: page.offer || "",
      ofLinks: page.of_links || {},
    } as Page;
  },

  async countSessions(since, ipHash) {
    let query = supabase.from("funnel_sessions")
      .select("id", { count: "exact", head: true }).gte("created_at", since.toISOString());
    if (ipHash) query = query.eq("ip_hash", ipHash);
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },

  async createSession(s) {
    const { error } = await supabase.from("funnel_sessions")
      .insert({ id: s.id, slug: s.slug, source: s.source, ip_hash: s.ipHash });
    if (error) throw error;
  },

  async getSession(id) {
    const { data, error } = await supabase.from("funnel_sessions").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      slug: data.slug,
      source: data.source,
      ipHash: data.ip_hash,
      turns: data.turns,
      linkSent: data.link_sent,
      photoSent: data.photo_sent,
      linkClicked: data.link_clicked,
      blocked: data.blocked,
    };
  },

  async updateSession(id, patch) {
    const { error } = await supabase.from("funnel_sessions").update(toRow(patch)).eq("id", id);
    if (error) throw error;
  },

  async callModel(system, messages) {
    const request = modelRequest(system, messages, Deno.env.get("FUNNEL_MODEL") || undefined);
    return readModelResponse(await anthropic.beta.messages.create(request));
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    const { status, body } = await handleRequest(await req.json(), ip, deps);
    return jsonResponse(body, status);
  } catch (e) {
    console.error("funnel-chat failed", e);
    return jsonResponse({ error: "Chat is unavailable" }, 500);
  }
});
