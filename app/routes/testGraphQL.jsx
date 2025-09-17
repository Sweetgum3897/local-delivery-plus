import { json } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import shopify from "../shopify.server";

// Action: runs the GraphQL query typed by user
export async function action({ request }) {
  const { admin } = await shopify.authenticate.admin(request);

  const formData = await request.formData();
  const query = formData.get("query");

  if (!query) {
    return json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const response = await admin.graphql(query.toString());
    const data = await response.json();
    return json({ data });
  } catch (err) {
    return json({ error: String(err) }, { status: 500 });
  }
}

export default function GraphQLPlayground() {
  const result = useActionData();
  const navigation = useNavigation();

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Shopify GraphQL Playground</h2>

      {/* Textarea Form */}
      <Form method="post">
        <textarea
          name="query"
          rows={8}
          style={{
            width: "100%",
            padding: "0.5rem",
            fontFamily: "monospace",
            fontSize: "14px",
          }}
          placeholder={`{
            products(first: 50) {
              edges {
                node {
                  id
                  title
                  description
                  updatedAt

                  # Get up to 10 metafields for each product
                  metafield(namespace: "custom", key: "date") {
                value
                type
              }
                  # Example: collections each product belongs to
                  collections(first: 5) {
                    edges {
                      node {
                        id
                        title
                      }
                    }
                  }
                }
              }
            }
          }`}
        />
        <br />
        <button
          type="submit"
          disabled={navigation.state === "submitting"}
          style={{ marginTop: "0.5rem" }}
        >
          {navigation.state === "submitting" ? "Running..." : "Run Query"}
        </button>
      </Form>

      {/* JSON Result */}
      {result && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Result:</h3>
          <pre
            style={{
              background: "#f4f4f4",
              padding: "1rem",
              borderRadius: "5px",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
