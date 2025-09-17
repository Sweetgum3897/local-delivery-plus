export async function setProductInventory(admin, productId, quantity) {
  // Step 1: Get product variants and inventory items
  const variantsRes = await admin.query({
    data: `{
      product(id: "${productId}") {
        variants(first: 10) {
          edges {
            node {
              id
              inventoryItem { id }
            }
          }
        }
      }
    }`,
  });

  const variants = variantsRes.body.data.product.variants.edges;

  for (const v of variants) {
    const inventoryItemId = v.node.inventoryItem.id;

    // Step 2: Get inventory levels (locations) for this item
    const levelsRes = await admin.query({
      data: `{
        inventoryItem(id: "${inventoryItemId}") {
          inventoryLevels(first: 10) {
            edges {
              node {
                location { id name }
              }
            }
          }
        }
      }`,
    });

    const levelEdges =
      levelsRes.body.data.inventoryItem?.inventoryLevels.edges || [];

    if (!levelEdges.length) {
      console.warn(
        `⚠️ No inventory levels found for ${productId} / ${inventoryItemId}`,
      );
      continue;
    }

    // Step 3: Update quantity at each location
    for (const edge of levelEdges) {
      const location = edge.node.location;
      console.log(`⚙️ Setting ${productId} at ${location.name} → ${quantity}`);

      const result = await admin.query({
        data: `mutation {
          inventorySetQuantities(
            input: {
              reason: "correction"
              name: "available"
              ignoreCompareQuantity: true
              quantities: [
                {
                  inventoryItemId: "${inventoryItemId}"
                  locationId: "${location.id}"
                  quantity: ${quantity}
                }
              ]
            }
          ) {
            inventoryAdjustmentGroup {
              createdAt
              reason
              changes {
                name
                delta
                quantityAfterChange
                item { id }
                location { id name }
              }
            }
            userErrors {
              field
              message
            }
          }
        }`,
      });

      const errors = result.body.data.inventorySetQuantities.userErrors;

      if (errors.length) {
        console.error("❌ Error updating inventory:", errors);
      } else {
        console.log("✅ Inventory updated successfully.");
      }
    }
  }
}
