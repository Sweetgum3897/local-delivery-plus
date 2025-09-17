import { json } from "@remix-run/node";
import { getAdminClient, SPECIAL_COLLECTION_ID } from "../shopify.server";
import { setProductInventory } from "../utils/inventory.js";

// In-memory store (replace with DB in production)
global._oldCollectionProducts = global._oldCollectionProducts || [];

export async function action({ request }) {
  const payload = await request.text();
  const collection = JSON.parse(payload);

  if (collection.id == SPECIAL_COLLECTION_ID) {
    console.log("📦 Special collection updated:", collection.id);

    const admin = getAdminClient(); // ✅ now uses env vars
    console.log("✅ Admin client ready");

    // Step 1: fetch current products in the collection
    const productsRes = await admin.query({
      data: `{
        collection(id: "gid://shopify/Collection/${SPECIAL_COLLECTION_ID}") {
          products(first: 50) {
            edges { node { id title } }
          }
        }
      }`,
    });

    const data = productsRes.body;
    const newProductIds = data.data.collection.products.edges.map(
      (e) => e.node.id,
    );

    // Step 2: load old list
    const oldProductIds = global._oldCollectionProducts;

    // Step 3: diff
    const added = newProductIds.filter((id) => !oldProductIds.includes(id));
    const removed = oldProductIds.filter((id) => !newProductIds.includes(id));

    const metafieldRes = await admin.query({
      data: `{
        shop {
          metafield(namespace: "app", key: "default_inventory_quantity") {
            value
          }
        }
      }`,
    });

    const defaultQty = parseInt(
      metafieldRes.body.data.shop.metafield?.value || "15",
      10,
    );

    // Step 4: set inventory
    for (const productId of added) {
      console.log(
        `🆕 Added to collection: ${productId} → set inventory ${defaultQty}`,
      );
      await setProductInventory(admin, productId, defaultQty);
    }

    for (const productId of removed) {
      console.log(`❌ Removed from collection: ${productId} → set inventory 0`);
      await setProductInventory(admin, productId, 0);
    }

    // Step 5: save latest state
    global._oldCollectionProducts = newProductIds;
  }

  return json({ ok: true });
}
