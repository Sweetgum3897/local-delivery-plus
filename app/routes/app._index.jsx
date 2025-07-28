import { useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import {Page, Layout, Card, Button, BlockStack, InlineStack} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {

  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
  mutation CarrierServiceCreate($input: DeliveryCarrierServiceCreateInput!) {
    carrierServiceCreate(input: $input) {
      carrierService {
        id
        name
        callbackUrl
        active
        supportsServiceDiscovery
      }
      userErrors {
        field
        message
      }
    }
  }`,
    {
      variables: {
        "input": {
          "name": "Local Delivery+ Shipping",
          "callbackUrl": "https://diamondlifegear.com/gk-shipping/get-rates",
          "supportsServiceDiscovery": true,
          "active": true
        }
      },
    },
  );

  const data = await response.json();

  return {
    'json': data
  };
};

export default function Index() {

  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {

    (async function() {
      const token = await shopify.idToken()

      const response = await fetch("https://diamondlifegear.com/gk-shipping/access?tk=" + encodeURIComponent(token), {
        method: "GET",
      });
    })();

  }, [shopify]);

  const addCarrier = () => fetcher.submit({}, { method: "POST" });

  return (
    <Page>
      <TitleBar title="Local Delivery+"></TitleBar>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <InlineStack gap="300">
                  <Button loading={isLoading} onClick={addCarrier}>
                    Add Local Delivery+ Carrier to your Shopify store.
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
