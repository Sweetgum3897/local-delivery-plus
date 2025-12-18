import { json } from "@remix-run/node";
import React, { useContext, useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate } from "@remix-run/react";
import { Page, Layout, BlockStack } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  Button,
  Input,
  Popconfirm,
  Table,
  InputNumber,
  Card,
  Form,
} from "antd";

const EditableContext = React.createContext(null);

const EditableRow = ({ index, ...props }) => {
  const [form] = Form.useForm();
  return (
    <Form form={form} component={false}>
      <EditableContext.Provider value={form}>
        <tr {...props} />
      </EditableContext.Provider>
    </Form>
  );
};

const EditableCell = ({
  title,
  editable,
  children,
  dataIndex,
  record,
  handleSave,
  ...restProps
}) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);
  const form = useContext(EditableContext);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  const toggleEdit = () => {
    setEditing(!editing);
    form.setFieldsValue({ [dataIndex]: record[dataIndex] });
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      toggleEdit();
      handleSave({ ...record, ...values });
    } catch (errInfo) {
      console.log("Save failed:", errInfo);
    }
  };

  let childNode = children;

  if (editable) {
    childNode = editing ? (
      <Form.Item
        style={{ margin: 0 }}
        name={dataIndex}
        rules={[
          {
            required: true,
            message: `${title} is required.`,
          },
          ...(title === "PostalCodes"
            ? [
                {
                  validator: (_, value) => {
                    const regex = /^(\d{5})(,\d{5})*$/;
                    if (!regex.test(value.trim())) {
                      return Promise.reject(
                        new Error(
                          "Use 5-digit ZIPs, comma-separated (e.g. 12345,67890)",
                        ),
                      );
                    }

                    return Promise.resolve();
                  },
                },
              ]
            : []),
        ]}
      >
        {title === "PostalCodes" ? (
          <Input ref={inputRef} onPressEnter={save} onBlur={save} />
        ) : (
          <InputNumber
            ref={inputRef}
            onPressEnter={save}
            onBlur={save}
            min={0}
          />
        )}
      </Form.Item>
    ) : (
      <div
        className="editable-cell-value-wrap"
        style={{ paddingInlineEnd: 24 }}
        onClick={toggleEdit}
      >
        {children}
      </div>
    );
  }

  return <td {...restProps}>{childNode}</td>;
};

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
        input: {
          name: "Local Delivery+ Shipping",
          callbackUrl: "https://diamondlifegear.com/gk-shipping/get-rates",
          supportsServiceDiscovery: true,
          active: true,
        },
      },
    },
  );

  const data = await response.json();

  return {
    json: data,
  };
};

