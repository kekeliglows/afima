// ── PANIER (stocké côté serveur, table Supabase panier_items) ──
// Le panier n'est plus stocké en localStorage : il est lié au compte
// utilisateur (RLS : chacun ne voit/modifie que ses propres lignes),
// ce qui permet de le retrouver sur n'importe quel appareil et évite
// qu'il soit perdu en vidant les données du navigateur.
//
// Toutes les fonctions attendent { supabaseClient, userId } explicitement
// (même convention que Wishlist dans wishlist.js) plutôt que de créer
// leur propre client, pour rester indépendantes de la page qui les appelle.

async function getCartItems({ supabaseClient, userId }) {
  if (!userId || !supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from('panier_items')
    .select('id, qty, produit_id, produits(id, titre, prix, image_url, stock)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data
    .filter(row => row.produits) // le produit a pu être supprimé entre-temps
    .map(row => ({
      cartItemId: row.id,
      id: row.produits.id,
      titre: row.produits.titre,
      prix: row.produits.prix,
      image_url: row.produits.image_url,
      stock: row.produits.stock,
      qty: row.qty
    }));
}

async function getCartCount({ supabaseClient, userId }) {
  const items = await getCartItems({ supabaseClient, userId });
  return items.reduce((s, i) => s + i.qty, 0);
}

// produit = { id, stock } minimum. qty = quantité à AJOUTER (pas la quantité finale).
async function addToCart({ supabaseClient, userId, produit, qty }) {
  if (!userId || !supabaseClient) throw new Error('Connexion requise pour ajouter un produit au panier.');

  const { data: existing, error: selectError } = await supabaseClient
    .from('panier_items')
    .select('id, qty')
    .eq('user_id', userId)
    .eq('produit_id', produit.id)
    .maybeSingle();

  if (selectError) throw selectError;

  const maxQty = produit.stock ?? Infinity;

  if (existing) {
    const newQty = Math.min(existing.qty + qty, maxQty);
    const { error } = await supabaseClient
      .from('panier_items')
      .update({ qty: newQty })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseClient
      .from('panier_items')
      .insert([{ user_id: userId, produit_id: produit.id, qty: Math.min(qty, maxQty) }]);
    if (error) throw error;
  }
}

// qty = quantité FINALE de la ligne (pas un delta).
async function updateCartItemQty({ supabaseClient, cartItemId, qty }) {
  if (qty <= 0) return removeCartItem({ supabaseClient, cartItemId });

  const { error } = await supabaseClient
    .from('panier_items')
    .update({ qty })
    .eq('id', cartItemId);
  if (error) throw error;
}

async function removeCartItem({ supabaseClient, cartItemId }) {
  const { error } = await supabaseClient
    .from('panier_items')
    .delete()
    .eq('id', cartItemId);
  if (error) throw error;
}

async function clearCart({ supabaseClient, userId }) {
  if (!userId || !supabaseClient) return;
  const { error } = await supabaseClient
    .from('panier_items')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}

window.Cart = {
  getCartItems,
  getCartCount,
  addToCart,
  updateCartItemQty,
  removeCartItem,
  clearCart
};