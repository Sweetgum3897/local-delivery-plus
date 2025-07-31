import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import shopify from "../shopify.server";

export async function loader({ request }) {
  const { admin } = await shopify.authenticate.admin(request);

  const response = await admin.graphql(`
    {
      products(first: 25) {
        nodes {
          title
          description
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
          products.map((service, index) => (
            <li key={index}>
              <strong>{service.title}</strong> : {service.description}
            </li>
          ))}
      </ul>
    </div>
  );
}
