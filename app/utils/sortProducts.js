import { getAdminClient, SPECIAL_COLLECTION_ID } from "../shopify.server.js";

export default async function sortProducts() {
  const admin = getAdminClient();
  const collectionId = `gid://shopify/Collection/${SPECIAL_COLLECTION_ID}`; // 🔹 your special collection
  const now = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
    })
  );

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
    (e) => e.node
  );

  // Step 2: Convert date strings to unix timestamps
  for (let product in products) {
    let dateObject = new Date(
      new Date(products[product].metafield.value).toLocaleString("en-US", {
        timeZone: "America/New_York",
      })
    );
    products[product].metafield.value = Math.floor(dateObject.getTime() / 1000);
  }

  // Step 3: Sort products by date (value)
  products.sort((a, b) => a.metafield.value - b.metafield.value); // Sorts in ascending order by age

  const productIds = products.map((p) => p.id);
  const productMoves = [];

  for (let i = 0; i < productIds.length; i++) {
    productMoves.push({
      id: productIds[i],
      newPosition: i.toString(),
    });
  }

  // Step 4: Update the collection's sort order.
  const mutation = await admin.query({
    data: {
      query: `mutation collectionReorderProducts($id: ID!, $moves: [MoveInput!]!) {
        collectionReorderProducts(id: $id, moves: $moves) {
          job {
            id
          }
          userErrors {
            field
            message
          }
        }
      }`,
      variables: {
        id: collectionId,
        moves: productMoves,
      },
    },
  });

  console.log("Mutation result:", mutation.body);
}

sortProducts();
