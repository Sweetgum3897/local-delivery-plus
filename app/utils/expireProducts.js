import { getAdminClient, SPECIAL_COLLECTION_ID } from "../shopify.server.js";

const getCutoff = (metaDate, hourOffset) => {
  const [year, month, day] = metaDate.split("-").map(Number);

  // Target date at midnight UTC
  const dateObj = new Date(Date.UTC(year, month - 1, day));

  // Apply offset (negative = before date, positive = after date)
  dateObj.setUTCHours(dateObj.getUTCHours() - hourOffset);

  console.log("Calculated cutoff date:", dateObj);

  return dateObj;
};

export default async function expireProducts() {
  const admin = getAdminClient();

  const res = await admin.query({
    data: `{
      shop {
        metafield(namespace: "app", key: "expired_inventory_hours") {
          value
        }
      }
    }`,
  });

  const expiredTime = res.body.data.shop.metafield?.value || "0";

  console.log("Expired inventory hours:", expiredTime);

  const collectionId = `gid://shopify/Collection/${SPECIAL_COLLECTION_ID}`; // 🔹 your special collection
  const now = new Date();
  console.log("Current time (EST):", now);

  // Step 1: fetch products with metafield
  const response = await admin.query({
    data: `{
      collection(id: "${collectionId}") {
        products(first: 50) {
          edges {
            node {
              id
              title
              metafield(namespace: "custom", key: "Date") {
                value
              }
            }
          }
        }
      }
    }`,
  });

  const products = response.body.data.collection.products.edges.map(
    (e) => e.node,
  );

  console.log("Fetched products:", products);

  // Step 2: filter expired
  const expiredIds = products
    .filter((p) => {
      if (!p.metafield?.value) return false;
      const cutoff = getCutoff(p.metafield.value, expiredTime);
      return now >= cutoff;
    })
    .map((p) => p.id);

  // Step 3: remove expired products
  if (expiredIds.length > 0) {
    const mutation = await admin.query({
      data: `#graphql
				mutation {
					collectionRemoveProducts(
						id: "${collectionId}",
						productIds: ${JSON.stringify(expiredIds)}
					) {
						job { id }
						userErrors { field message }
					}
				}`,
    });

    console.log("✅ Removed expired products:", expiredIds);
    console.log("Mutation result:", mutation.body);
  } else {
    console.log("ℹ️ No expired products found.");
  }
}

expireProducts();
