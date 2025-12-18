import { getAdminClient, SPECIAL_COLLECTION_ID } from "../shopify.server";

export async function initializeProductIdsMetafield() {
  const admin = getAdminClient();
  const collectionGid = `gid://shopify/Collection/${SPECIAL_COLLECTION_ID}`;

  // Step 1: fetch current products
  const productsRes = await admin.query({
    data: `{
      collection(id: "${collectionGid}") {
        products(first: 100) {
          edges { node { id title } }
        }
      }
    }`,
  });

  const productIds = productsRes.body.data.collection.products.edges.map(
    (e) => e.node.id,
  );

  console.log("📦 Found products in collection:", productIds);

  // Step 2: save as metafield
  const metafieldSaveRes = await admin.query({
    data: `
      mutation SetInitialProductIds {
        metafieldsSet(metafields: [{
          ownerId: "${collectionGid}",
          namespace: "app",
          key: "product_ids",
          type: "list.product_reference",
          value: ${JSON.stringify(JSON.stringify(productIds))}
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
    console.error("❌ Error setting metafield:", errors);
    return false;
  } else {
    console.log("✅ Metafield initialized with current product IDs.");
    return metafieldSaveRes.body.data.metafieldsSet.metafields;
  }
}
