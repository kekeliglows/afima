const WISHLIST_STORAGE_KEY = 'afima_wishlist';

function getGuestWishlistIds() {
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function setGuestWishlistIds(ids) {
  try {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids));
  } catch {}
}

async function syncGuestWishlistToSupabase({ supabaseClient, userId }) {
  if (!supabaseClient || !userId) return [];

  const guestIds = getGuestWishlistIds();
  if (!guestIds.length) return [];

  const { data: existing = [] } = await supabaseClient
    .from('wishlists')
    .select('product_id')
    .eq('user_id', userId);

  const existingIds = (existing || []).map(item => String(item.product_id));
  const missingIds = guestIds.filter(id => !existingIds.includes(String(id)));

  if (missingIds.length) {
    const rows = missingIds.map(id => ({ user_id: userId, product_id: id, product_title: 'Produit' }));
    await supabaseClient.from('wishlists').insert(rows);
  }

  return [...new Set([...existingIds, ...guestIds])];
}

async function getWishlistIds({ supabaseClient, userId }) {
  if (!userId || !supabaseClient) {
    return getGuestWishlistIds();
  }

  try {
    const { data, error } = await supabaseClient
      .from('wishlists')
      .select('product_id')
      .eq('user_id', userId);

    if (error) throw error;

    const dbIds = (data || []).map(item => String(item.product_id));
    const guestIds = getGuestWishlistIds();
    const merged = [...new Set([...dbIds, ...guestIds])];

    if (guestIds.length) {
      await syncGuestWishlistToSupabase({ supabaseClient, userId });
    }

    return merged;
  } catch {
    return getGuestWishlistIds();
  }
}

async function toggleProductWishlist({ supabaseClient, userId, product, productId }) {
  const id = String(product?.id ?? productId);
  if (!id) return { isFavorite: false, ids: getGuestWishlistIds() };

  if (!userId || !supabaseClient) {
    const current = getGuestWishlistIds();
    const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
    setGuestWishlistIds(next);
    return { isFavorite: next.includes(id), ids: next };
  }

  const currentIds = await getWishlistIds({ supabaseClient, userId });
  const isFavorite = currentIds.includes(id);

  if (isFavorite) {
    await supabaseClient.from('wishlists').delete().eq('user_id', userId).eq('product_id', id);
    const next = currentIds.filter(item => item !== id);
    return { isFavorite: false, ids: next };
  }

  await supabaseClient.from('wishlists').insert([{ user_id: userId, product_id: id, product_title: product?.titre || product?.title || 'Produit' }]);
  const next = [...currentIds, id];
  return { isFavorite: true, ids: next };
}

window.Wishlist = {
  getWishlistIds,
  toggleProductWishlist,
  getGuestWishlistIds,
  setGuestWishlistIds,
  syncGuestWishlistToSupabase
};