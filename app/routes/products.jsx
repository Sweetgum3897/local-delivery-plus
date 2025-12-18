import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import shopify from "../shopify.server";

export async function loader({ request }) {
  const { admin } = await shopify.authenticate.admin(request);

  const response = await admin.graphql(`
    {
      products(first: 25) {
        nodes {
          id
          title
          metafield(namespace: \"custom\", key: \"Date\") {
            value
            type
          }
          collections(first: 5) {
            nodes {
              id
              title
            }
          }
          description
          updatedAt
        }
      }
    }`);

  const {
    data: {
      products: { nodes },
    },
  } = await response.json();

  console.log("res", nodes);

  return json({ products: nodes });
}

export default function Product() {
  const { products } = useLoaderData();
  console.log("products", products);

  return (
    <div>
      <h2>Products</h2>
      <ul>
        {products &&
          products.map((product, index) => (
            <li key={index}>
              <strong>{product.title}</strong> : {product.description}
            </li>
          ))}
      </ul>
    </div>
  );
}
