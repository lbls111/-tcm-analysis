
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AISettings, BenCaoHerb } from '../types';

let supabase: SupabaseClient | null = null;
let currentSettings: { url: string; key: string } | null = null;

// Initialize or get existing client
export const getSupabaseClient = (settings: AISettings): SupabaseClient | null => {
  if (!settings.supabaseUrl || !settings.supabaseKey) return null;

  // Re-initialize if settings changed
  if (
    !supabase ||
    currentSettings?.url !== settings.supabaseUrl ||
    currentSettings?.key !== settings.supabaseKey
  ) {
    try {
      supabase = createClient(settings.supabaseUrl, settings.supabaseKey);
      currentSettings = { url: settings.supabaseUrl, key: settings.supabaseKey };
    } catch (e) {
      console.error("Failed to initialize Supabase client:", e);
      return null;
    }
  }
  return supabase;
};

// Fetch all custom herbs from Cloud
export const fetchCloudHerbs = async (settings: AISettings): Promise<BenCaoHerb[]> => {
  const client = getSupabaseClient(settings);
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('herbs')
      .select('*');

    if (error) {
      if (error.code === '42P01' || error.message.includes('Could not find the table')) { 
          console.warn("[Supabase] Table 'herbs' does not exist. Please run the setup SQL.");
          return []; 
      } else {
          console.error("Error fetching herbs from Supabase:", error.message);
      }
      return [];
    }

    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id || `cloud-${row.name}`,
      name: row.name,
      nature: row.nature,
      flavors: Array.isArray(row.flavors) ? row.flavors : JSON.parse(row.flavors || '[]'),
      meridians: Array.isArray(row.meridians) ? row.meridians : JSON.parse(row.meridians || '[]'),
      efficacy: row.efficacy,
      usage: row.usage,
      category: row.category,
      processing: row.processing,
      isRaw: false,
      source: 'cloud'
    }));
  } catch (e) {
    console.error("Supabase fetch exception:", e);
    return [];
  }
};

// Insert a new herb into Cloud
export const insertCloudHerb = async (herb: BenCaoHerb, settings: AISettings): Promise<boolean> => {
  const client = getSupabaseClient(settings);
  if (!client) return false;

  try {
    const payload = {
        name: herb.name,
        nature: herb.nature,
        flavors: Array.isArray(herb.flavors) ? herb.flavors : [],
        meridians: Array.isArray(herb.meridians) ? herb.meridians : [],
        efficacy: herb.efficacy,
        usage: herb.usage,
        category: herb.category,
        processing: herb.processing
    };

    const { error } = await client
      .from('herbs')
      .upsert(payload, { onConflict: 'name' });

    if (error) {
      console.error("Error inserting herb to Supabase:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Supabase insert exception:", e);
    return false;
  }
};

// Update an existing herb in Cloud
export const updateCloudHerb = async (id: string, herb: BenCaoHerb, settings: AISettings): Promise<boolean> => {
  const client = getSupabaseClient(settings);
  if (!client) return false;

  try {
    const payload = {
        name: herb.name,
        nature: herb.nature,
        flavors: herb.flavors,
        meridians: herb.meridians,
        efficacy: herb.efficacy,
        usage: herb.usage,
        category: herb.category,
        processing: herb.processing
    };

    // Use name as the primary reliable key for updates
    const { error, count } = await client
      .from('herbs')
      .update(payload)
      .eq('name', herb.name);

    if (error) {
      console.error("Error updating herb in Supabase:", error.message);
      return false;
    }
    if (count === 0) {
        console.warn(`[Supabase] Update by name '${herb.name}' affected 0 rows. Attempting to update by ID '${id}' as a fallback.`);
        const { error: idError } = await client.from('herbs').update(payload).eq('id', id);
        if (idError) {
             console.error("Error updating herb by ID fallback:", idError.message);
             return false;
        }
    }
    return true;
  } catch (e) {
    console.error("Supabase update exception:", e);
    return false;
  }
};

// Bulk Upsert Herbs
export const bulkUpsertHerbs = async (herbs: BenCaoHerb[], settings: AISettings): Promise<{ success: number, failed: number, error?: string }> => {
    const client = getSupabaseClient(settings);
    if (!client) return { success: 0, failed: herbs.length };

    let successCount = 0;
    let failedCount = 0;
    let errorMessage: string | undefined = undefined;

    const payload = herbs.map(herb => ({
        name: herb.name,
        nature: herb.nature,
        flavors: herb.flavors, 
        meridians: herb.meridians,
        efficacy: herb.efficacy,
        usage: herb.usage,
        category: herb.category,
        processing: herb.processing
    }));

    try {
        const BATCH_SIZE = 100;
        for (let i = 0; i < payload.length; i += BATCH_SIZE) {
            const batch = payload.slice(i, i + BATCH_SIZE);
            console.log(`[Supabase] Upserting batch ${i / BATCH_SIZE + 1}...`);
            const { error, count } = await client
                .from('herbs')
                .upsert(batch, { onConflict: 'name' });

            if (error) {
                console.error(`Batch upsert error (${i}-${i+BATCH_SIZE}):`, error);
                if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
                    errorMessage = "Could not find the table 'public.herbs'.";
                }
                failedCount += batch.length;
                if(errorMessage) break; // Stop on critical error like table not found
            } else {
                successCount += batch.length;
            }
        }
    } catch (e: any) {
        console.error("Bulk upsert exception:", e);
        errorMessage = e.message;
        failedCount = herbs.length - successCount;
    }
    
    if (errorMessage) {
      failedCount = herbs.length;
      successCount = 0;
    }

    console.log(`[Supabase] Bulk upsert complete. Success: ${successCount}, Failed: ${failedCount}`);
    return { success: successCount, failed: failedCount, error: errorMessage };
};
