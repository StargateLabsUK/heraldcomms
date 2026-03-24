import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_AUDIO_BASE64_LENGTH = 8_000_000; // ~6MB base64 ≈ 4.5MB binary

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: verify caller has a valid trust session via trust_id
    const body = await req.json();
    const { audio, mimeType, trust_id } = body;

    if (!trust_id || typeof trust_id !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing trust_id' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate trust exists
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: trust } = await supabase
      .from('trusts')
      .select('id')
      .eq('id', trust_id)
      .eq('active', true)
      .maybeSingle();

    if (!trust) {
      return new Response(JSON.stringify({ error: 'Invalid trust' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Input validation
    if (!audio || typeof audio !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing audio data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (audio.length > MAX_AUDIO_BASE64_LENGTH) {
      return new Response(JSON.stringify({ error: 'Audio payload too large (max ~6MB)' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');

    // Decode base64 to binary
    const binaryStr = atob(audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const mime = mimeType || 'audio/wav';
    const ext = mime.includes('webm') ? 'webm' : mime.includes('ogg') ? 'ogg' : 'wav';
    const blob = new Blob([bytes], { type: mime });
    const formData = new FormData();
    formData.append('file', blob, `audio.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const data = await res.json();

    return new Response(JSON.stringify({ transcript: data.text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Transcription failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