export default function Index() {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  const [dataSource, setDataSource] = useState([]);
  const [count, setCount] = useState(0);
  const [duplicatedCodes, setDuplicatedCodes] = useState([]);

  useEffect(() => {
    (async function () {
      const token = await shopify.idToken();

      const response = await fetch(
        "https://diamondlifegear.com/gk-shipping/access?tk=" +
          encodeURIComponent(token),
        {
          method: "GET",
        },
      );
    })();
  }, [shopify]);

  useEffect(() => {
    getRules();
  }, []);

  const getRules = async () => {
    const response = await fetch(
      "https://diamondlifegear.com/gk-shipping/get-rate-data",
      {
        method: "GET",
      },
    );

    const result = await response.json();
    console.log("getRates", result);

    if (response.ok && result.status) {
      setDataSource(
        result.data.map((item, index) => ({ ...item, key: index + "" })),
      );
      setCount(result.data.length);
    }
  };

  const addCarrier = () => fetcher.submit({}, { method: "POST" });

  const validatePostalCodes = (value) => {
    if (!value.trim()) return "Postal codes are required";
    const regex = /^(\d{5})(,\d{5})*$/;
    if (!regex.test(value.trim()))
      return "Use 5-digit ZIPs, comma-separated (e.g. 12345,67890)";
    return "";
  };

  const hasDuplicateZipCodes = (data) => {
    const seen = new Set();
    const duplicates = new Set();

    for (const item of data) {
      const zips = item.postalCodes.split(",").map((zip) => zip.trim());

      for (const zip of zips) {
        if (seen.has(zip)) {
          duplicates.add(zip);
        } else {
          seen.add(zip);
        }
      }
    }

    return Array.from(duplicates);
  };

  const handleSubmit = async () => {
    const updated = dataSource.map((entry) => ({
      ...entry,
      error: validatePostalCodes(entry.postalCodes),
    }));

    const hasErrors = updated.some((entry) => entry.error);
    if (hasErrors) return;

    const duplicates = hasDuplicateZipCodes(dataSource);
    if (duplicates.length) {
      setDuplicatedCodes(duplicates);
      return;
    }

    setDuplicatedCodes([]);

    console.log("submit", updated);

    const response = await fetch(
      "https://diamondlifegear.com/gk-shipping/add-rate-data",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rules: updated }), // Send as { rules: [...] }
      },
    );

    const result = await response.json();

    if (response.ok) {
      alert("Shipping rules saved!");
    } else {
      alert("Error saving rules: " + result.message);
    }
  };

  const handleDelete = (key) => {
    const newData = dataSource.filter((item) => item.key !== key);
    setDataSource(newData);
  };

  const hasOverlap = (a = "", b = []) => {
    const aSet = new Set(a.split(",").map((code) => code.trim()));
    return b.some((code) => aSet.has(code));
  };

  const defaultColumns = [
    {
      title: "PostalCodes",
      dataIndex: "postalCodes",
      render: (_) => (
        <span
          style={{ color: hasOverlap(_, duplicatedCodes) ? "red" : "black" }}
        >
          {_}
        </span>
      ),
      editable: true,
      width: "60%",
    },
    {
      title: "Price",
      dataIndex: "price",
      render: (_) => "$" + _,
      editable: true,
      width: "20%",
    },
    {
      title: "Operation",
      dataIndex: "operation",
      width: "20%",
      render: (_, record) =>
        dataSource.length >= 1 ? (
          <Popconfirm
            title="Sure to delete?"
            onConfirm={() => handleDelete(record.key)}
          >
            <a>Delete</a>
          </Popconfirm>
        ) : null,
    },
  ];

  const handleAdd = () => {
    const newData = {
      key: count.toString(),
      postalCodes: "11111",
      price: "0",
    };
    setDataSource([...dataSource, newData]);
    setCount(count + 1);
  };

  const handleSave = (row) => {
    const newData = [...dataSource];
    const index = newData.findIndex((item) => row.key === item.key);
    const item = newData[index];
    newData.splice(index, 1, {
      ...item,
      ...row,
    });
    setDataSource(newData);
  };

  const components = {
    body: {
      row: EditableRow,
      cell: EditableCell,
    },
  };

  const columns = defaultColumns.map((col) => {
    if (!col.editable) return col;
    return {
      ...col,
      onCell: (record) => ({
        record,
        editable: col.editable,
        dataIndex: col.dataIndex,
        title: col.title,
        handleSave,
      }),
    };
  });

  return (
    <Page>
      <ui-title-bar title="Local Delivery+">
        <button onClick={() => navigate("/app")}>Local Delivery+</button>
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
        {/* <button onClick={() => navigate("/testGraphQL")}>
          GraphQL Playground
        </button> */}
      </ui-title-bar>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card
              title="Shipping Rules"
              variant="borderless"
              extra={
                <Button loading={isLoading} onClick={addCarrier}>
                  Add Local Delivery+ Carrier to your Shopify store.
                </Button>
              }
            >
              <div>
                <Button
                  onClick={handleAdd}
                  type="primary"
                  style={{ marginBottom: 16 }}
                >
                  Add a new rule
                </Button>
                <Table
                  components={components}
                  rowClassName={() => "editable-row"}
                  bordered
                  dataSource={dataSource.sort((a, b) => {
                    const priceDiff = a.price - b.price;
                    if (priceDiff !== 0) {
                      return priceDiff; // Sort by price first
                    }
                    // If price is the same, sort by postalCodes alphabetically
                    return a.postalCodes.localeCompare(b.postalCodes);
                  })}
                  columns={columns}
                  pagination={false}
                />
                {duplicatedCodes.length ? (
                  <p style={{ color: "red" }}>
                    The Postal Codes {duplicatedCodes.join(",")} are duplicated
                  </p>
                ) : (
                  ""
                )}
              </div>
              <Button
                onClick={handleSubmit}
                style={{ marginTop: 16 }}
                type="primary"
                danger
              >
                Submit All
              </Button>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
