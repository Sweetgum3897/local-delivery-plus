import { json } from "@remix-run/node";
import { getAdminClient, SPECIAL_COLLECTION_ID } from "../shopify.server";
import { setProductInventory } from "../utils/inventory.js";

const locks = new Map();

function withLock(key, fn) {
  if (locks.has(key)) {
    return Promise.resolve({ ok: false, reason: "locked" });
  }

  locks.set(key, true);
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      locks.delete(key);
    });
}

export async function action({ request }) {
  const payload = await request.text();
  const collection = JSON.parse(payload);

  if (String(collection.id) !== String(SPECIAL_COLLECTION_ID)) {
    return json({ ok: true });
  }

  return await withLock(`collection-${SPECIAL_COLLECTION_ID}`, async () => {
    console.log("📦 Special collection updated:", collection.id);

    const admin = getAdminClient();
    console.log("✅ Admin client ready");

    const collectionGid = `gid://shopify/Collection/${SPECIAL_COLLECTION_ID}`;

    const productsRes = await admin.query({
      data: `{
        collection(id: "${collectionGid}") {
          products(first: 50) {
            edges { node { id title } }
          }
        }
      }`,
    });

    const newProductIds = productsRes.body.data.collection.products.edges.map(
      (e) => e.node.id,
    );

    const metafieldRes = await admin.query({
      data: `{
        collection(id: "${collectionGid}") {
          metafield(namespace: "app", key: "product_ids") {
            id
            value
            type
          }
        }
      }`,
    });

    const oldProductIdsRaw =
      metafieldRes.body.data.collection.metafield?.value || "[]";
    const oldProductIds = JSON.parse(oldProductIdsRaw);

    const added = newProductIds.filter((id) => !oldProductIds.includes(id));
    const removed = oldProductIds.filter((id) => !newProductIds.includes(id));

    const defaultQtyRes = await admin.query({
      data: `{
        shop {
          metafield(namespace: "app", key: "default_inventory_quantity") {
            value
          }
        }
      }`,
    });

    const defaultQty = parseInt(
      defaultQtyRes.body.data.shop.metafield?.value || "15",
      10,
    );

    for (const productId of added) {
      const currentInventoryRes = await admin.query({
        data: `{
          product(id: "${productId}") {
            variants(first: 1) {
              edges {
                node {
                  inventoryQuantity
                }
              }
            }
          }
        }`,
      });

      const currentQty =
        currentInventoryRes.body.data.product.variants.edges[0].node
          .inventoryQuantity ?? 0;

      if (currentQty === 0) {
        console.log(`🆕 Added: ${productId} → inventory ${defaultQty}`);
        await setProductInventory(admin, productId, defaultQty);
      } else {
        console.log(
          `⏭️ Skipped: ${productId} already has inventory (${currentQty})`,
        );
      }
    }

    for (const productId of removed) {
      console.log(`❌ Removed: ${productId} → inventory 0`);
      await setProductInventory(admin, productId, 0);
    }

    const metafieldSaveRes = await admin.query({
      data: `
        mutation SetProductIdsMetafield {
          metafieldsSet(metafields: [{
            ownerId: "${collectionGid}",
            namespace: "app",
            key: "product_ids",
            type: "list.product_reference",
            value: ${JSON.stringify(JSON.stringify(newProductIds))}
          }]) {
            metafields {
              id
              key
              value
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
    });

    const errors = metafieldSaveRes.body.data.metafieldsSet.userErrors;
    if (errors.length > 0) {
      console.warn("⚠️ Metafield save errors:", errors);
    } else {
      console.log("💾 Metafield updated with new product IDs.");
    }

    return json({ ok: true });
  });
}
