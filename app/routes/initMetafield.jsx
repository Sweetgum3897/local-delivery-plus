import { json } from "@remix-run/node";
import { getAdminClient, SPECIAL_COLLECTION_ID } from "../shopify.server";
import { initializeProductIdsMetafield } from "../utils/initializeProductIdsMetafield";

// Optional: add auth middleware here for admin-only access

export const loader = async () => {
  try {
    const admin = getAdminClient();
    const metafieldRes = await admin.query({
      data: `{
        collection(id: "gid://shopify/Collection/${SPECIAL_COLLECTION_ID}") {
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
    console.log("Current product_ids metafield value:", oldProductIdsRaw);

    const productIds = await initializeProductIdsMetafield();
    return json({
      status: "success",
      message: "Metafield initialized.",
      productIds,
    });
  } catch (err) {
    console.error(err);
    return json({ status: "error", message: err.message }, { status: 500 });
  }
};
