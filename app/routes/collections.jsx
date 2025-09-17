import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import shopify from "../shopify.server";

export async function loader({ request }) {
  const { admin } = await shopify.authenticate.admin(request);

  const response = await admin.graphql(`
    {
      collections(first: 100) {
        nodes {
          id
          title
          description
          updatedAt
        }
      }
    }`);

  const {
    data: {
      collections: { nodes },
    },
  } = await response.json();

  console.log("res", nodes);

  return json({ collections: nodes });
}

export default function Product() {
  const { collections } = useLoaderData();
  console.log("collections", collections);

  return (
    <div>
      <h2>Collections</h2>
      <ul>
        {collections &&
          collections.map((collection, index) => (
            <li key={index}>
              <strong>{collection.title}</strong> : {collection.description}
            </li>
          ))}
      </ul>
    </div>
  );
}
