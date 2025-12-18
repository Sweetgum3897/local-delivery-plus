import { json } from "@remix-run/node";
import { useLoaderData, redirect, Form } from "@remix-run/react";
import { useNavigate } from "@remix-run/react";
import { Page, Layout, BlockStack } from "@shopify/polaris";
import { Button, Card, InputNumber } from "antd";
import shopify from "../shopify.server";

export async function loader({ request }) {
  const { admin } = await shopify.authenticate.admin(request);

  const res = await admin.graphql(`
    {
      shop {
        metafield(namespace: "app", key: "expired_inventory_hours") {
          value
        }
      }
    }`);
  const result = await res.json();

  const expiredTime = result.data.shop.metafield?.value || "0";
  return json({ expiredTime });
}

export async function action({ request }) {
  const formData = await request.formData(); // FIX
  const hours = parseInt(formData.get("hours"), 10);

  console.log("Setting expired inventory hours to", hours);

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
            key: "expired_inventory_hours"
            type: "number_integer"
            value: "${hours}"
            ownerId: "${shopId}"
          }
        ]) {
          userErrors { field message }
        }
      }
    `,
  );

  return redirect("/expired/products/cleanup");
}

export default function ExpiredProductsCleanup() {
  const navigate = useNavigate();

  const { expiredTime } = useLoaderData();
  console.log("expiredTime", expiredTime);

  return (
    <Page>
      <ui-title-bar title="Local Delivery+">
        <button onClick={() => navigate("/app")}>Local Delivery+</button>
        <button onClick={() => navigate("/default/inventory/quantity")}>
          Default Inventory Quantity
        </button>
        <button onClick={() => navigate("/expired/products/cleanup")}>
          Expired Products Cleanup
        </button>
      </ui-title-bar>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card title="Expired Products Cleanup" variant="borderless">
              <p>
                Current setting:{" "}
                <strong>{Math.abs(expiredTime)} hours before</strong> the
                expiration date
              </p>

              <Form method="post">
                <InputNumber name="hours" defaultValue={expiredTime} />
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
