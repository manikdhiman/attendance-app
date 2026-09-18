const { createClient } = require('@supabase/supabase-js');

let supabase = null;

function getSupabaseClient() {
  if (supabase) return supabase;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[STORAGE] SUPABASE_URL or SUPABASE_ANON_KEY missing. Photo uploads to cloud storage will be skipped.');
    return null;
  }

  supabase = createClient(supabaseUrl, supabaseKey);
  return supabase;
}

/**
 * Uploads a base64 image data string directly to Supabase Storage
 * and returns the public CDN URL.
 */
async function uploadAttendancePhoto(base64Data, userId, type = 'checkin') {
  if (!base64Data || !base64Data.startsWith('data:image')) {
    return null;
  }

  const client = getSupabaseClient();
  // Fallback: If Supabase credentials are not configured, return null or fallback gracefully
  if (!client) {
    return null;
  }

  try {
    const matches = base64Data.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `${userId}/${type}_${Date.now()}.${extension}`;

    const { error } = await client.storage
      .from('attendance-photos')
      .upload(fileName, buffer, {
        contentType: `image/${extension}`,
        upsert: true,
      });

    if (error) {
      console.error('Supabase Storage upload error:', error);
      return null;
    }

    const { data: publicUrlData } = client.storage
      .from('attendance-photos')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('Error in uploadAttendancePhoto:', err);
    return null;
  }
}

module.exports = { uploadAttendancePhoto };