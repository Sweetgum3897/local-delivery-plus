import { json } from "@remix-run/node";
import { useLoaderData, redirect, Form } from "@remix-run/react";
import { useNavigate } from "@remix-run/react";
import { Page, Layout, BlockStack } from "@shopify/polaris";
import { Button, InputNumber, Card } from "antd";
import shopify from "../shopify.server";

export async function loader({ request }) {
  const { admin } = await shopify.authenticate.admin(request);

  const res = await admin.graphql(`
    {
      shop {
        metafield(namespace: "app", key: "default_inventory_quantity") {
          value
        }
      }
    }`);
  const result = await res.json();

  const defaultQty = result.data.shop.metafield?.value || "15";
  return json({ defaultQty });
}

export async function action({ request }) {
  const formData = await request.formData(); // FIX
  const qty = parseInt(formData.get("quantity"), 10);

  console.log("Setting default inventory quantity to", qty);

  const { admin } = await shopify.authenticate.admin(request);
  const shopRes = await admin.graphql(`{ shop { id } }`);
  const data = await shopRes.json(); // 👈 important
  const shopId = data.data.shop.id;

  await admin.graphql(
    `#graphql
      mutation {
        metafieldsSet(metafields: [
          {
            namespace: "app"
            key: "default_inventory_quantity"
            type: "number_integer"
            value: "${qty}"
            ownerId: "${shopId}"
          }
        ]) {
          userErrors { field message }
        }
      }
    `,
  );

  return redirect("/default/inventory/quantity");
}

export default function DefaultInventoryQuantity() {
  const navigate = useNavigate();

  const { defaultQty } = useLoaderData();
  console.log("defaultQty", defaultQty);

  return (
    <Page>
      <ui-title-bar title="Local Delivery+">
        <button onClick={() => navigate("/app")}>Local Delivery+ Home</button>
        {/* <button onClick={() => navigate("/products")}>Products List</button>
        <button onClick={() => navigate("/collections")}>
          Collections List
        </button> */}
        <button onClick={() => navigate("/default/inventory/quantity")}>
          Default Inventory Quantity
        </button>
        <button onClick={() => navigate("/expired/products/cleanup")}>
          Expired Products Cleanup
        </button>
        <button onClick={() => navigate("/testGraphQL")}>
          GraphQL Playground
        </button>
      </ui-title-bar>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card title="Default Inventory Quantity" variant="borderless">
              <p>
                Current Default Inventory Quantity:{" "}
                <strong>{Math.abs(defaultQty)}</strong>
              </p>
              <Form method="post">
                <InputNumber name="quantity" defaultValue={defaultQty} />
                <Button
                  type="primary"
                  htmlType="submit"
                  style={{
                    backgroundColor: "blue",
                    color: "white",
                    marginLeft: "8px",
                  }}
                >
                  Save
                </Button>
              </Form>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
